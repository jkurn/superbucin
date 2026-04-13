import { EventBus } from '../../shared/EventBus.js';

export class StickerMashDuelScene {
  constructor(_sceneManager, network, _ui, gameData) {
    this.network = network;
    this.gameData = gameData;
    this.rootEl = null;
    this.state = null;
    this.tapBtnEl = null;
    this.timerEl = null;
    this.youScoreEl = null;
    this.oppScoreEl = null;
    this.statusEl = null;
    this._nextTapAtMs = 0;
    this._onTap = () => this.tap();
    this._onKeyDown = (e) => {
      if (e.code !== 'Space') return;
      e.preventDefault();
      this.tap();
    };
    this._onState = (s) => this.applyState(s);
  }

  init() {
    this.rootEl = document.createElement('div');
    this.rootEl.className = 'sh-layer';
    this.rootEl.innerHTML = `
      <div class="sh-wrap">
        <div class="sh-main-col">
          <section class="sh-howto">
            <h2 class="sh-howto__title">Sticker Mash Duel</h2>
            <p class="sh-howto__body">
              Countdown then mash as fast as you can. Round ends on timer, highest score wins.
            </p>
          </section>
          <div class="sh-board-wrap">
            <div class="sh-stage-label" id="smd-timer">45.0s</div>
            <div class="sh-status" id="smd-status">Get ready...</div>
          </div>
        </div>
        <div class="sh-side">
          <div class="sh-progress-card">
            <div class="sh-progress-title">You</div>
            <div class="sh-progress-value" id="smd-you-score">0</div>
          </div>
          <div class="sh-progress-card">
            <div class="sh-progress-title">Sayang</div>
            <div class="sh-progress-value" id="smd-opp-score">0</div>
          </div>
        </div>
        <footer class="sh-footer">
          <button class="btn btn-pink sh-throw-btn" id="smd-tap-btn" type="button">MASH TAP</button>
          <p class="sh-footer__hint">Tap button or press Space</p>
        </footer>
      </div>
    `;
    document.getElementById('ui-overlay')?.appendChild(this.rootEl);
    this.tapBtnEl = this.rootEl.querySelector('#smd-tap-btn');
    this.timerEl = this.rootEl.querySelector('#smd-timer');
    this.youScoreEl = this.rootEl.querySelector('#smd-you-score');
    this.oppScoreEl = this.rootEl.querySelector('#smd-opp-score');
    this.statusEl = this.rootEl.querySelector('#smd-status');
    this.tapBtnEl?.addEventListener('pointerdown', this._onTap);
    window.addEventListener('keydown', this._onKeyDown);
    EventBus.on('sticker-mash-duel:state', this._onState);
    if (this.gameData?.stickerMashDuelState) {
      this.applyState(this.gameData.stickerMashDuelState);
    }
  }

  tap() {
    if (!this.state || this.state.phase !== 'playing') return;
    const now = Date.now();
    if (now < this._nextTapAtMs) return;
    this._nextTapAtMs = now + 45;
    this.network.sendGameAction({ type: 'mash-tap' });
  }

  applyState(state) {
    this.state = state;
    if (this.youScoreEl) this.youScoreEl.textContent = String(state?.you?.score || 0);
    if (this.oppScoreEl) this.oppScoreEl.textContent = String(state?.opponent?.score || 0);
    if (this.timerEl) {
      if (state.phase === 'countdown') {
        this.timerEl.textContent = `${Math.ceil((state.countdownMsRemaining || 0) / 1000)}...`;
      } else {
        this.timerEl.textContent = `${((state.roundMsRemaining || 0) / 1000).toFixed(1)}s`;
      }
    }
    if (this.tapBtnEl) {
      this.tapBtnEl.disabled = state.phase !== 'playing';
    }
    if (this.statusEl) {
      if (state.phase === 'countdown') this.statusEl.textContent = 'Ready...';
      else if (state.phase === 'playing') this.statusEl.textContent = 'MASH!';
      else this.statusEl.textContent = 'Round finished.';
    }
  }

  destroy() {
    EventBus.off('sticker-mash-duel:state', this._onState);
    window.removeEventListener('keydown', this._onKeyDown);
    this.tapBtnEl?.removeEventListener('pointerdown', this._onTap);
    this.rootEl?.remove();
    this.rootEl = null;
  }
}
