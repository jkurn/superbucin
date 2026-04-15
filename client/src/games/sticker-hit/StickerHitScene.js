import * as THREE from 'three';
import { EventBus } from '../../shared/EventBus.js';
import { reboundHeadingDegFromImpact, resolveThrowAgainstDisc } from '../../../../shared/sticker-hit/throwResolve.js';
import { currentSegmentDps, normalizeDeg, targetRotationDeg } from '../../../../shared/sticker-hit/timeline.js';
import { GAME_CONFIG } from './config.js';
import { isStickerHitKnifeFocusMode } from './knifeFocusMode.js';
import {
  DEFAULT_STICKER_MANIFEST_TIMEOUT_MS,
  fetchStickerManifest,
  toBackendAssetUrl as stickerManifestAssetUrl,
} from './stickerManifest.js';

/* All wheel/knife/pip art is now drawn procedurally via CanvasTexture
 * (`_treeRingTexture`, `_knifeTexture`, `_emojiTexture`) and pure CSS, so the
 * Kenney PNG paths that used to live here are no longer needed. Removing the
 * indirection makes the scene self-contained — no cross-origin asset
 * dependency in dev, no startup texture-loader latency in prod. */

/**
 * Knife Hit reads as a 2D circular wheel viewed dead-on. We use a thin 3D disc
 * (cylinder with negligible depth) so lighting still works, but presentation is
 * flat — no Saturn-ring torus, no tilt — and rim sprites poke OUT past the rim
 * the way real Knife Hit knives do.
 */
