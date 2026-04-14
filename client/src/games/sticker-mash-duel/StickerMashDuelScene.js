import { EventBus } from '../../shared/EventBus.js';
import {
  DEFAULT_STICKER_MANIFEST_TIMEOUT_MS,
  fetchStickerManifest,
} from '../sticker-hit/stickerManifest.js';

const FALLBACK_STICKERS = [
  '/stickers/STK-20260202-WA0032.webp',
  '/stickers/STK-20260325-WA0004.webp',
  '/stickers/STK-20260325-WA0005.webp',
  '/stickers/STK-20260401-WA0177.webp',
  '/stickers/STK-20260402-WA0039.webp',
  '/stickers/STK-20260403-WA0068.webp',
  '/stickers/STK-20260403-WA0069.webp',
  '/stickers/STK-20260403-WA0070.webp',
  '/stickers/STK-20260404-WA0105.webp',
  '/stickers/STK-20260405-WA0019.webp',
  '/stickers/STK-20260405-WA0065.webp',
  '/stickers/STK-20260405-WA0136.webp',
  '/stickers/STK-20260406-WA0160.webp',
  '/stickers/STK-20260407-WA0008.webp',
  '/stickers/STK-20260407-WA0022.webp',
].map((src) => ({ src, durationMs: 1200 }));

const SWIPE_THRESHOLD_PX = 30;

export class StickerMashDuelScene {
  constructor(_sceneManager, network, _ui, gameData) {
    this.network = network;
    this.gameData = gameData;
    this.rootEl = null;
    this.state = null;
    this.tapBtnEl = null;
    this.timerFillEl = null;
    this.timerTextEl = null;
    this.youScoreEl = null;
    this.oppScoreEl = null;
    this.statusEl = null;
    this.deckCardsEl = null;
    this.fxLayerEl = null;
    this.leaderboardEl = null;
    this.stickerPool = [];
    this._lastStackSig = '';
    this._nextTapAtMs = 0;
    this._touchStartY = 0;
    this._leaderboardFetched = false;
    this._alive = false;

    this._onTap = () => this.tap();
    this._onKeyDown = (e) => {
      if (e.code !== 'Space') return;
      e.preventDefault();
      this.tap();
    };
    this._onTouchStart = (e) => {
      this._touchStartY = e.touches[0].clientY;
    };
    this._onTouchEnd = (e) => {
      const endY = e.changedTouches[0]?.clientY ?? this._touchStartY;
      if (this._touchStartY - endY > SWIPE_THRESHOLD_PX) {
        this.tap();
      }
    };
    this._onState = (s) => this.applyState(s);
  }

  init() {
    this._alive = true;
    this.rootEl = document.createElement('div');
    this.rootEl.className = 'sh-layer';
    this.rootEl.innerHTML = `
      <div class="smd-arena">
        <div class="smd-timer-bar">
          <div class="smd-timer-fill" id="smd-timer-fill"></div>
          <span class="smd-timer-text" id="smd-timer">30.0s</span>
        </div>

        <div class="smd-scores">
          <div class="smd-score-card">
            <img class="smd-score-icon" src="/kenney/icon_target.png" alt="">
            <span class="smd-score-label">You</span>
            <span class="smd-score-value" id="smd-you-score">0</span>
          </div>
          <div class="smd-score-card">
            <img class="smd-score-icon" src="/kenney/icon_duck.png" alt="">
            <span class="smd-score-label">Sayang</span>
            <span class="smd-score-value" id="smd-opp-score">0</span>
          </div>
        </div>

        <div class="smd-status" id="smd-status">Get ready...</div>

        <div class="smd-stage-3d">
          <div class="smd-deck" id="smd-deck">
            <div class="smd-deck__cards" id="smd-deck-cards"></div>
          </div>
        </div>

        <div class="smd-fx-layer" id="smd-fx-layer" aria-hidden="true"></div>

        <div class="smd-leaderboard" id="smd-leaderboard" hidden></div>
      </div>

      <footer class="smd-footer">
        <button class="btn btn-pink smd-tap-btn" id="smd-tap-btn" type="button">MASH!</button>
        <p class="smd-footer-hint">Tap button, swipe up, or press Space</p>
      </footer>
    `;
    document.getElementById('ui-overlay')?.appendChild(this.rootEl);

    this.tapBtnEl = this.rootEl.querySelector('#smd-tap-btn');
    this.timerFillEl = this.rootEl.querySelector('#smd-timer-fill');
    this.timerTextEl = this.rootEl.querySelector('#smd-timer');
    this.youScoreEl = this.rootEl.querySelector('#smd-you-score');
    this.oppScoreEl = this.rootEl.querySelector('#smd-opp-score');
    this.statusEl = this.rootEl.querySelector('#smd-status');
    this.deckCardsEl = this.rootEl.querySelector('#smd-deck-cards');
    this.fxLayerEl = this.rootEl.querySelector('#smd-fx-layer');
    this.leaderboardEl = this.rootEl.querySelector('#smd-leaderboard');

    this.tapBtnEl?.addEventListener('pointerdown', this._onTap);
    window.addEventListener('keydown', this._onKeyDown);
    this.rootEl.addEventListener('touchstart', this._onTouchStart, { passive: true });
    this.rootEl.addEventListener('touchend', this._onTouchEnd, { passive: true });
    EventBus.on('sticker-mash-duel:state', this._onState);

    // Fallback stickers available immediately — no race condition
    this.stickerPool = FALLBACK_STICKERS.map((s) => ({
      ...s,
      src: this._displayStickerUrl(s.src),
    }));

    if (this.gameData?.stickerMashDuelState) {
      this.applyState(this.gameData.stickerMashDuelState);
    }
    this._hydrateStickerPool();
  }

