import { EventBus } from '../../shared/EventBus.js';

const KENNEY_ASSETS = {
  stallBg: '/kenney/shooting-gallery/stall/bg_wood.png',
  targetOverlay: '/kenney/shooting-gallery/objects/target_back.png',
  crosshair: '/kenney/shooting-gallery/hud/crosshair_outline_small.png',
  pipOff: '/kenney/boardgame/pieces-yellow/pieceYellow_border00.png',
  pipOn: '/kenney/boardgame/pieces-yellow/pieceYellow_multi00.png',
};

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

function mkMarker(stickerSrc, angle, className) {
  const el = document.createElement('div');
  el.className = className;
  const rad = (angle * Math.PI) / 180;
  const x = 50 + Math.sin(rad) * 42;
  const y = 50 - Math.cos(rad) * 42;
  el.style.left = `${x}%`;
  el.style.top = `${y}%`;
  el.style.transform = `translate(-50%, -50%) rotate(${angle}deg)`;

  const img = document.createElement('img');
  img.src = stickerSrc;
  img.alt = '';
  img.draggable = false;
  img.loading = 'lazy';
  img.decoding = 'async';
  img.className = 'sh-marker-img';
  el.appendChild(img);
  return el;
}

export class StickerHitScene {
  constructor(sceneManager, network, _ui, gameData) {
    this.sceneManager = sceneManager;
    this.network = network;
    this.gameData = gameData;
    this.rootEl = null;
    this.state = null;
    this.targetRotorEl = null;
    this.targetStageLabelEl = null;
    this.countdownEl = null;
    this.statusEl = null;
    this.progressYouEl = null;
    this.progressOppEl = null;
    this.stagePipsEl = null;
    this.throwBtnEl = null;
    this.shooterStickerEl = null;
    this.stickerPool = [];
    this.imageLoopTimers = new Map();
    this.throwCooldownUntil = 0;
    this.lastStageSignature = '';
    this.raf = null;

    this._onState = (s) => this.applyState(s);
    this._onShoot = () => this.shoot();
    this._onKeyDown = (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        this.shoot();
      }
    };
  }

  init() {
    const canvas = this.sceneManager.renderer?.domElement;
    if (canvas) canvas.style.visibility = 'hidden';

    this.rootEl = document.createElement('div');
    this.rootEl.className = 'sh-layer';
    this.rootEl.innerHTML = `
      <div class="sh-wrap">
        <div class="sh-board-wrap">
          <div class="sh-status" id="sh-scene-status">Tap to throw sticker</div>
          <div class="sh-board" id="sh-board">
            <img class="sh-board-bg" id="sh-board-bg" alt="" draggable="false" />
            <div class="sh-countdown" id="sh-countdown"></div>
            <div class="sh-target-rotor" id="sh-target-rotor">
              <div class="sh-target-core"></div>
              <img class="sh-target-overlay" id="sh-target-overlay" alt="" draggable="false" />
            </div>
            <img class="sh-crosshair" id="sh-crosshair" alt="" draggable="false" />
            <div class="sh-shooter"><img id="sh-shooter-sticker" alt="" draggable="false" /></div>
          </div>
          <div class="sh-stage-label" id="sh-stage-label">Stage 1</div>
          <div class="sh-stage-pips" id="sh-stage-pips"></div>
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
    this.targetRotorEl = this.rootEl.querySelector('#sh-target-rotor');
    this.targetStageLabelEl = this.rootEl.querySelector('#sh-stage-label');
    this.countdownEl = this.rootEl.querySelector('#sh-countdown');
    this.statusEl = this.rootEl.querySelector('#sh-scene-status');
    this.progressYouEl = this.rootEl.querySelector('#sh-you-progress');
    this.progressOppEl = this.rootEl.querySelector('#sh-opp-progress');
    this.stagePipsEl = this.rootEl.querySelector('#sh-stage-pips');
    this.throwBtnEl = this.rootEl.querySelector('#sh-throw-btn');
    this.shooterStickerEl = this.rootEl.querySelector('#sh-shooter-sticker');

    this.throwBtnEl?.addEventListener('click', this._onShoot);
    this.rootEl.querySelector('#sh-board')?.addEventListener('pointerdown', this._onShoot);
    window.addEventListener('keydown', this._onKeyDown);
    EventBus.on('sticker-hit:state', this._onState);

    if (this.gameData?.stickerHitState) {
      this.applyState(this.gameData.stickerHitState);
    }
    this._hydrateKenneyTheme();
    this._hydrateStickerPool();
    this.raf = requestAnimationFrame(() => this.tick());
  }

  _hydrateKenneyTheme() {
    const boardBg = this.rootEl?.querySelector('#sh-board-bg');
    const targetOverlay = this.rootEl?.querySelector('#sh-target-overlay');
    const crosshair = this.rootEl?.querySelector('#sh-crosshair');
    if (boardBg) boardBg.src = toBackendAssetUrl(KENNEY_ASSETS.stallBg);
    if (targetOverlay) targetOverlay.src = toBackendAssetUrl(KENNEY_ASSETS.targetOverlay);
    if (crosshair) crosshair.src = toBackendAssetUrl(KENNEY_ASSETS.crosshair);
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
    this._scheduleImageLoop(img, sticker.durationMs);
  }

  _clearAllImageLoops() {
    for (const timer of this.imageLoopTimers.values()) {
      clearTimeout(timer);
    }
    this.imageLoopTimers.clear();
  }

  _updateShooterSticker() {
    if (!this.shooterStickerEl) return;
    const sticker = this._pickRandomSticker();
    if (sticker) {
      this._setLoopingImage(this.shooterStickerEl, sticker);
      this.shooterStickerEl.classList.add('ready');
    } else {
      this._clearImageLoop(this.shooterStickerEl);
      this.shooterStickerEl.removeAttribute('src');
      this.shooterStickerEl.classList.remove('ready');
    }
  }

  shoot() {
    if (!this.state) return;
    if (Date.now() < this.throwCooldownUntil) return;
    if (this.state.phase !== 'playing') return;
    if (this.state.you?.crashed || this.state.you?.finished) return;

    this.throwCooldownUntil = Date.now() + 160;
    this.network.sendGameAction({ type: 'throw-sticker' });
    this._playThrowAnim();
    this._updateShooterSticker();
  }

  _playThrowAnim() {
    if (!this.rootEl) return;
    const fx = document.createElement('div');
    fx.className = 'sh-throw-fx';
    const sticker = this._pickRandomSticker();
    if (sticker?.src) {
      const img = document.createElement('img');
      img.src = sticker.src;
      img.alt = '';
      img.className = 'sh-throw-fx-img';
      img.draggable = false;
      fx.appendChild(img);
    } else {
      fx.textContent = '🏷️';
    }
    this.rootEl.querySelector('#sh-board')?.appendChild(fx);
    setTimeout(() => fx.remove(), 220);
  }

  _syncMarkers() {
    if (!this.targetRotorEl || !this.state?.you?.stage) return;
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

    if (this.targetRotorEl) {
      this.targetRotorEl
        .querySelectorAll('.sh-marker-img')
        .forEach((img) => this._clearImageLoop(img));
    }
    this.targetRotorEl.innerHTML = '<div class="sh-target-core"></div>';
    (stage.obstacleStickers || []).forEach((item) => {
      const sticker = this._stickerForSeed(item.stickerSeed);
      if (!sticker?.src) return;
      const marker = mkMarker(sticker.src, item.angle, 'sh-marker sh-obstacle');
      this.targetRotorEl.appendChild(marker);
      const img = marker.querySelector('.sh-marker-img');
      this._setLoopingImage(img, sticker);
    });
    (stage.stuckStickers || []).forEach((item) => {
      const sticker = this._stickerForSeed(item.stickerSeed);
      if (!sticker?.src) return;
      const marker = mkMarker(sticker.src, item.angle, 'sh-marker sh-stuck');
      this.targetRotorEl.appendChild(marker);
      const img = marker.querySelector('.sh-marker-img');
      this._setLoopingImage(img, sticker);
    });
  }

  applyState(state) {
    this.state = state;
    this._syncMarkers();
    this._renderText();
  }

  _renderText() {
    if (!this.state) return;
    const total = this.state.totalStages || 0;
    const myStage = (this.state.you?.stageIndex ?? 0) + 1;
    const oppStage = (this.state.opponent?.stageIndex ?? 0) + 1;

    if (this.progressYouEl) this.progressYouEl.textContent = `${Math.min(myStage, total)}/${total}`;
    if (this.progressOppEl) this.progressOppEl.textContent = `${Math.min(oppStage, total)}/${total}`;
    if (this.targetStageLabelEl) this.targetStageLabelEl.textContent = `Stage ${Math.min(myStage, total)} / ${total}`;
    if (this.stagePipsEl) {
      const active = Math.max(0, Math.min(total, myStage));
      this.stagePipsEl.innerHTML = '';
      for (let i = 0; i < total; i += 1) {
        const pip = document.createElement('img');
        pip.className = 'sh-stage-pip';
        pip.alt = '';
        pip.draggable = false;
        pip.src = toBackendAssetUrl(i < active ? KENNEY_ASSETS.pipOn : KENNEY_ASSETS.pipOff);
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
    if (this.state?.you?.stage?.timeline && this.targetRotorEl) {
      const rot = targetRotationDeg(this.state.you.stage.timeline, Date.now());
      this.targetRotorEl.style.transform = `translate(-50%, -50%) rotate(${rot}deg)`;
    }

    if (this.countdownEl) {
      if (this.state?.phase === 'countdown') {
        const ms = Math.max(0, this.state.countdownMsRemaining || 0);
        const n = Math.max(1, Math.ceil(ms / 1000));
        this.countdownEl.textContent = String(n);
        this.countdownEl.classList.add('visible');
      } else {
        this.countdownEl.classList.remove('visible');
      }
    }

    this.raf = requestAnimationFrame(() => this.tick());
  }

  destroy() {
    EventBus.off('sticker-hit:state', this._onState);
    window.removeEventListener('keydown', this._onKeyDown);
    this._clearAllImageLoops();
    if (this.throwBtnEl) this.throwBtnEl.removeEventListener('click', this._onShoot);
    if (this.raf) cancelAnimationFrame(this.raf);
    this.rootEl?.remove();
    this.rootEl = null;
    const canvas = this.sceneManager.renderer?.domElement;
    if (canvas) canvas.style.visibility = '';
  }
}

