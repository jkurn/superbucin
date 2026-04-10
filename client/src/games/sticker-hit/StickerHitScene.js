import * as THREE from 'three';
import { EventBus } from '../../shared/EventBus.js';

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

const THROW_FLIGHT_MS = 420;
const TARGET_RADIUS = 2.05;

function backendOrigin() {
  if (window.location.hostname === 'localhost') return 'http://localhost:3000';
  return window.location.origin;
}

function toBackendAssetUrl(pathname) {
  if (!pathname) return '';
  return `${backendOrigin()}${pathname}`;
}

function normalizeDeg(v) {
  const n = v % 360;
  return n < 0 ? n + 360 : n;
}

function targetRotationDeg(timeline, now = Date.now()) {
  if (!timeline) return 0;
  const elapsed = Math.max(0, now - timeline.startedAt);
  let angle = timeline.initialAngle;
  const segments = timeline.segments || [];
  for (let i = 0; i < segments.length; i += 1) {
    const seg = segments[i];
    const segStart = seg.atMs;
    if (elapsed <= segStart) break;
    const nextStart = segments[i + 1]?.atMs ?? elapsed;
    const segEnd = Math.min(elapsed, nextStart);
    const segElapsed = Math.max(0, segEnd - segStart);
    angle += (seg.dps * segElapsed) / 1000;
    if (segEnd >= elapsed) break;
  }
  return normalizeDeg(angle);
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

async function loadStickerPool() {
  try {
    const res = await fetch(`${backendOrigin()}/api/sticker-hit/sticker-manifest`, { cache: 'no-store' });
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data?.stickers)) return [];
    return data.stickers
      .filter((x) => x && typeof x.src === 'string' && x.src.length > 0)
      .map((x) => ({
        src: toBackendAssetUrl(x.src),
        durationMs: Number.isFinite(x.durationMs) ? Math.max(200, Number(x.durationMs)) : 1200,
      }));
  } catch {
    return [];
  }
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
    this.shooterStickerEl = null;
    this.stickerPool = [];
    this.imageLoopTimers = new Map();
    this.throwCooldownUntil = 0;
    this.lastStageSignature = '';
    this.timeMs = 0;
    this.cameraShakeUntil = 0;
    this.targetPulseUntil = 0;
    this.pendingThrows = 0;

    this._onState = (s) => this.applyState(s);
    this._onShoot = () => this.shoot();
    this._onKeyDown = (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        this.shoot();
      }
    };
    this._onCanvasTap = () => this.shoot();
  }

  init() {
    this._initThreeScene();
    this.rootEl = document.createElement('div');
    this.rootEl.className = 'sh-layer';
    this.rootEl.innerHTML = `
      <div class="sh-wrap">
        <div class="sh-board-wrap">
          <div class="sh-stage-label" id="sh-stage-label">Stage 1</div>
          <div class="sh-stage-pips" id="sh-stage-pips"></div>
          <div class="sh-guide" id="sh-guide">Throw -> land on empty gap. Hit sticker = crash. First to finish all stages wins.</div>
          <div class="sh-status" id="sh-scene-status">Throw sticker to empty spaces. First to clear all stages wins.</div>
          <div class="sh-feedback" id="sh-feedback"></div>
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

    this.throwBtnEl?.addEventListener('click', this._onShoot);
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
    this.stickerPool = await loadStickerPool();
    this._updateShooterSticker();
    this._syncMarkers();
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

  _clearImageLoop(img) {
    const timer = this.imageLoopTimers.get(img);
    if (timer) {
      clearTimeout(timer);
      this.imageLoopTimers.delete(img);
    }
  }

  _scheduleImageLoop(img, durationMs) {
    this._clearImageLoop(img);
    const delay = Math.max(200, Number(durationMs) || 1200);
    const timer = setTimeout(() => {
      if (!img.isConnected || !this.rootEl) {
        this._clearImageLoop(img);
        return;
      }
      const baseSrc = img.dataset.baseSrc;
      if (!baseSrc) {
        this._clearImageLoop(img);
        return;
      }
      const loopSrc = `${baseSrc}${baseSrc.includes('?') ? '&' : '?'}loop=${Date.now()}`;
      img.src = loopSrc;
      this._scheduleImageLoop(img, delay);
    }, delay);
    this.imageLoopTimers.set(img, timer);
  }

  _setLoopingImage(img, sticker) {
    if (!img || !sticker?.src) return;
    img.dataset.baseSrc = sticker.src;
    img.src = sticker.src;
    img.onerror = () => {
      const fallback = this._pickRandomSticker();
      if (!fallback?.src) return;
      img.dataset.baseSrc = fallback.src;
      img.src = fallback.src;
      this._scheduleImageLoop(img, fallback.durationMs);
    };
    this._scheduleImageLoop(img, sticker.durationMs);
  }

  _clearAllImageLoops() {
    for (const timer of this.imageLoopTimers.values()) {
      clearTimeout(timer);
    }
    this.imageLoopTimers.clear();
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
    this.network.sendGameAction({ type: 'throw-sticker', flightMs: THROW_FLIGHT_MS });
    this._playThrowAnim();
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

  _playThrowAnim() {
    const sticker = this._pickRandomSticker() || this._lastShooterSticker || null;
    const mat = new THREE.SpriteMaterial({ color: 0xffffff, transparent: true });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(0.95, 0.95, 1);
    sprite.position.set(0, -3.8, 0.8);
    if (sticker?.src) {
      try {
        mat.map = this._loadTexture(sticker.src.replace(backendOrigin(), ''));
        mat.needsUpdate = true;
      } catch (_e) {
        mat.color.setHex(0xff9a2e);
      }
    } else {
      mat.color.setHex(0xff9a2e);
    }
    this.scene.add(sprite);
    this.projectiles.push({
      sprite,
      startedAt: performance.now(),
      durationMs: THROW_FLIGHT_MS,
      start: new THREE.Vector3(0, -3.8, 0.8),
      end: new THREE.Vector3(0, 0.6 + TARGET_RADIUS, 0.6),
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

  _syncMarkers() {
    if (!this.targetGroup || !this.state?.you?.stage) return;
    const stage = this.state.you.stage;
    const obstacleSig = (stage.obstacleStickers || [])
      .map((x) => `${x.angle}:${x.stickerSeed}`)
      .join(',');
    const stuckSig = (stage.stuckStickers || [])
      .map((x) => `${x.angle}:${x.stickerSeed}`)
      .join(',');
    const sig = `${stage.stageIndex}|${obstacleSig}|${stuckSig}|${this.stickerPool.length}`;
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

    (stage.obstacleStickers || []).forEach((item) => {
      const sticker = this._stickerForSeed(item.stickerSeed);
      const sprite = makeStickerSprite(sticker, item.angle, 0xff8f8f);
      this.targetGroup.add(sprite);
      this.markerSprites.push(sprite);
    });
    (stage.stuckStickers || []).forEach((item) => {
      const sticker = this._stickerForSeed(item.stickerSeed);
      const sprite = makeStickerSprite(sticker, item.angle, 0x9dffd0);
      this.targetGroup.add(sprite);
      this.markerSprites.push(sprite);
    });
  }

  applyState(state) {
    const previous = this.prevState;
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
      this._showFeedback('STAGE CLEAR!', 'stage');
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
    if (this.targetStageLabelEl) this.targetStageLabelEl.textContent = `Stage ${Math.min(myStage, total)} / ${total}`;
    if (this.guideEl) {
      this.guideEl.textContent = `Race: You ${Math.min(myStage, total)}/${total} vs Opp ${Math.min(oppStage, total)}/${total} | Throw -> gap, sticker hit = crash`;
    }
    if (this.stagePipsEl) {
      const active = Math.max(0, Math.min(total, myStage));
      this.stagePipsEl.innerHTML = '';
      for (let i = 0; i < total; i += 1) {
        const pip = document.createElement('span');
        pip.className = 'sh-stage-pip';
        pip.dataset.active = i < active ? 'true' : 'false';
        pip.style.backgroundImage = `url("${toBackendAssetUrl(i < active ? KENNEY_ASSETS.pipOn : KENNEY_ASSETS.pipOff)}")`;
        this.stagePipsEl.appendChild(pip);
      }
    }

    if (this.throwBtnEl) {
      this.throwBtnEl.disabled = this.state.phase !== 'playing' || !!this.state.you?.crashed || !!this.state.you?.finished;
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
      const rem = this.state.you?.stage?.stickersRemaining ?? 0;
      this.statusEl.textContent = `${rem} sticker${rem === 1 ? '' : 's'} left this stage`;
    }
  }

  tick() {
    if (this.state?.you?.stage?.timeline && this.targetGroup) {
      const rot = targetRotationDeg(this.state.you.stage.timeline, Date.now());
      this.targetGroup.rotation.z = THREE.MathUtils.degToRad(rot);
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

    this.projectiles = this.projectiles.filter((p) => {
      const t = Math.min(1, (now - p.startedAt) / p.durationMs);
      const eased = 1 - ((1 - t) ** 3);
      p.sprite.position.lerpVectors(p.start, p.end, eased);
      p.sprite.position.x += Math.sin(t * Math.PI) * 0.42;
      p.sprite.position.y += Math.sin(t * Math.PI) * 0.9;
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

  destroy() {
    EventBus.off('sticker-hit:state', this._onState);
    window.removeEventListener('keydown', this._onKeyDown);
    this.sceneManager.renderer?.domElement.removeEventListener('pointerdown', this._onCanvasTap);
    this._clearAllImageLoops();
    if (this.throwBtnEl) this.throwBtnEl.removeEventListener('click', this._onShoot);
    this.sceneManager.onUpdate = null;
    this.markerSprites.forEach((s) => this.targetGroup?.remove(s));
    this.markerSprites = [];
    this.projectiles.forEach((p) => this.scene?.remove(p.sprite));
    this.projectiles = [];
    this.rootEl?.remove();
    this.rootEl = null;
  }
}

