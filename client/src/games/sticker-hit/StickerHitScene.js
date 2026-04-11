import * as THREE from 'three';
import { EventBus } from '../../shared/EventBus.js';
import { reboundHeadingDegFromImpact, resolveThrowAgainstDisc } from '../../../../shared/sticker-hit/throwResolve.js';
import { normalizeDeg, targetRotationDeg } from '../../../../shared/sticker-hit/timeline.js';
import { GAME_CONFIG } from './config.js';
import {
  DEFAULT_STICKER_MANIFEST_TIMEOUT_MS,
  fetchStickerManifest,
  toBackendAssetUrl as stickerManifestAssetUrl,
} from './stickerManifest.js';

const KENNEY_ASSETS = {
  stallBg: '/kenney/shooting-gallery/Stall/bg_wood.png',
  targetOverlay: '/kenney/shooting-gallery/Objects/target_back.png',
  crosshair: '/kenney/shooting-gallery/HUD/crosshair_outline_small.png',
  curtainTop: '/kenney/shooting-gallery/Stall/curtain_top.png',
  treeOak: '/kenney/shooting-gallery/Stall/tree_oak.png',
  cloud1: '/kenney/shooting-gallery/Stall/cloud1.png',
  pipOff: '/kenney/boardgame/Pieces%20(Yellow)/pieceYellow_border00.png',
  pipOn: '/kenney/boardgame/Pieces%20(Yellow)/pieceYellow_multi00.png',
};

const TARGET_RADIUS = 2.05;

function backendOrigin() {
  if (window.location.hostname === 'localhost') return 'http://localhost:3000';
  return window.location.origin;
}

function toBackendAssetUrl(pathname) {
  return stickerManifestAssetUrl(pathname, backendOrigin());
}

function secureRandomIndex(maxExclusive) {
  if (maxExclusive <= 0) return 0;
  if (globalThis.crypto?.getRandomValues) {
    const buf = new Uint32Array(1);
    const maxUint = 2 ** 32;
    const limit = maxUint - (maxUint % maxExclusive);
    for (;;) {
      globalThis.crypto.getRandomValues(buf);
      if (buf[0] < limit) {
        return buf[0] % maxExclusive;
      }
    }
  }
  return Math.floor(Math.random() * maxExclusive);
}