const TARGET_RADIUS = 2.6;
/** Disc thickness — kept thin so the side wall barely shows when viewed dead-on. */
const LOG_BODY_HEIGHT = 0.18;
/** Sprites sit just in front of the cap facing the camera. */
const LOG_RIM_Z = LOG_BODY_HEIGHT / 2 + 0.04;
/** No tilt — Knife Hit views the wheel head-on so apples / blades read symmetrically. */
const LOG_PRESENTATION_TILT_X = 0;

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
    this.raceMiniEl = null;
    this.manifestWarnEl = null;
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
    /** URL `?knifeFocus=1` — minimal chrome for knife-first play (client-only). */
    this.knifeFocus = isStickerHitKnifeFocusMode();

    this._onState = (s) => this.applyState(s);
    this._onShoot = () => this.shoot();
    this._onKeyDown = (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        this.shoot();
      }
    };
    this._onCanvasTap = () => this.shoot();
    /** Tap-anywhere-to-throw on the scene layer (Knife Hit convention).
     *  Skip taps on buttons/links and on dismissable popups so we don't double-fire. */
    this._onOverlayTap = (e) => {
      const t = e.target;
      if (!t || typeof t.closest !== 'function') return;
      if (t.closest('button') || t.closest('a')) return;
      if (t.closest('.sh-store-modal')) return;
      if (t.closest('.sh-boss-popup')) return;
      this.shoot();
    };
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
    this._onBossPopupEquip = () => {
      this.network.sendGameAction({ type: 'sticker-equip-skin', skinId: 'boss_glow' });
      this._closeBossPopup();
    };
    this._onBossPopupSkip = () => this._closeBossPopup();
    this._bossPopupShown = false;
  }

  init() {
    this._initThreeScene();
    this.rootEl = document.createElement('div');
    this.rootEl.className = 'sh-layer';
    this.rootEl.innerHTML = `
      <!-- Top center: prominent stage label (US07) -->
      <div class="sh-stage-banner" aria-live="polite">
        <div class="sh-stage-label" id="sh-stage-label">Stage 1</div>
        <div class="sh-stage-pips" id="sh-stage-pips"></div>
      </div>
      <!-- Top-right: apple currency + skins (US08) -->
      <div class="sh-top-dock">
        <div class="sh-apples" id="sh-apples" title="Apples this match">🍎 0</div>
        <button class="btn btn-small sh-store-btn" id="sh-store-btn" type="button">Skins</button>
      </div>
      <!-- Knife Hit reference has zero chrome between the stage banner and the
           wheel: no drop-line, no speed text. Direction + rhythm read from the
           wheel rotating + the knives already embedded. -->
      <span id="sh-spin-speed" hidden></span>
      <!-- Bottom-left: ammo stack — one knife icon per remaining throw (US06) -->
      <div class="sh-ammo-stack" aria-label="Throws remaining this stage">
        <span class="sh-ammo-count" id="sh-ammo-count">—</span>
        <div class="sh-ammo" id="sh-ammo"></div>
      </div>
      <!-- Bottom-center: NEXT sticker preview = the thrower position. Tap anywhere to throw. -->
      <div class="sh-thrower" aria-hidden="true">
        <div class="sh-thrower__label">TAP ANYWHERE TO THROW</div>
        <div class="sh-thrower__thumb" id="sh-next-sticker-thumb">
          <span class="sh-next-sticker__fallback">🏷️</span>
        </div>
      </div>
      <!-- Center: feedback burst (THROW! / STICK! / CRASH! / BOSS DOWN!) -->
      <div class="sh-feedback" id="sh-feedback"></div>
      <!-- Boss-defeat overlay popup (US10/US11) -->
      <div class="sh-boss-popup" id="sh-boss-popup" hidden>
        <div class="sh-boss-popup__card">
          <div class="sh-boss-popup__title">BOSS DOWN!</div>
          <div class="sh-boss-popup__sub">Exclusive Boss Glow unlocked</div>
          <div class="sh-boss-popup__skin">✨🏷️✨</div>
          <div class="sh-boss-popup__row">
            <button class="btn btn-pink" id="sh-boss-popup-equip" type="button">EQUIP</button>
            <button class="btn btn-small" id="sh-boss-popup-skip" type="button">Skip</button>
          </div>
        </div>
      </div>
      <!-- Hidden test-only DOM (preserves selectors used by acceptance tests) -->
      <div class="sh-side" hidden>
        <div class="sh-progress-value" id="sh-you-progress">0/0</div>
        <div class="sh-progress-value" id="sh-opp-progress">0/0</div>
        <div class="sh-ghost-disc" id="sh-ghost-disc" aria-hidden="true"></div>
      </div>
      <p class="sh-manifest-warn" id="sh-manifest-warn" hidden></p>
      <div class="sh-race-mini" id="sh-race-mini" hidden></div>
      <div class="sh-status" id="sh-scene-status" hidden></div>
      <!-- Throw is invoked by tap-anywhere; this button is a hidden no-prose fallback (kept for tests + a11y). -->
      <button class="sh-throw-btn-hidden" id="sh-throw-btn" type="button" aria-label="Throw sticker">Throw</button>
      <footer class="sh-footer" hidden></footer>
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
    if (this.knifeFocus) {
      this.rootEl.setAttribute('data-knife-focus', 'true');
      const footHint = this.rootEl.querySelector('.sh-footer__hint');
      if (footHint) footHint.textContent = 'Tap the board or Space.';
    }
    this.targetStageLabelEl = this.rootEl.querySelector('#sh-stage-label');
    this.raceMiniEl = this.rootEl.querySelector('#sh-race-mini');
    this.manifestWarnEl = this.rootEl.querySelector('#sh-manifest-warn');
    this.statusEl = this.rootEl.querySelector('#sh-scene-status');
    this.feedbackEl = this.rootEl.querySelector('#sh-feedback');
    this.progressYouEl = this.rootEl.querySelector('#sh-you-progress');
    this.progressOppEl = this.rootEl.querySelector('#sh-opp-progress');
    this.stagePipsEl = this.rootEl.querySelector('#sh-stage-pips');
    this.throwBtnEl = this.rootEl.querySelector('#sh-throw-btn');
    this.ammoEl = this.rootEl.querySelector('#sh-ammo');
    this.ammoCountEl = this.rootEl.querySelector('#sh-ammo-count');
    this.applesEl = this.rootEl.querySelector('#sh-apples');
    this.storeBtnEl = this.rootEl.querySelector('#sh-store-btn');
    this.storeModalEl = this.rootEl.querySelector('#sh-store-modal');
    this.storeCloseEl = this.rootEl.querySelector('#sh-store-close');
    this.storeBackdropEl = this.rootEl.querySelector('#sh-store-backdrop');
    this.storeListEl = this.rootEl.querySelector('#sh-store-list');
    this.ghostDiscEl = this.rootEl.querySelector('#sh-ghost-disc');
    this.equipNoneBtn = this.rootEl.querySelector('#sh-equip-none');
    this.equipBossBtn = this.rootEl.querySelector('#sh-equip-boss');
    this.spinIndicatorEl = this.rootEl.querySelector('.sh-spin-indicator');
    this.spinSpeedEl = this.rootEl.querySelector('#sh-spin-speed');
    this.nextStickerThumbEl = this.rootEl.querySelector('#sh-next-sticker-thumb');
    this.bossPopupEl = this.rootEl.querySelector('#sh-boss-popup');
    this.bossPopupEquipBtn = this.rootEl.querySelector('#sh-boss-popup-equip');
    this.bossPopupSkipBtn = this.rootEl.querySelector('#sh-boss-popup-skip');
    /** Next sticker to throw (shown in the NEXT preview and used by `shoot`). */
    this._nextSticker = null;

    this.throwBtnEl?.addEventListener('click', this._onShoot);
    this.rootEl.addEventListener('pointerdown', this._onOverlayTap);
    this.storeBtnEl?.addEventListener('click', this._onStoreOpen);
    this.storeCloseEl?.addEventListener('click', this._onStoreClose);
    this.storeBackdropEl?.addEventListener('click', this._onStoreClose);
    this.storeListEl?.addEventListener('click', this._onStoreListClick);
    this.equipNoneBtn?.addEventListener('click', this._onEquipNone);
    this.equipBossBtn?.addEventListener('click', this._onEquipBoss);
    this.bossPopupEquipBtn?.addEventListener('click', this._onBossPopupEquip);
    this.bossPopupSkipBtn?.addEventListener('click', this._onBossPopupSkip);
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
    // Knife Hit signature: solid dark teal/navy backdrop.
    this.scene.background = new THREE.Color(0x0d1a2c);
    const aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(38, aspect, 0.1, 100);
    // Pull camera dead-on so the wheel reads as a clean circle. Distance is
    // computed by `_fitCameraToWheel` so the wheel takes ~65 % of the shorter
    // viewport dimension on both portrait and landscape aspects.
    this.camera.position.set(0, 0, 12);
    this.camera.lookAt(0, 0, 0);
    // Re-fit camera after the SceneManager resizes things on bind.
    setTimeout(() => this._fitCameraToWheel(), 0);
    window.addEventListener('resize', this._onResizeFit = () => this._fitCameraToWheel());
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.85));
    const key = new THREE.DirectionalLight(0xfff2cc, 0.7);
    key.position.set(2.5, 4, 6.2);
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(0xb8d4ff, 0.35);
    fill.position.set(-3, -2, 4);
    this.scene.add(fill);

    // Subtle radial-feeling gradient backdrop using two stacked planes.
    const bgPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(22, 32),
      new THREE.MeshBasicMaterial({ color: 0x152846, transparent: true, opacity: 0.55 }),
    );
    bgPlane.position.set(0, 0, -3);
    this.scene.add(bgPlane);
    const bgGlow = new THREE.Mesh(
      new THREE.CircleGeometry(5.5, 48),
      new THREE.MeshBasicMaterial({ color: 0x1d3a5e, transparent: true, opacity: 0.55 }),
    );
    bgGlow.position.set(0, 0, -2.4);
    this.scene.add(bgGlow);

    this.targetGroup = new THREE.Group();
    this.scene.add(this.targetGroup);
    this.targetGroup.position.set(0, 0, 0);
    this.targetGroup.rotation.x = LOG_PRESENTATION_TILT_X;

    const targetGeom = new THREE.CylinderGeometry(TARGET_RADIUS, TARGET_RADIUS, LOG_BODY_HEIGHT, 96);
    // Cylinder has 3 material slots: [side, top, bottom]. After `rotation.x = PI/2`
    // the +Y cap (slot 1) becomes the +Z front face visible to the camera, so
    // the bullseye texture on the top cap makes the wheel read as a target.
    const sideMat = new THREE.MeshStandardMaterial({
      color: 0x7a4a1f,
      roughness: 0.7,
      metalness: 0.04,
    });
    const capFrontMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.55,
      metalness: 0.04,
      emissive: 0x302010,
      emissiveIntensity: 0.35,
    });
    // Wheel face uses a procedural tree-ring CanvasTexture that matches the
    // Knife Hit reference (concentric light/dark rings). Same-origin canvas
    // draw, no CORS issues.
    capFrontMat.map = this._treeRingTexture();
    capFrontMat.needsUpdate = true;
    const capBackMat = sideMat.clone();
    this.targetMesh = new THREE.Mesh(targetGeom, [sideMat, capFrontMat, capBackMat]);
    this.targetMesh.rotation.x = Math.PI / 2;
    this.targetGroup.add(this.targetMesh);

    // Thin rim accent — replaces the old Saturn-style torus with a flat dark
    // ring that just outlines the wheel edge.
    const rim = new THREE.Mesh(
      new THREE.RingGeometry(TARGET_RADIUS + 0.005, TARGET_RADIUS + 0.18, 96),
      new THREE.MeshBasicMaterial({ color: 0x0a1320, side: THREE.DoubleSide }),
    );
    rim.position.z = LOG_BODY_HEIGHT / 2 + 0.005;
    this.targetGroup.add(rim);

    this.targetOverlayMesh = null;

    this.sceneManager.setScene(this.scene, this.camera);
  }

  _loadTexture(src, onLoad = null) {
    const url = toBackendAssetUrl(src);
    if (this.textureCache.has(url)) {
      const cached = this.textureCache.get(url);
      // Fire callback on next tick if already loaded so callers can rebind maps.
      if (onLoad && cached?.image?.complete) {
        Promise.resolve().then(() => { try { onLoad(cached); } catch (_e) { /* noop */ } });
      } else if (onLoad && cached) {
        cached.userData = cached.userData || {};
        const prev = cached.userData._onLoad;
        cached.userData._onLoad = (t) => {
          if (prev) try { prev(t); } catch (_e) { /* noop */ }
          try { onLoad(t); } catch (_e) { /* noop */ }
        };
      }
      return cached;
    }
    const texture = this.textureLoader.load(
      url,
      (t) => { try { texture.userData?._onLoad?.(t); onLoad?.(t); } catch (_e) { /* noop */ } },
      undefined,
      () => { /* load error — silent; caller's emoji fallback already shown */ },
    );
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.userData = {};
    this.textureCache.set(url, texture);
    return texture;
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
      return new THREE.Vector3(0, 0.62 + TARGET_RADIUS * 0.96, LOG_RIM_Z);
    }
    const rad = (Number(impactAngleDeg) * Math.PI) / 180;
    const local = new THREE.Vector3(
      Math.sin(rad) * TARGET_RADIUS * 0.96,
      Math.cos(rad) * TARGET_RADIUS * 0.96,
      LOG_RIM_Z,
    );
    return local.applyMatrix4(this.targetGroup.matrixWorld);
  }

  _updateShooterSticker() {
    // Pick the *next* sticker that `shoot` will use, and render it in the preview
    // card so the player has feedback on what's coming.
    const sticker = this._pickRandomSticker();
    if (sticker) {
      this._nextSticker = sticker;
      this._lastShooterSticker = sticker;
    } else {
      this._nextSticker = null;
    }
    this._renderNextSticker();
  }

  _renderNextSticker() {
    if (!this.nextStickerThumbEl) return;
    const sticker = this._nextSticker;
    if (sticker?.src) {
      const url = toBackendAssetUrl(sticker.src.replace(backendOrigin(), ''));
      this.nextStickerThumbEl.style.backgroundImage = `url("${url}")`;
      this.nextStickerThumbEl.dataset.hasThumb = 'true';
    } else {
      this.nextStickerThumbEl.style.backgroundImage = '';
      this.nextStickerThumbEl.dataset.hasThumb = 'false';
    }
  }

  shoot() {
    if (!this.state) return;
    if (Date.now() < this.throwCooldownUntil) return;
    if (this.state.phase !== 'playing') return;
    if (this.state.you?.crashed || this.state.you?.finished) return;

    this.throwCooldownUntil = Date.now() + 160;
    this.pendingThrows += 1;
    const flightMs = GAME_CONFIG.THROW_FLIGHT_MS ?? 520;
    this.network.sendGameAction({ type: 'throw-sticker', flightMs });
    this._playThrowAnim(flightMs, this._nextSticker);
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

  _playThrowAnim(flightMs, queuedSticker = null) {
    // Projectile is a red-handled knife sprite (matches Knife Hit thrower).
    // Equipped skins tint the handle so cosmetics remain legible.
    const eq = this.state?.you?.equippedSkinId;
    const goldGlow = eq === 'boss_glow' || ((eq === null || eq === undefined) && !!this.state?.you?.bossSkinUnlocked);
    const handleHex = eq === 'trail_pink' ? 0xff6eb4
      : eq === 'sparkle_blue' ? 0x66b3ff
      : goldGlow ? 0xffd700
      : 0xd24a4a;
    const mat = new THREE.SpriteMaterial({ color: 0xffffff, transparent: true });
    const sprite = new THREE.Sprite(mat);
    // Knife sprites are tall + narrow (aspect 0.42). Scale 1.4 reads at the
    // right size against a TARGET_RADIUS=2.6 wheel.
    sprite.scale.set(1.4 * 0.42, 1.4, 1);
    // Start offscreen below the wheel, directly beneath the rim-top (+Y axis)
    // so the flight is purely vertical.
    const startY = -TARGET_RADIUS * 1.6;
    sprite.position.set(0, startY, LOG_RIM_Z + 0.04);
    mat.map = this._knifeTexture(handleHex);
    mat.needsUpdate = true;
    const queuedArt = queuedSticker || this._lastShooterSticker || null;
    // If a manifest sticker is available, overlay it (loads async). Left as a
    // callback swap so the knife is always visible up front.
    if (queuedArt?.src) {
      const url = queuedArt.src.replace(backendOrigin(), '');
      const tex = this._loadTexture(url, () => { mat.map = tex; mat.needsUpdate = true; });
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
      start: new THREE.Vector3(0, startY, LOG_RIM_Z + 0.04),
      impactAngleDeg,
    });
  }

  _spawnImpactFx(impactAngleDeg) {
    const burst = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 10, 10),
      new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.95 }),
    );
    // Impact always lands at the world bottom of the rim. Using `_rimWorldAtAngle`
    // with the impact disc-local angle also works because the disc rotation
    // places that sprite at the world-bottom point.
    const pos =
      impactAngleDeg !== null && impactAngleDeg !== undefined
        ? this._rimWorldAtAngle(impactAngleDeg)
        : new THREE.Vector3(0, -TARGET_RADIUS * 0.98, LOG_RIM_Z);
    burst.position.copy(pos);
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

  _openBossPopup() {
    if (!this.bossPopupEl || this._bossPopupShown) return;
    this._bossPopupShown = true;
    this.bossPopupEl.hidden = false;
    // Auto-dismiss after 6s if user doesn't interact, so a missed tap doesn't
    // leave the popup blocking the next stage forever.
    if (this._bossPopupTimer) clearTimeout(this._bossPopupTimer);
    this._bossPopupTimer = setTimeout(() => this._closeBossPopup(), 6000);
  }

  _closeBossPopup() {
    if (this.bossPopupEl) this.bossPopupEl.hidden = true;
    this._bossPopupShown = false;
    if (this._bossPopupTimer) {
      clearTimeout(this._bossPopupTimer);
      this._bossPopupTimer = null;
    }
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
    const origin = new THREE.Vector3(0, 0, LOG_RIM_Z * 0.35);
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
      LOG_RIM_Z + 0.02,
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
      LOG_RIM_Z + 0.08,
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

    const makeStickerSprite = (sticker, angleDeg, opts) => {
      const {
        tint = 0xffffff,
        emoji = '🏷️',
        scale = 0.78,
        /** Kenney asset URL used directly (obstacles + stuck fallback). Overrides sticker/emoji when set. */
        kenneyUrl = null,
        /** Procedural knife CanvasTexture (handle color). Takes precedence over kenneyUrl/sticker. */
        knifeHandleHex = null,
        /** Rotate sprite art so blades visually point outward from the rim. */
        orientOutward = false,
        /** How far the sprite center sits from the disc center, in radius units. */
        radialOffset = 1.0,
        /** Independent x/y scale factor so knife sprites render tall + narrow like real knives. */
        aspect = 1.0,
      } = opts || {};
      const mat = new THREE.SpriteMaterial({ color: 0xffffff, transparent: true, opacity: 1 });
      const sprite = new THREE.Sprite(mat);
      sprite.scale.set(scale * aspect, scale, 1);
      const rad = (angleDeg * Math.PI) / 180;
      const r = TARGET_RADIUS * radialOffset;
      sprite.position.set(Math.sin(rad) * r, Math.cos(rad) * r, LOG_RIM_Z);
      if (knifeHandleHex !== null) {
        // Procedural knife — no network dependency, always crisp.
        mat.map = this._knifeTexture(knifeHandleHex);
        mat.needsUpdate = true;
      } else {
        // Canvas-rendered emoji shows instantly; loader upgrades it when a
        // real texture arrives (Kenney PNG same-origin in prod, manifest
        // sticker, etc).
        mat.map = this._emojiTexture(emoji, tint);
        mat.needsUpdate = true;
        const swapInWhenLoaded = (url) => {
          if (!url) return;
          const tex = this._loadTexture(url, () => {
            mat.map = tex;
            mat.needsUpdate = true;
          });
        };
        if (kenneyUrl) swapInWhenLoaded(kenneyUrl);
        else if (sticker?.src) swapInWhenLoaded(sticker.src.replace(backendOrigin(), ''));
      }
      // Per-frame tick() will update `material.rotation` for orientable sprites
      // using disc_local + current spin offset, so the blade stays pointing
      // INTO the centre as the disc rotates (handle OUT, blade IN).
      sprite.userData = {
        discLocalDeg: angleDeg,
        orientOutward,
      };
      if (orientOutward) {
        // Set the initial rotation so the sprite appears correctly before the
        // first tick lands — using the current disc rotation if available.
        const rotDeg = this._currentRotDeg || 0;
        const targetDeg = -(angleDeg + rotDeg + 90);
        mat.rotation = (targetDeg * Math.PI) / 180;
      }
      return sprite;
    };

    const makeAppleSprite = (angleDeg) => {
      const mat = new THREE.SpriteMaterial({ color: 0xffffff, transparent: true, opacity: 1 });
      const sprite = new THREE.Sprite(mat);
      sprite.scale.set(0.55, 0.55, 1);
      const rad = (angleDeg * Math.PI) / 180;
      // Apples sit just INSIDE the rim — Knife Hit places them on the wood, not
      // floating off the edge.
      sprite.position.set(
        Math.sin(rad) * TARGET_RADIUS * 0.86,
        Math.cos(rad) * TARGET_RADIUS * 0.86,
        LOG_RIM_Z + 0.04,
      );
      mat.map = this._emojiTexture('🍎', 0xff5555);
      mat.needsUpdate = true;
      return sprite;
    };

    (stage.obstacleStickers || []).forEach((item) => {
      const isSpike = item.kind === 'spike';
      // Pre-placed hazards render as WOOD-handled knives — distinct from the
      // player's red throws — matching the Knife Hit reference screenshots.
      const sprite = makeStickerSprite(null, item.angle, {
        knifeHandleHex: isSpike ? 0x6b4a2a : 0x8a5a2b,
        scale: 1.4,
        aspect: 0.42,
        orientOutward: true,
        radialOffset: 1.18,
      });
      this.targetGroup.add(sprite);
      this.markerSprites.push(sprite);
    });
    (stage.stuckStickers || []).forEach((item) => {
      const sticker = this._stickerForSeed(item.stickerSeed);
      const hasSticker = !!sticker?.src;
      if (hasSticker) {
        // Cosmetic manifest sticker: overlay flat on the wheel at near-rim.
        const sprite = makeStickerSprite(sticker, item.angle, {
          tint: 0x9dffd0,
          emoji: '🏷️',
          scale: 0.85,
          orientOutward: false,
          radialOffset: 0.96,
        });
        this.targetGroup.add(sprite);
        this.markerSprites.push(sprite);
      } else {
        // Player's stuck throws default to red-handled knives poking out past
        // the rim — matches Knife Hit reference.
        const sprite = makeStickerSprite(null, item.angle, {
          knifeHandleHex: 0xd24a4a,
          scale: 1.4,
          aspect: 0.42,
          orientOutward: true,
          radialOffset: 1.18,
        });
        this.targetGroup.add(sprite);
        this.markerSprites.push(sprite);
      }
    });
    (stage.ringApples || []).forEach((a) => {
      const sprite = makeAppleSprite(a.angle);
      this.targetGroup.add(sprite);
      this.markerSprites.push(sprite);
    });
  }

  /**
   * Build a CanvasTexture that paints the classic Knife Hit tree-ring wheel
   * face: a warm yellow base with darker concentric rings. Cached once so
   * repeated material updates don't re-paint.
   */
  _treeRingTexture() {
    const key = 'treeRing:v1';
    if (this.textureCache.has(key)) return this.textureCache.get(key);
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext?.('2d');
    if (!ctx) {
      // jsdom (test env) has no 2D context — return an empty texture so scene
      // construction succeeds without crashing.
      const emptyTex = new THREE.CanvasTexture(canvas);
      this.textureCache.set(key, emptyTex);
      return emptyTex;
    }
    const cx = size / 2;
    const cy = size / 2;
    // Base disc
    ctx.fillStyle = '#fce5a0';
    ctx.beginPath();
    ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
    ctx.fill();
    // Concentric rings, alternating subtle light/dark bands
    const ringCount = 7;
    for (let i = ringCount; i >= 1; i -= 1) {
      const frac = i / ringCount;
      const r = (size / 2) * frac;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = i % 2 === 0 ? '#f0c878' : '#ffe6a8';
      ctx.fill();
    }
    // Thin dark pith dot in the center (the "tree core")
    ctx.fillStyle = 'rgba(120, 70, 20, 0.45)';
    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.015, 0, Math.PI * 2);
    ctx.fill();
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    this.textureCache.set(key, texture);
    return texture;
  }

  /**
   * Build a CanvasTexture that looks like a Knife Hit knife: small silver
   * blade on top, red/wood handle on bottom. Used as the projectile art + the
   * stuck-sticker default so we don't depend on the CORS-gated Kenney PNGs.
   */
  _knifeTexture(handleHex = 0xd24a4a) {
    const key = `knife:${handleHex.toString(16)}:v2`;
    if (this.textureCache.has(key)) return this.textureCache.get(key);
    const w = 96;
    const h = 256;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext?.('2d');
    if (!ctx) {
      const emptyTex = new THREE.CanvasTexture(canvas);
      this.textureCache.set(key, emptyTex);
      return emptyTex;
    }
    // Blade (upper half)
    const bladeGrad = ctx.createLinearGradient(0, 0, w, 0);
    bladeGrad.addColorStop(0, '#cfe6ff');
    bladeGrad.addColorStop(0.5, '#ffffff');
    bladeGrad.addColorStop(1, '#9bb9d8');
    ctx.fillStyle = bladeGrad;
    // Blade shape: tapered triangle
    ctx.beginPath();
    ctx.moveTo(w / 2, 6);
    ctx.lineTo(w * 0.82, h * 0.55);
    ctx.lineTo(w * 0.18, h * 0.55);
    ctx.closePath();
    ctx.fill();
    // Blade highlight stripe
    ctx.strokeStyle = 'rgba(120, 160, 210, 0.55)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(w / 2, 12);
    ctx.lineTo(w / 2, h * 0.52);
    ctx.stroke();
    // Cross-guard (dark line between blade & handle)
    ctx.fillStyle = '#26202b';
    ctx.fillRect(w * 0.12, h * 0.55, w * 0.76, 10);
    // Handle
    const hex = handleHex.toString(16).padStart(6, '0');
    ctx.fillStyle = `#${hex}`;
    ctx.fillRect(w * 0.22, h * 0.58, w * 0.56, h * 0.36);
    // Handle pommel circle
    ctx.fillStyle = '#26202b';
    ctx.beginPath();
    ctx.arc(w / 2, h * 0.95, w * 0.16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `#${hex}`;
    ctx.beginPath();
    ctx.arc(w / 2, h * 0.95, w * 0.09, 0, Math.PI * 2);
    ctx.fill();
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    this.textureCache.set(key, texture);
    return texture;
  }

  /**
   * Build a one-off CanvasTexture of an emoji glyph tinted by `tint`.
   * Used when the sticker manifest is unavailable — every rim item still reads
   * as something semantic (blade, spike, apple, stuck sticker) instead of a
   * solid-color blob.
   */
  _emojiTexture(glyph, tintHex) {
    const key = `emoji:${glyph}:${tintHex.toString(16)}`;
    if (this.textureCache.has(key)) return this.textureCache.get(key);
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext?.('2d');
    if (!ctx) {
      const emptyTex = new THREE.CanvasTexture(canvas);
      this.textureCache.set(key, emptyTex);
      return emptyTex;
    }
    const hex = tintHex.toString(16).padStart(6, '0');
    ctx.fillStyle = `#${hex}`;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size * 0.46, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.font = `${Math.round(size * 0.62)}px system-ui, Apple Color Emoji, Segoe UI Emoji, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(glyph, size / 2, size / 2 + 4);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    this.textureCache.set(key, texture);
    return texture;
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
        // Surface the unlock formally with a popup + EQUIP CTA per US10/US11.
        this._openBossPopup();
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
        ? `BOSS · Stage ${Math.min(myStage, total)} / ${total}`
        : `Stage ${Math.min(myStage, total)} / ${total}`;
      this.targetStageLabelEl.dataset.boss = boss ? 'true' : 'false';
    }
    if (this.raceMiniEl) {
      this.raceMiniEl.textContent = `Race · You ${Math.min(myStage, total)}/${total} · Sayang ${Math.min(oppStage, total)}/${total}`;
    }
    if (this.manifestWarnEl) {
      // Manifest failure is non-fatal — the rim has Kenney blade/spike/apple
      // art either way, so keep the warning hidden to avoid HUD noise.
      this.manifestWarnEl.hidden = true;
      this.manifestWarnEl.textContent = '';
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
        // Style-only pip (no image) — avoids cross-origin asset dependency
        // and renders identically in every environment.
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
    if (this.ammoCountEl) {
      this.ammoCountEl.textContent = `${rem}`;
    }
    if (this.applesEl) {
      const y = this.state.you?.apples ?? 0;
      // Per US08: top-right shows the player's own currency only.
      // Opponent count is decorative — it appears in the createHUD pills (for tests).
      this.applesEl.textContent = `🍎 ${y}`;
    }

    if (!this.statusEl) return;
    // Status kept for tests; scene UI is now communicated via feedback burst +
    // the top-marker/spin-indicator/ammo count, not a running prose line.
    if (this.state.phase === 'countdown') {
      this.statusEl.textContent = 'Get ready.';
    } else if (this.state.you?.crashed) {
      this.statusEl.textContent = 'Crashed.';
    } else if (this.state.opponent?.crashed) {
      this.statusEl.textContent = 'Sayang crashed.';
    } else if (this.state.you?.finished) {
      this.statusEl.textContent = 'Cleared!';
    } else if (this.state.opponent?.finished) {
      this.statusEl.textContent = 'Sayang cleared first.';
    } else {
      const left = this.state.you?.stage?.stickersRemaining ?? 0;
      this.statusEl.textContent = `${left} left`;
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
      // Server's fixed impact disc-local angle is `270 − rot`. The client
      // applies an extra `+90°` offset so that fixed world point lands at
      // world compass 180 (bottom of wheel) — where the straight-up thrown
      // knife intersects the rim. Math:
      //   world_compass = disc_local − α_applied
      //   α_applied = (90 − rot)°
      //   → world_compass = (270 − rot) − (90 − rot) = 180  (fixed, ✓)
      this._currentRotDeg = rot;
      this.targetGroup.rotation.z = THREE.MathUtils.degToRad(90 - rot);
      // Keep blade-stuck sprites oriented "handle OUT, blade IN" every frame.
      this._updateRimSpriteOrientations(rot);
    }
    if (this.ghostDiscEl && this.state?.opponent?.stage?.timeline) {
      const gr = targetRotationDeg(this.state.opponent.stage.timeline, nowRef);
      this.ghostDiscEl.style.transform = `rotate(${gr}deg)`;
    }
    this._updateSpinIndicator(nowRef);
  }

  /**
   * Per-frame rotation sync for sprites that should stay radially aligned with
   * the disc (handle pointing OUT from centre, blade pointing IN). Sprites are
   * parented to `targetGroup` so their POSITION rotates with the disc, but
   * three.js Sprites always face the camera — so their in-plane rotation
   * (`material.rotation`) must be updated manually each frame.
   *
   * For a sprite at disc-local `θ` with disc rotation offset `α = (90 − rot)°`:
   *   world_compass = θ − α = θ + rot − 90
   * We want the sprite's "up" (PNG +Y, i.e. the knife handle) to point OUTWARD
   * from the wheel centre — i.e. toward the sprite's world position from (0,0).
   * Sprite rotation formula (three.js sprite.material.rotation is CCW radians):
   *   `rotation = −(world_compass + 180°)` → blade (PNG top) aims INWARD.
   */
  _updateRimSpriteOrientations(rotDeg) {
    if (!this.markerSprites) return;
    for (const sprite of this.markerSprites) {
      const mat = sprite.material;
      if (!mat || !sprite.userData || sprite.userData.orientOutward !== true) continue;
      const discLocalDeg = Number(sprite.userData.discLocalDeg) || 0;
      const targetDeg = -(discLocalDeg + rotDeg + 90);
      mat.rotation = (targetDeg * Math.PI) / 180;
    }
  }

  /**
   * Re-fit the camera distance so the wheel diameter (with rim sprites poking
   * out at radial offset ~1.16) takes about 65 % of the shorter viewport edge,
   * with comfortable margins for the top stage banner + bottom thrower row.
   */
  _fitCameraToWheel() {
    if (!this.camera) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (!w || !h) return;
    const aspect = w / h;
    this.camera.aspect = aspect;
    /** Visible width on screen target = wheelDiameter / `targetFraction`. */
    const wheelDiameter = TARGET_RADIUS * 2 * 1.18; // include knife protrusion
    const targetFractionShort = 0.62;
    const fovRad = (this.camera.fov * Math.PI) / 180;
    const halfH = Math.tan(fovRad / 2);
    // Distance so the wheel fills `targetFractionShort` of the SHORTER edge.
    const requiredVisibleShort = wheelDiameter / targetFractionShort;
    const distFromShort = aspect >= 1
      ? requiredVisibleShort / (2 * halfH) // shorter edge is height
      : requiredVisibleShort / (2 * halfH * aspect); // shorter edge is width
    this.camera.position.z = Math.max(7.5, Math.min(24, distFromShort));
    this.camera.updateProjectionMatrix();
  }

  /**
   * Surface current rotation direction/speed so players can time their tap.
   * Reads the active timeline segment at `nowRef` and animates the chevron ring.
   */
  _updateSpinIndicator(nowRef) {
    const timeline = this.state?.you?.stage?.timeline;
    if (!timeline || !this.spinSpeedEl) return;
    const dps = currentSegmentDps(timeline, nowRef);
    if (dps === 0) {
      this.spinSpeedEl.textContent = 'PAUSED';
    } else {
      this.spinSpeedEl.textContent = `${Math.round(Math.abs(dps))}°/s ${dps >= 0 ? '↻' : '↺'}`;
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

    if (this.targetGroup) this.targetGroup.updateMatrixWorld(true);

    // Knife Hit projectile: purely vertical flight from thrower → BOTTOM of
    // wheel (the rim point closest to the thrower). No wobble, no sprite spin.
    // The wheel rotates during flight; the server resolves which disc-local
    // angle the knife embeds at based on the wheel's rotation at impact.
    this.projectiles = this.projectiles.filter((p) => {
      const t = Math.min(1, (now - p.startedAt) / p.durationMs);
      const eased = 1 - ((1 - t) ** 3);
      const endY = -TARGET_RADIUS * 0.98;
      p.sprite.position.x = 0;
      p.sprite.position.y = p.start.y + (endY - p.start.y) * eased;
      if (t >= 1) {
        this.scene.remove(p.sprite);
        this._spawnImpactFx(p.impactAngleDeg);
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
    this.rootEl?.removeEventListener('pointerdown', this._onOverlayTap);
    if (this.throwBtnEl) this.throwBtnEl.removeEventListener('click', this._onShoot);
    if (this.storeBtnEl) this.storeBtnEl.removeEventListener('click', this._onStoreOpen);
    if (this.storeCloseEl) this.storeCloseEl.removeEventListener('click', this._onStoreClose);
    if (this.storeBackdropEl) this.storeBackdropEl.removeEventListener('click', this._onStoreClose);
    if (this.storeListEl) this.storeListEl.removeEventListener('click', this._onStoreListClick);
    if (this.equipNoneBtn) this.equipNoneBtn.removeEventListener('click', this._onEquipNone);
    if (this.equipBossBtn) this.equipBossBtn.removeEventListener('click', this._onEquipBoss);
    if (this.bossPopupEquipBtn) this.bossPopupEquipBtn.removeEventListener('click', this._onBossPopupEquip);
    if (this.bossPopupSkipBtn) this.bossPopupSkipBtn.removeEventListener('click', this._onBossPopupSkip);
    this._closeStoreModal();
    this._closeBossPopup();
    if (this._onResizeFit) {
      window.removeEventListener('resize', this._onResizeFit);
      this._onResizeFit = null;
    }
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