  async _hydrateStickerPool() {
    const { stickers } = await fetchStickerManifest({
      backendOrigin: this._backendOrigin(),
      timeoutMs: DEFAULT_STICKER_MANIFEST_TIMEOUT_MS,
    });
    if (!this._alive) return;
    if (stickers && stickers.length > 0) {
      this.stickerPool = stickers;
    }
    this._renderStickerStack();
  }

  _backendOrigin() {
    return window.location.hostname === 'localhost' ? 'http://localhost:3000' : window.location.origin;
  }

  _displayStickerUrl(src) {
    if (!src) return '';
    if (/^https?:\/\//i.test(src) || src.startsWith('data:') || src.startsWith('blob:')) return src;
    const path = src.startsWith('/') ? src : `/${src}`;
    return `${this._backendOrigin()}${path}`;
  }

  _stickerForSeed(seed) {
    if (!this.stickerPool.length) return null;
    const idx = Math.abs(Number(seed) || 0) % this.stickerPool.length;
    return this.stickerPool[idx];
  }

  _spawnFlyingStickerBurst() {
    if (!this.fxLayerEl || !this.stickerPool.length) return;
    const count = 2;
    for (let i = 0; i < count; i++) {
      const sticker = this.stickerPool[Math.floor(Math.random() * this.stickerPool.length)];
      const url = this._displayStickerUrl(sticker.src);
      if (!url) continue;

      const el = document.createElement('div');
      el.className = 'smd-fly-sticker';
      el.style.backgroundImage = `url("${url}")`;

      const anchor = this.tapBtnEl?.getBoundingClientRect();
      const layerRect = this.fxLayerEl.getBoundingClientRect();
      if (!anchor) continue;

      const x = anchor.left + (anchor.width || 120) / 2 - layerRect.left;
      const y = anchor.top + (anchor.height || 48) / 2 - layerRect.top;
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;

      const sign = Math.random() > 0.5 ? 1 : -1;
      const dx = sign * (280 + Math.random() * 200);
      const dy = -(220 + Math.random() * 160);
      const rot = Math.random() * 70 - 35;
      el.style.setProperty('--smd-fly-dx', `${dx.toFixed(1)}px`);
      el.style.setProperty('--smd-fly-dy', `${dy.toFixed(1)}px`);
      el.style.setProperty('--smd-fly-rot', `${rot.toFixed(1)}deg`);

      this.fxLayerEl.appendChild(el);
      window.setTimeout(() => {
        if (this._alive) el.remove();
      }, 800);
    }
  }

  tap() {
    if (!this.state || this.state.phase !== 'playing') return;
    const now = Date.now();
    if (now < this._nextTapAtMs) return;
    this._nextTapAtMs = now + 45;
    this._spawnFlyingStickerBurst();
    this.network.sendGameAction({ type: 'mash-tap' });
  }

  applyState(state) {
    this.state = state;
    if (this.youScoreEl) this.youScoreEl.textContent = String(state?.you?.score || 0);
    if (this.oppScoreEl) this.oppScoreEl.textContent = String(state?.opponent?.score || 0);

    const totalMs = state.roundTotalMs || 30000;

    if (this.timerTextEl) {
      if (state.phase === 'countdown') {
        this.timerTextEl.textContent = `${Math.ceil((state.countdownMsRemaining || 0) / 1000)}...`;
      } else {
        this.timerTextEl.textContent = `${((state.roundMsRemaining || 0) / 1000).toFixed(1)}s`;
      }
    }

    if (this.timerFillEl) {
      const remaining = state.roundMsRemaining || 0;
      const pct = state.phase === 'countdown' ? 100 : (remaining / totalMs) * 100;
      this.timerFillEl.style.width = `${Math.max(0, Math.min(100, pct))}%`;
      if (remaining < 5000 && state.phase === 'playing') {
        this.timerFillEl.classList.add('smd-timer-danger');
      } else {
        this.timerFillEl.classList.remove('smd-timer-danger');
      }
    }

    if (this.tapBtnEl) {
      this.tapBtnEl.disabled = state.phase !== 'playing';
    }

    if (this.statusEl) {
      if (state.phase === 'countdown') this.statusEl.textContent = 'Ready...';
      else if (state.phase === 'playing') this.statusEl.textContent = 'MASH! Stickers fly everywhere!';
      else this.statusEl.textContent = 'Round finished.';
    }

    this._renderStickerStack();

    if (state.phase === 'finished' && !this._leaderboardFetched) {
      this._leaderboardFetched = true;
      this._showLeaderboard();
    }
  }

  _renderStickerStack() {
    if (!this._alive || !this.deckCardsEl) return;
    const seeds = this.state?.you?.stuckSeeds || [];
    const sig = `${seeds.length}:${seeds.slice(-16).join(',')}:${this.stickerPool.length}`;
    if (sig === this._lastStackSig) return;
    this._lastStackSig = sig;
    this.deckCardsEl.innerHTML = '';
    const tail = seeds.slice(-16);
    tail.forEach((seed, depth) => {
      const card = document.createElement('div');
      card.className = 'smd-deck-card';
      const sticker = this._stickerForSeed(seed);
      const url = sticker?.src ? this._displayStickerUrl(sticker.src) : '';
      if (url) {
        card.style.backgroundImage = `url("${url}")`;
      } else {
        card.classList.add('smd-deck-card--placeholder');
        card.textContent = '\uD83C\uDFF7\uFE0F';
      }
      const rot = ((seed % 19) - 9) * 0.9;
      const tx = depth * 1.2;
      const ty = -depth * 3;
      card.style.transform = `translate(${tx}px, ${ty}px) rotate(${rot}deg)`;
      card.style.zIndex = String(10 + depth);
      this.deckCardsEl.appendChild(card);
    });
  }

  async _showLeaderboard() {
    if (!this.leaderboardEl) return;
    try {
      const res = await fetch(`${this._backendOrigin()}/api/leaderboard/sticker-mash-duel`);
      if (!res.ok) return;
      const { leaderboard } = await res.json();
      if (!this._alive || !leaderboard) return;
      this.leaderboardEl.hidden = false;
      if (leaderboard.length === 0) {
        this.leaderboardEl.innerHTML =
          '<h3 class="smd-lb-title">Top Scores</h3>' +
          '<p class="smd-lb-empty">No scores yet — you could be first!</p>';
        return;
      }
      this.leaderboardEl.innerHTML =
        '<h3 class="smd-lb-title">Top Scores</h3>' +
        leaderboard.slice(0, 6).map((entry, i) =>
          `<div class="smd-lb-row">` +
          `<span class="smd-lb-rank">${i + 1}</span>` +
          `<span class="smd-lb-name">${this._escapeHtml(entry.display_name || entry.username || 'Player')}</span>` +
          `<span class="smd-lb-score">${entry.total_points}</span>` +
          `</div>`,
        ).join('');
    } catch (_err) {
      // Silently fail — leaderboard is non-critical
    }
  }

  _escapeHtml(str) {
    const el = document.createElement('span');
    el.textContent = str;
    return el.innerHTML;
  }

  destroy() {
    this._alive = false;
    EventBus.off('sticker-mash-duel:state', this._onState);
    window.removeEventListener('keydown', this._onKeyDown);
    this.tapBtnEl?.removeEventListener('pointerdown', this._onTap);
    this.rootEl?.removeEventListener('touchstart', this._onTouchStart);
    this.rootEl?.removeEventListener('touchend', this._onTouchEnd);
    this.rootEl?.remove();
    this.rootEl = null;
  }
}