export class StickerHitScene {
  constructor(sceneManager, network, _ui, gameData) {
    this.sceneManager = sceneManager;
    this.network = network;
    this.gameData = gameData;
    this.rootEl = null;
    this.state = null;
    this.prevState = null;
    this.scene = null;
    this.camera = null;
    this.targetGroup = null;
    this.targetMesh = null;
    this.targetOverlayMesh = null;
    this.projectiles = [];
    this.markerSprites = [];
    this.textureLoader = new THREE.TextureLoader();
    this.textureCache = new Map();
    this.targetStageLabelEl = null;
    this.statusEl = null;
    this.guideEl = null;
    this.feedbackEl = null;
    this.progressYouEl = null;
    this.progressOppEl = null;
    this.stagePipsEl = null;
    this.throwBtnEl = null;
    this.ammoEl = null;
    this.applesEl = null;
    this.storeBtnEl = null;
    this.storeModalEl = null;
    this.storeCloseEl = null;
    this.storeBackdropEl = null;
    this.storeListEl = null;
    this.ghostDiscEl = null;
    this.equipNoneBtn = null;
    this.equipBossBtn = null;
    this._lastGhostSig = '';
    this.stickerPool = [];
    /** @type {null | 'timeout' | 'http' | 'parse' | 'network'} */
    this._stickerManifestError = null;
    this.throwCooldownUntil = 0;
    this.lastStageSignature = '';
    this.timeMs = 0;
    this.cameraShakeUntil = 0;
    this.targetPulseUntil = 0;
    this.pendingThrows = 0;
    /** Smoothed `serverNow - Date.now()` so predicted impact matches server `_throwSticker`. */
    this._serverTimeOffsetMs = 0;
    this._serverClockSynced = false;

    this._onState = (s) => this.applyState(s);
    this._onShoot = () => this.shoot();
    this._onKeyDown = (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        this.shoot();
      }
    };
    this._onCanvasTap = () => this.shoot();
    this._onStoreOpen = () => this._openStoreModal();
    this._onStoreClose = () => this._closeStoreModal();
    this._onStoreListClick = (e) => {
      const equipBtn = e.target.closest?.('[data-skin-equip]');
      if (equipBtn?.getAttribute('data-skin-equip')) {
        const id = equipBtn.getAttribute('data-skin-equip');
        this.network.sendGameAction({ type: 'sticker-equip-skin', skinId: id });
        return;
      }
      const buyBtn = e.target.closest?.('[data-skin-buy]');
      const buyId = buyBtn?.getAttribute('data-skin-buy');
      if (buyId) {
        this.network.sendGameAction({ type: 'sticker-buy-skin', skinId: buyId });
      }
    };
    this._onEquipNone = () => {
      this.network.sendGameAction({ type: 'sticker-equip-skin', skinId: null });
    };
    this._onEquipBoss = () => {
      this.network.sendGameAction({ type: 'sticker-equip-skin', skinId: 'boss_glow' });
    };
  }

  init() {
    this._initThreeScene();
    this.rootEl = document.createElement('div');
    this.rootEl.className = 'sh-layer';
    this.rootEl.innerHTML = `
      <div class="sh-wrap">
        <div class="sh-board-wrap">
          <div class="sh-dock-top">
            <div class="sh-apples" id="sh-apples" title="Apples this match">🍎 0</div>
            <button class="btn btn-small sh-store-btn" id="sh-store-btn" type="button">Skins</button>
          </div>
          <div class="sh-stage-label" id="sh-stage-label">Stage 1</div>
          <div class="sh-stage-pips" id="sh-stage-pips"></div>
          <div class="sh-guide" id="sh-guide">Throw -> land on empty gap. Hit sticker = crash. First to finish all stages wins.</div>
          <div class="sh-status" id="sh-scene-status">Throw sticker to empty spaces. First to clear all stages wins.</div>
          <div class="sh-feedback" id="sh-feedback"></div>
          <div class="sh-ammo" id="sh-ammo" aria-label="Throws remaining this stage"></div>
          <button class="btn btn-pink sh-throw-btn" id="sh-throw-btn" type="button">Throw Sticker</button>
        </div>
        <div class="sh-side">
          <div class="sh-progress-card">
            <div class="sh-progress-title">You</div>
            <div class="sh-progress-value" id="sh-you-progress">0/0</div>
          </div>
          <div class="sh-progress-card">
            <div class="sh-progress-title">Sayang</div>
            <div class="sh-progress-value" id="sh-opp-progress">0/0</div>
          </div>
          <div class="sh-ghost-wrap">
            <div class="sh-ghost-title">Sayang disc</div>
            <div class="sh-ghost-disc" id="sh-ghost-disc" aria-hidden="true"></div>
          </div>
        </div>
      </div>
      <div class="sh-store-modal" id="sh-store-modal" hidden>
        <div class="sh-store-backdrop" id="sh-store-backdrop"></div>
        <div class="sh-store-card" role="dialog" aria-labelledby="sh-store-title">
          <h3 class="sh-store-title" id="sh-store-title">Sticker skins</h3>
          <p class="sh-store-copy" id="sh-store-copy"></p>
          <div class="sh-store-list" id="sh-store-list"></div>
          <div class="sh-store-equip-row">
            <button class="btn btn-small" type="button" id="sh-equip-none">Unequip</button>
            <button class="btn btn-small" type="button" id="sh-equip-boss" disabled>Boss glow</button>
          </div>
          <button class="btn btn-pink" type="button" id="sh-store-close">Close</button>
        </div>
      </div>
    `;

    document.getElementById('ui-overlay')?.appendChild(this.rootEl);
    this.targetStageLabelEl = this.rootEl.querySelector('#sh-stage-label');
    this.guideEl = this.rootEl.querySelector('#sh-guide');
    this.statusEl = this.rootEl.querySelector('#sh-scene-status');
    this.feedbackEl = this.rootEl.querySelector('#sh-feedback');
    this.progressYouEl = this.rootEl.querySelector('#sh-you-progress');
    this.progressOppEl = this.rootEl.querySelector('#sh-opp-progress');
    this.stagePipsEl = this.rootEl.querySelector('#sh-stage-pips');
    this.throwBtnEl = this.rootEl.querySelector('#sh-throw-btn');
    this.ammoEl = this.rootEl.querySelector('#sh-ammo');
    this.applesEl = this.rootEl.querySelector('#sh-apples');
    this.storeBtnEl = this.rootEl.querySelector('#sh-store-btn');
    this.storeModalEl = this.rootEl.querySelector('#sh-store-modal');
    this.storeCloseEl = this.rootEl.querySelector('#sh-store-close');
    this.storeBackdropEl = this.rootEl.querySelector('#sh-store-backdrop');
    this.storeListEl = this.rootEl.querySelector('#sh-store-list');
    this.ghostDiscEl = this.rootEl.querySelector('#sh-ghost-disc');
    this.equipNoneBtn = this.rootEl.querySelector('#sh-equip-none');
    this.equipBossBtn = this.rootEl.querySelector('#sh-equip-boss');

    this.throwBtnEl?.addEventListener('click', this._onShoot);
    this.storeBtnEl?.addEventListener('click', this._onStoreOpen);
    this.storeCloseEl?.addEventListener('click', this._onStoreClose);
    this.storeBackdropEl?.addEventListener('click', this._onStoreClose);
    this.storeListEl?.addEventListener('click', this._onStoreListClick);
    this.equipNoneBtn?.addEventListener('click', this._onEquipNone);
    this.equipBossBtn?.addEventListener('click', this._onEquipBoss);
    window.addEventListener('keydown', this._onKeyDown);
    this.sceneManager.renderer?.domElement.addEventListener('pointerdown', this._onCanvasTap);
    EventBus.on('sticker-hit:state', this._onState);

    if (this.gameData?.stickerHitState) {
      this.applyState(this.gameData.stickerHitState);
    }
    this._hydrateStickerPool();
    this.sceneManager.onUpdate = (dt) => this.update(dt);
  }

  _initThreeScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0f1833);
    const aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(42, aspect, 0.1, 100);
    this.camera.position.set(0, 0.8, 12);
    this.camera.lookAt(0, 0.1, 0);
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.72));
    const key = new THREE.DirectionalLight(0xfff2cc, 0.9);
    key.position.set(4, 6, 7);
    this.scene.add(key);

    const bgPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(11, 16),
      new THREE.MeshBasicMaterial({ color: 0x133a5e, transparent: true, opacity: 0.3 }),
    );
    bgPlane.position.set(0, 0, -2.5);
    this.scene.add(bgPlane);
    this._applyTextureToPlane(bgPlane, KENNEY_ASSETS.stallBg, 0.34);

    this._addDecorSprite(KENNEY_ASSETS.curtainTop, 0, 5.8, -2.4, 11, 2.8, 0.5);
    this._addDecorSprite(KENNEY_ASSETS.treeOak, -4.2, -2.2, -2.3, 2.2, 4.2, 0.48);
    this._addDecorSprite(KENNEY_ASSETS.treeOak, 4.2, -2.2, -2.3, 2.2, 4.2, 0.48);
    this._addDecorSprite(KENNEY_ASSETS.cloud1, -3.4, 4.2, -2.45, 2.0, 1.0, 0.3);
    this._addDecorSprite(KENNEY_ASSETS.cloud1, 3.3, 4.0, -2.45, 2.0, 1.0, 0.24);

    this.targetGroup = new THREE.Group();
    this.scene.add(this.targetGroup);
    this.targetGroup.position.set(0, 0.6, 0);

    const targetGeom = new THREE.CylinderGeometry(TARGET_RADIUS, TARGET_RADIUS, 0.24, 64);
    const targetMat = new THREE.MeshStandardMaterial({
      color: 0xf6a126,
      roughness: 0.48,
      metalness: 0.08,
      emissive: 0x2a1500,
      emissiveIntensity: 0.25,
    });
    this.targetMesh = new THREE.Mesh(targetGeom, targetMat);
    this.targetMesh.rotation.x = Math.PI / 2;
    this.targetGroup.add(this.targetMesh);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(TARGET_RADIUS + 0.24, 0.16, 16, 80),
      new THREE.MeshStandardMaterial({ color: 0xffdf98, roughness: 0.55, metalness: 0.06 }),
    );
    ring.rotation.x = Math.PI / 2;
    this.targetGroup.add(ring);
    this._addDecorSprite(KENNEY_ASSETS.crosshair, 0, 3.6, 0.5, 0.75, 0.75, 0.62);

    this.targetOverlayMesh = this._addDecorSprite(
      KENNEY_ASSETS.targetOverlay,
      0,
      0,
      0.15,
      TARGET_RADIUS * 1.3,
      TARGET_RADIUS * 1.3,
      0.45,
      this.targetGroup,
    );

    this.sceneManager.setScene(this.scene, this.camera);
  }

  _loadTexture(src) {
    const url = toBackendAssetUrl(src);
    if (this.textureCache.has(url)) return this.textureCache.get(url);
    const texture = this.textureLoader.load(url);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    this.textureCache.set(url, texture);
    return texture;
  }

  _applyTextureToPlane(planeMesh, src, opacity = 1) {
    try {
      const tex = this._loadTexture(src);
      planeMesh.material.map = tex;
      planeMesh.material.transparent = true;
      planeMesh.material.opacity = opacity;
      planeMesh.material.needsUpdate = true;
    } catch (_e) {
      // fallback color-only plane
    }
  }

  _addDecorSprite(src, x, y, z, w, h, opacity = 1, parent = this.scene) {
    const mat = new THREE.SpriteMaterial({ color: 0xffffff, transparent: true, opacity });
    const sprite = new THREE.Sprite(mat);
    sprite.position.set(x, y, z);
    sprite.scale.set(w, h, 1);
    parent.add(sprite);
    try {
      mat.map = this._loadTexture(src);
      mat.needsUpdate = true;
    } catch (_e) {
      mat.color.setHex(0xffffff);
      mat.opacity = 0;
    }
    return sprite;
  }

  async _hydrateStickerPool() {
    const { stickers, error } = await fetchStickerManifest({
      backendOrigin: backendOrigin(),
      timeoutMs: DEFAULT_STICKER_MANIFEST_TIMEOUT_MS,
    });
    this.stickerPool = stickers;
    this._stickerManifestError = error;
    this._updateShooterSticker();
    this._syncMarkers();
    this._renderText();
  }

  _stickerForSeed(seed) {
    if (!this.stickerPool.length) return null;
    const idx = Math.abs(Number(seed) || 0) % this.stickerPool.length;
    return this.stickerPool[idx];
  }

  _pickRandomSticker() {
    if (!this.stickerPool.length) return null;
    return this.stickerPool[secureRandomIndex(this.stickerPool.length)];
  }

  _approxServerNow() {
    return Date.now() + (Number.isFinite(this._serverTimeOffsetMs) ? this._serverTimeOffsetMs : 0);
  }

  /** World-space rim point for disc-local impact angle (degrees), follows rotating `targetGroup`. */
  _rimWorldAtAngle(impactAngleDeg) {
    if (!this.targetGroup) {
      return new THREE.Vector3(0, 0.6 + TARGET_RADIUS * 0.96, 0.52);
    }
    const rad = (Number(impactAngleDeg) * Math.PI) / 180;
    const local = new THREE.Vector3(
      Math.sin(rad) * TARGET_RADIUS * 0.96,
      Math.cos(rad) * TARGET_RADIUS * 0.96,
      0.52,
    );
    return local.applyMatrix4(this.targetGroup.matrixWorld);
  }

  _updateShooterSticker() {
    // Shooter uses projectile texture in 3D scene; nothing to update in DOM.
    const sticker = this._pickRandomSticker();
    if (sticker) this._lastShooterSticker = sticker;
  }

  shoot() {
    if (!this.state) return;
    if (Date.now() < this.throwCooldownUntil) return;
    if (this.state.phase !== 'playing') return;
    if (this.state.you?.crashed || this.state.you?.finished) return;

    this.throwCooldownUntil = Date.now() + 160;
    this.pendingThrows += 1;
    const flightMs = GAME_CONFIG.THROW_FLIGHT_MS ?? 420;
    this.network.sendGameAction({ type: 'throw-sticker', flightMs });
    this._playThrowAnim(flightMs);
    this._showFeedback('THROW!', 'throw');
    this._updateShooterSticker();
  }

  _showFeedback(text, tone = 'neutral') {
    if (!this.feedbackEl) return;
    this.feedbackEl.textContent = text;
    this.feedbackEl.dataset.tone = tone;
    this.feedbackEl.classList.remove('show');
    void this.feedbackEl.offsetWidth;
    this.feedbackEl.classList.add('show');
  }

  _playThrowAnim(flightMs) {
    const sticker = this._pickRandomSticker() || this._lastShooterSticker || null;
    const mat = new THREE.SpriteMaterial({ color: 0xffffff, transparent: true });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(0.95, 0.95, 1);
    sprite.position.set(0, -3.8, 0.8);
    const eq = this.state?.you?.equippedSkinId;
    const goldGlow = eq === 'boss_glow' || ((eq === null || eq === undefined) && !!this.state?.you?.bossSkinUnlocked);
    if (sticker?.src) {
      try {
        mat.map = this._loadTexture(sticker.src.replace(backendOrigin(), ''));
        mat.needsUpdate = true;
        if (eq === 'trail_pink') mat.color.setHex(0xffb6d9);
        else if (eq === 'sparkle_blue') mat.color.setHex(0xa8d8ff);
        else if (goldGlow) mat.color.setHex(0xffe8a8);
      } catch (_e) {
        mat.color.setHex(eq === 'trail_pink' ? 0xff6eb4 : eq === 'sparkle_blue' ? 0x66b3ff : goldGlow ? 0xffd700 : 0xff9a2e);
      }
    } else {
      mat.color.setHex(eq === 'trail_pink' ? 0xff6eb4 : eq === 'sparkle_blue' ? 0x66b3ff : goldGlow ? 0xffd700 : 0xff9a2e);
    }
    this.scene.add(sprite);

    const stage = this.state?.you?.stage;
    const timeline = stage?.timeline;
    let impactAngleDeg = null;
    if (timeline) {
      const nowMs = this._approxServerNow();
      const resolved = resolveThrowAgainstDisc({
        timeline,
        nowMs,
        flightMs,
        obstacleStickers: stage.obstacleStickers || [],
        stuckStickers: stage.stuckStickers || [],
        ringApples: stage.ringApples || [],
        cfg: GAME_CONFIG,
        sampleCount: GAME_CONFIG.THROW_PATH_SAMPLES ?? 12,
      });
      impactAngleDeg = resolved.impactAngle;
    }

    this.projectiles.push({
      sprite,
      startedAt: performance.now(),
      durationMs: flightMs,
      start: new THREE.Vector3(0, -3.8, 0.8),
      impactAngleDeg,
    });
  }

  _spawnImpactFx() {
    const burst = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 10, 10),
      new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.95 }),
    );
    burst.position.set(0, 0.6 + TARGET_RADIUS * 0.98, 0.5);
    this.scene.add(burst);
    const start = performance.now();
    const tick = () => {
      const t = Math.min(1, (performance.now() - start) / 220);
      burst.scale.setScalar(0.6 + (t * 2.0));
      burst.material.opacity = 0.95 * (1 - t);
      if (t < 1) requestAnimationFrame(tick);
      else this.scene.remove(burst);
    };
    tick();
  }

  _playBoardHit() {
    this.targetPulseUntil = performance.now() + 160;
  }

  _playBoardCrash() {
    this.cameraShakeUntil = performance.now() + 320;
  }

  _openStoreModal() {
    if (!this.storeModalEl) return;
    this._refreshStoreUI();
    this.storeModalEl.hidden = false;
  }

  _closeStoreModal() {
    if (this.storeModalEl) this.storeModalEl.hidden = true;
  }

  _refreshStoreUI() {
    const copyEl = this.rootEl?.querySelector('#sh-store-copy');
    const apples = this.state?.you?.apples ?? 0;
    const unlocked = !!this.state?.you?.bossSkinUnlocked;
    const owned = this.state?.you?.ownedSkinIds || [];
    const equipped = this.state?.you?.equippedSkinId ?? null;
    const skins = this.state?.skins || GAME_CONFIG.SKINS || [];

    if (copyEl) {
      copyEl.textContent = `Apples (banked across matches when signed in): ${apples}. Boss glow ${unlocked ? 'unlocked' : 'locked (clear boss stage)'}. Skins you own stay on your profile.`;
    }

    if (this.equipBossBtn) {
      this.equipBossBtn.disabled = !unlocked;
      this.equipBossBtn.dataset.active = equipped === 'boss_glow' ? 'true' : 'false';
    }

    if (!this.storeListEl) return;
    this.storeListEl.innerHTML = '';
    skins.forEach((skin) => {
      const row = document.createElement('div');
      row.className = 'sh-store-row';
      const has = owned.includes(skin.id);
      const price = document.createElement('span');
      price.className = 'sh-store-price';
      price.textContent = has ? 'Owned' : `${skin.cost} 🍎`;
      const label = document.createElement('span');
      label.className = 'sh-store-skin-name';
      label.textContent = skin.label || skin.id;
      const buy = document.createElement('button');
      buy.type = 'button';
      buy.className = 'btn btn-small sh-store-buy';
      if (has) {
        buy.setAttribute('data-skin-equip', skin.id);
        buy.textContent = equipped === skin.id ? 'Equipped' : 'Equip';
        buy.disabled = equipped === skin.id;
      } else {
        buy.setAttribute('data-skin-buy', skin.id);
        buy.textContent = 'Buy';
        if (apples < skin.cost) buy.disabled = true;
      }
      row.append(label, price, buy);
      this.storeListEl.appendChild(row);
    });
  }

  _spawnStageShatterFx(previousView) {
    if (!this.scene || !this.targetGroup || !previousView?.you?.stage) return;
    const stage = previousView.you.stage;
    const seeds = [
      ...(stage.obstacleStickers || []),
      ...(stage.stuckStickers || []),
    ];
    const count = Math.max(28, seeds.length * 6);
    const origin = new THREE.Vector3(0, 0.6, 0.52);
    this.targetGroup.localToWorld(origin);
    const pieces = [];
    for (let i = 0; i < count; i += 1) {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.07 + Math.random() * 0.06, 0.1 + Math.random() * 0.08, 0.04),
        new THREE.MeshBasicMaterial({
          color: new THREE.Color().setHSL(0.08 + Math.random() * 0.08, 0.85, 0.55),
          transparent: true,
          opacity: 1,
        }),
      );
      mesh.position.copy(origin);
      const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.2, Math.random() * 0.4).normalize();
      this.scene.add(mesh);
      pieces.push({ mesh, vel: dir.multiplyScalar(1.8 + Math.random() * 3.2), life: 0 });
    }
    const start = performance.now();
    const step = () => {
      const t = performance.now() - start;
      const dt = 0.016;
      pieces.forEach((p) => {
        p.mesh.position.addScaledVector(p.vel, dt);
        p.vel.y -= 2.2 * dt;
        p.mesh.rotation.x += dt * 8;
        p.mesh.rotation.z += dt * 6;
        p.mesh.material.opacity = Math.max(0, 1 - t / 520);
      });
      if (t < 520) {
        requestAnimationFrame(step);
      } else {
        pieces.forEach((p) => {
          this.scene.remove(p.mesh);
          p.mesh.geometry.dispose();
          p.mesh.material.dispose();
        });
      }
    };
    step();
  }

  /**
   * @param {{ type: 'crash', impactAngle: number, reboundTangentDeg?: number }} throwFx
   */
  _spawnCrashBounceFx(throwFx) {
    if (!this.scene || !this.targetGroup) return;
    if (!throwFx || throwFx.type !== 'crash') return;
    const impactAngleDeg = Number(throwFx.impactAngle);
    const rad = (Number.isFinite(impactAngleDeg) ? impactAngleDeg : 0) * (Math.PI / 180);
    const localHit = new THREE.Vector3(
      Math.sin(rad) * TARGET_RADIUS * 0.98,
      Math.cos(rad) * TARGET_RADIUS * 0.98,
      0.55,
    );
    const worldHit = localHit.clone().applyMatrix4(this.targetGroup.matrixWorld);

    const nLocal = new THREE.Vector3(Math.sin(rad), Math.cos(rad), 0).normalize();
    const tanDeg = Number.isFinite(Number(throwFx.reboundTangentDeg))
      ? Number(throwFx.reboundTangentDeg)
      : reboundHeadingDegFromImpact(impactAngleDeg);
    const tanRad = (normalizeDeg(tanDeg) * Math.PI) / 180;
    const tLocal = new THREE.Vector3(Math.cos(tanRad), Math.sin(tanRad), 0).normalize();
    const worldN = nLocal.clone().transformDirection(this.targetGroup.matrixWorld).normalize();
    const worldT = tLocal.clone().transformDirection(this.targetGroup.matrixWorld).normalize();

    const spawnChip = (size, color, vel) => {
      const geom = new THREE.SphereGeometry(size, 8, 8);
      const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 });
      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.copy(worldHit);
      this.scene.add(mesh);
      const v = vel.clone();
      const start = performance.now();
      const step = () => {
        const t = performance.now() - start;
        mesh.position.addScaledVector(v, 0.018);
        v.y -= 0.085;
        v.addScaledVector(worldN, 0.012);
        mat.opacity = Math.max(0, 1 - t / 520);
        if (t < 520) requestAnimationFrame(step);
        else {
          this.scene.remove(mesh);
          geom.dispose();
          mat.dispose();
        }
      };
      step();
    };

    const bounceMain = worldN.clone().multiplyScalar(2.85)
      .add(worldT.clone().multiplyScalar((Math.random() - 0.5) * 2.2))
      .add(new THREE.Vector3(0, 0.55, 1.05));
    spawnChip(0.15, 0xff8c9e, bounceMain);

    for (let i = 0; i < 7; i += 1) {
      const spread = worldT.clone().multiplyScalar((Math.random() - 0.5) * 3.2)
        .add(worldN.clone().multiplyScalar(1.4 + Math.random() * 1.8));
      spawnChip(0.05 + Math.random() * 0.05, 0xffb3c6, spread);
    }
  }

  _spawnAppleBonusFx(impactAngleDeg) {
    if (!this.scene || !this.targetGroup) return;
    const rad = (Number(impactAngleDeg) * Math.PI) / 180;
    const local = new THREE.Vector3(
      Math.sin(rad) * TARGET_RADIUS * 1.02,
      Math.cos(rad) * TARGET_RADIUS * 1.02,
      0.62,
    );
    const world = local.clone();
    this.targetGroup.localToWorld(world);
    for (let i = 0; i < 10; i += 1) {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.05, 6, 6),
        new THREE.MeshBasicMaterial({ color: 0x88ffcc, transparent: true, opacity: 0.95 }),
      );
      mesh.position.copy(world);
      this.scene.add(mesh);
      const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.5, Math.random()).normalize();
      const vel = dir.multiplyScalar(1.2 + Math.random() * 1.8);
      const start = performance.now();
      const tick = () => {
        const t = performance.now() - start;
        mesh.position.addScaledVector(vel, 0.02);
        mesh.material.opacity = Math.max(0, 0.95 - t / 280);
        if (t < 280) requestAnimationFrame(tick);
        else {
          this.scene.remove(mesh);
          mesh.geometry.dispose();
          mesh.material.dispose();
        }
      };
      tick();
    }
  }

  _syncMarkers() {
    if (!this.targetGroup || !this.state?.you?.stage) return;
    const stage = this.state.you.stage;
    const obstacleSig = (stage.obstacleStickers || [])
      .map((x) => `${x.angle}:${x.stickerSeed}:${x.kind || 'knife'}`)
      .join(',');
    const stuckSig = (stage.stuckStickers || [])
      .map((x) => `${x.angle}:${x.stickerSeed}`)
      .join(',');
    const appleSig = (stage.ringApples || []).map((a) => `${a.id}:${a.angle}`).join(',');
    const sig = `${stage.stageIndex}|${appleSig}|${obstacleSig}|${stuckSig}|${this.stickerPool.length}`;
    if (sig === this.lastStageSignature) return;
    this.lastStageSignature = sig;

    this.markerSprites.forEach((s) => this.targetGroup.remove(s));
    this.markerSprites = [];

    const makeStickerSprite = (sticker, angleDeg, tint = 0xffffff) => {
      const mat = new THREE.SpriteMaterial({ color: tint, transparent: true, opacity: 1 });
      const sprite = new THREE.Sprite(mat);
      sprite.scale.set(0.62, 0.62, 1);
      const rad = (angleDeg * Math.PI) / 180;
      sprite.position.set(Math.sin(rad) * TARGET_RADIUS, Math.cos(rad) * TARGET_RADIUS, 0.5);
      if (sticker?.src) {
        try {
          mat.map = this._loadTexture(sticker.src.replace(backendOrigin(), ''));
          mat.needsUpdate = true;
        } catch (_e) {
          mat.color.setHex(tint);
        }
      }
      return sprite;
    };

    const makeAppleSprite = (angleDeg) => {
      const mat = new THREE.SpriteMaterial({ color: 0x66ff99, transparent: true, opacity: 0.95 });
      const sprite = new THREE.Sprite(mat);
      sprite.scale.set(0.38, 0.38, 1);
      const rad = (angleDeg * Math.PI) / 180;
      sprite.position.set(Math.sin(rad) * TARGET_RADIUS * 1.02, Math.cos(rad) * TARGET_RADIUS * 1.02, 0.58);
      return sprite;
    };

    (stage.obstacleStickers || []).forEach((item) => {
      const sticker = this._stickerForSeed(item.stickerSeed);
      const isSpike = item.kind === 'spike';
      const sprite = makeStickerSprite(sticker, item.angle, isSpike ? 0xff44aa : 0xff8f8f);
      if (isSpike) sprite.scale.set(0.52, 0.52, 1);
      this.targetGroup.add(sprite);
      this.markerSprites.push(sprite);
    });
    (stage.stuckStickers || []).forEach((item) => {
      const sticker = this._stickerForSeed(item.stickerSeed);
      const sprite = makeStickerSprite(sticker, item.angle, 0x9dffd0);
      this.targetGroup.add(sprite);
      this.markerSprites.push(sprite);
    });
    (stage.ringApples || []).forEach((a) => {
      const sprite = makeAppleSprite(a.angle);
      this.targetGroup.add(sprite);
      this.markerSprites.push(sprite);
    });
  }

  applyState(state) {
    const previous = this.prevState;

    if (typeof state?.serverNow === 'number' && Number.isFinite(state.serverNow)) {
      const sample = state.serverNow - Date.now();
      if (!this._serverClockSynced) {
        this._serverTimeOffsetMs = sample;
        this._serverClockSynced = true;
      } else {
        this._serverTimeOffsetMs = this._serverTimeOffsetMs * 0.88 + sample * 0.12;
      }
    }

    if (previous && (state?.you?.stageBreakSeq ?? 0) > (previous.you?.stageBreakSeq ?? 0)) {
      this._spawnStageShatterFx(previous);
    }

    const fx = state?.you?.throwFx;
    const prevFx = previous?.you?.throwFx;
    if (fx && (!prevFx || fx.seq !== prevFx.seq)) {
      if (fx.type === 'crash') this._spawnCrashBounceFx(fx);
      else if (fx.type === 'stick' && fx.appleBonus) this._spawnAppleBonusFx(fx.impactAngle);
    }

    this.state = state;
    this._syncMarkers();
    this._renderText();

    const prevStuck = previous?.you?.stage?.stuckStickers?.length || 0;
    const nextStuck = state?.you?.stage?.stuckStickers?.length || 0;
    if (nextStuck > prevStuck) {
      this._playBoardHit();
      if (this.pendingThrows > 0) this.pendingThrows -= 1;
      this._showFeedback('STICK!', 'hit');
    }

    const crashedNow = !!state?.you?.crashed;
    const crashedBefore = !!previous?.you?.crashed;
    if (crashedNow && !crashedBefore) {
      this._playBoardCrash();
      this.pendingThrows = 0;
      this._showFeedback('CRASH!', 'crash');
    }

    const prevStage = previous?.you?.stageIndex ?? 0;
    const nextStage = state?.you?.stageIndex ?? 0;
    if (nextStage > prevStage) {
      if (previous?.you?.stage?.isBoss) {
        this._showFeedback('BOSS DOWN!', 'stage');
      } else {
        this._showFeedback('STAGE CLEAR!', 'stage');
      }
    }
    if (state?.you?.bossSkinUnlocked) {
      try {
        localStorage.setItem('sticker-hit-boss-glow', '1');
      } catch (_e) {
        /* ignore quota / private mode */
      }
    }
    this.prevState = state;
  }

  _renderText() {
    if (!this.state) return;
    const total = this.state.totalStages || 0;
    const myStage = (this.state.you?.stageIndex ?? 0) + 1;
    const oppStage = (this.state.opponent?.stageIndex ?? 0) + 1;

    if (this.progressYouEl) this.progressYouEl.textContent = `${Math.min(myStage, total)}/${total}`;
    if (this.progressOppEl) this.progressOppEl.textContent = `${Math.min(oppStage, total)}/${total}`;
    if (this.targetStageLabelEl) {
      const boss = !!this.state.you?.stage?.isBoss;
      this.targetStageLabelEl.textContent = boss
        ? `BOSS — Stage ${Math.min(myStage, total)} / ${total}`
        : `Stage ${Math.min(myStage, total)} / ${total}`;
    }
    if (this.guideEl) {
      const base = `Race: You ${Math.min(myStage, total)}/${total} vs Opp ${Math.min(oppStage, total)}/${total} | Throw -> gap, sticker hit = crash`;
      const errLine = this._stickerManifestError
        ? ` Sticker art: unavailable (${this._stickerManifestError}).`
        : '';
      this.guideEl.textContent = base + errLine;
    }
    if (this.stagePipsEl) {
      const active = Math.max(0, Math.min(total, myStage));
      this.stagePipsEl.innerHTML = '';
      for (let i = 0; i < total; i += 1) {
        const pip = document.createElement('span');
        pip.className = 'sh-stage-pip';
        pip.dataset.active = i < active ? 'true' : 'false';
        /** Matches server `buildExpandedStageDefinitions`: boss every fifth global stage index (4, 9, …). */
        pip.dataset.boss = i % 5 === 4 ? 'true' : 'false';
        pip.style.backgroundImage = `url("${toBackendAssetUrl(i < active ? KENNEY_ASSETS.pipOn : KENNEY_ASSETS.pipOff)}")`;
        this.stagePipsEl.appendChild(pip);
      }
    }

    if (this.throwBtnEl) {
      this.throwBtnEl.disabled = this.state.phase !== 'playing' || !!this.state.you?.crashed || !!this.state.you?.finished;
    }

    const totalThrows = this.state.you?.stage?.stickersTotal ?? 0;
    const rem = this.state.you?.stage?.stickersRemaining ?? 0;
    const usedThrows = Math.max(0, totalThrows - rem);
    if (this.ammoEl) {
      this.ammoEl.innerHTML = '';
      for (let i = 0; i < totalThrows; i += 1) {
        const dot = document.createElement('span');
        dot.className = 'sh-ammo-dot';
        dot.dataset.spent = i < usedThrows ? 'true' : 'false';
        this.ammoEl.appendChild(dot);
      }
    }
    if (this.applesEl) {
      const y = this.state.you?.apples ?? 0;
      const oy = this.state.opponent?.apples ?? 0;
      this.applesEl.textContent = `🍎 ${y} · opp ${oy}`;
    }

    if (!this.statusEl) return;
    if (this.state.phase === 'countdown') {
      this.statusEl.textContent = 'Get ready...';
    } else if (this.state.you?.crashed) {
      this.statusEl.textContent = 'You crashed on another sticker!';
    } else if (this.state.opponent?.crashed) {
      this.statusEl.textContent = 'Opponent crashed. Nice pressure!';
    } else if (this.state.you?.finished) {
      this.statusEl.textContent = 'All stages cleared!';
    } else if (this.state.opponent?.finished) {
      this.statusEl.textContent = 'Opponent cleared all stages.';
    } else {
      const left = this.state.you?.stage?.stickersRemaining ?? 0;
      this.statusEl.textContent = `${left} sticker${left === 1 ? '' : 's'} left this stage`;
    }

    this._renderGhostDisc();
    if (this.storeModalEl && !this.storeModalEl.hidden) {
      this._refreshStoreUI();
    }
  }

  _renderGhostDisc() {
    if (!this.ghostDiscEl || !this.state?.opponent?.stage) return;
    const s = this.state.opponent.stage;
    const obs = (s.obstacleStickers || []).map((x) => `${x.angle}:${x.kind || 'knife'}:${x.stickerSeed}`).join(',');
    const stuck = (s.stuckStickers || []).map((x) => `${x.angle}:${x.stickerSeed}`).join(',');
    const apples = (s.ringApples || []).map((a) => `${a.angle}:${a.id}`).join(',');
    const sig = `${s.stageIndex}|${obs}|${stuck}|${apples}`;
    if (sig === this._lastGhostSig) return;
    this._lastGhostSig = sig;
    this.ghostDiscEl.innerHTML = '';
    const addDot = (angleDeg, cls) => {
      const dot = document.createElement('span');
      dot.className = `sh-ghost-dot ${cls}`;
      dot.style.setProperty('--a', `${Number(angleDeg)}deg`);
      this.ghostDiscEl.appendChild(dot);
    };
    (s.obstacleStickers || []).forEach((o) => {
      addDot(o.angle, o.kind === 'spike' ? 'sh-ghost-spike' : 'sh-ghost-knife');
    });
    (s.stuckStickers || []).forEach((x) => addDot(x.angle, 'sh-ghost-stuck'));
    (s.ringApples || []).forEach((a) => addDot(a.angle, 'sh-ghost-apple'));
  }

  tick() {
    const nowRef = this._approxServerNow();
    if (this.state?.you?.stage?.timeline && this.targetGroup) {
      const rot = targetRotationDeg(this.state.you.stage.timeline, nowRef);
      this.targetGroup.rotation.z = THREE.MathUtils.degToRad(rot);
    }
    if (this.ghostDiscEl && this.state?.opponent?.stage?.timeline) {
      const gr = targetRotationDeg(this.state.opponent.stage.timeline, nowRef);
      this.ghostDiscEl.style.transform = `rotate(${gr}deg)`;
    }
  }

  update(dt = 0.016) {
    this.timeMs += dt * 1000;
    this.tick();

    const now = performance.now();
    if (this.targetMesh) {
      if (now < this.targetPulseUntil) {
        const t = (this.targetPulseUntil - now) / 160;
        const s = 1 + (0.1 * t);
        this.targetGroup.scale.set(s, s, s);
      } else {
        this.targetGroup.scale.lerp(new THREE.Vector3(1, 1, 1), Math.min(1, dt * 12));
      }
    }

    if (this.camera && now < this.cameraShakeUntil) {
      const s = (this.cameraShakeUntil - now) / 320;
      this.camera.position.x = (Math.sin(now * 0.09) * 0.18 * s);
    } else if (this.camera) {
      this.camera.position.x += (0 - this.camera.position.x) * Math.min(1, dt * 8);
    }

    const wx = GAME_CONFIG.THROW_WOBBLE_X ?? 0.14;
    const wy = GAME_CONFIG.THROW_WOBBLE_Y ?? 0.32;

    if (this.targetGroup) this.targetGroup.updateMatrixWorld(true);

    this.projectiles = this.projectiles.filter((p) => {
      const t = Math.min(1, (now - p.startedAt) / p.durationMs);
      const eased = 1 - ((1 - t) ** 3);
      const endWorld = p.impactAngleDeg !== null && p.impactAngleDeg !== undefined
        ? this._rimWorldAtAngle(p.impactAngleDeg)
        : new THREE.Vector3(0, 0.6 + TARGET_RADIUS, 0.6);
      p.sprite.position.lerpVectors(p.start, endWorld, eased);
      p.sprite.position.x += Math.sin(t * Math.PI) * wx;
      p.sprite.position.y += Math.sin(t * Math.PI) * wy;
      p.sprite.scale.setScalar(0.95 + (Math.sin(t * Math.PI) * 0.24));
      p.sprite.material.rotation += dt * 16;
      if (t >= 1) {
        this.scene.remove(p.sprite);
        this._spawnImpactFx();
        return false;
      }
      return true;
    });
  }

  _disposeThreeResources() {
    this.projectiles.forEach((p) => {
      p.sprite.removeFromParent();
      const m = p.sprite.material;
      if (m) {
        m.map = null;
        m.dispose();
      }
    });
    this.projectiles = [];

    this.markerSprites.forEach((s) => {
      this.targetGroup?.remove(s);
      const m = s.material;
      if (m) {
        m.map = null;
        m.dispose();
      }
    });
    this.markerSprites = [];

    for (const tex of this.textureCache.values()) {
      tex.dispose();
    }
    this.textureCache.clear();

    if (this.scene) {
      this.scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        const mats = obj.material ? (Array.isArray(obj.material) ? obj.material : [obj.material]) : [];
        for (const mat of mats) {
          mat.map = null;
          mat.dispose();
        }
      });
    }

    this.scene = null;
    this.camera = null;
    this.targetGroup = null;
    this.targetMesh = null;
    this.targetOverlayMesh = null;
  }

  destroy() {
    EventBus.off('sticker-hit:state', this._onState);
    window.removeEventListener('keydown', this._onKeyDown);
    this.sceneManager.renderer?.domElement.removeEventListener('pointerdown', this._onCanvasTap);
    if (this.throwBtnEl) this.throwBtnEl.removeEventListener('click', this._onShoot);
    if (this.storeBtnEl) this.storeBtnEl.removeEventListener('click', this._onStoreOpen);
    if (this.storeCloseEl) this.storeCloseEl.removeEventListener('click', this._onStoreClose);
    if (this.storeBackdropEl) this.storeBackdropEl.removeEventListener('click', this._onStoreClose);
    if (this.storeListEl) this.storeListEl.removeEventListener('click', this._onStoreListClick);
    if (this.equipNoneBtn) this.equipNoneBtn.removeEventListener('click', this._onEquipNone);
    if (this.equipBossBtn) this.equipBossBtn.removeEventListener('click', this._onEquipBoss);
    this._closeStoreModal();
    this.sceneManager.onUpdate = null;
    this._disposeThreeResources();
    const aspect = window.innerWidth / Math.max(1, window.innerHeight);
    const placeholder = new THREE.Scene();
    placeholder.background = new THREE.Color(0x1a1a2e);
    const cam = new THREE.PerspectiveCamera(42, aspect, 0.1, 100);
    cam.position.set(0, 0, 5);
    this.sceneManager.setScene(placeholder, cam);
    this.rootEl?.remove();
    this.rootEl = null;
  }
}

