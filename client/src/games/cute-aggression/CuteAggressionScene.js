import { EventBus } from '../../shared/EventBus.js';

/**
 * Virus vs Virus — Super Bucin Edition!
 * DOM-based scene. No Three.js canvas — scene hides canvas and takes full screen.
 *
 * Match UI: score bar (top) → game area (dynamic) → controls (bottom)
 *
 * Four mini-game renderers:
 *   mash    — two growing virus circles, one big TAP button
 *   reflex  — central signal emoji, tap after it fires
 *   pong    — pointer-drag paddle on a court with a bouncing ball
 *   sorting — falling virus dots, toggle gate button
 */

const MINI_NAMES = {
  mash: '\uD83E\uDDA0 Virus Inflater',    // 🦠
  reflex: '\u26A1 Quick Draw',             // ⚡
  pong: '\uD83C\uDFD3 Deflector',          // 🏓
  sorting: '\uD83D\uDEAA Gatekeeper',      // 🚪
};

const MINI_DESC = {
  mash: 'Tap cepet-cepetan biar virusmu menyeberang!',
  reflex: 'Tap saat sinyal muncul! Duluan = kalah~',
  pong: 'Geser paddle buat blok virus musuh!',
  sorting: 'Toggle gate: tangkap warnamu, blok musuh!',
};

export class CuteAggressionScene {
  constructor(sceneManager, network, _ui, gameData) {
    this.sceneManager = sceneManager;
    this.network = network;
    this.gameData = gameData;

    this.rootEl = null;
    this.lastState = null;
    this._heartInterval = null;

    // Pong input state
    this._pongActive = false;
    this._paddleThrottleAt = 0;

    // Track which mini-game is currently rendered to avoid full rebuilds on every tick
    this._renderedMiniGame = null;
    this._renderedPhase = null;

    this._onState = (s) => this._applyState(s);
  }

  init() {
    const canvas = this.sceneManager.renderer?.domElement;
    if (canvas) canvas.style.visibility = 'hidden';

    this.rootEl = document.createElement('div');
    this.rootEl.className = 'ca-layer';
    document.getElementById('ui-overlay').appendChild(this.rootEl);

    this._buildShell();
    this._startParticles();

    EventBus.on('cute-aggression:state', this._onState);
    if (this.gameData.cuteAggressionState) {
      this._applyState(this.gameData.cuteAggressionState);
    }
  }

  // ── Shell (persistent layout) ─────────────────────────────────────────────

  _buildShell() {
    this.rootEl.innerHTML = `
      <div class="ca-heart-bg"></div>
      <div class="ca-arena" id="ca-arena">
        <div class="ca-score-bar" id="ca-score-bar">
          <div class="ca-score-side" id="ca-score-me"></div>
          <div class="ca-score-mid" id="ca-score-mid">VS</div>
          <div class="ca-score-side ca-score-side-opp" id="ca-score-opp"></div>
        </div>
        <div class="ca-game-area" id="ca-game-area"></div>
        <div class="ca-ctrl-area" id="ca-ctrl-area"></div>
        <div class="ca-overlay" id="ca-overlay"></div>
      </div>
    `;
  }

  _startParticles() {
    const bg = this.rootEl.querySelector('.ca-heart-bg');
    if (!bg) return;
    const pool = [
      '\u2764\uFE0F', '\uD83D\uDC95', '\uD83D\uDC96', '\u2728', '\uD83C\uDF1F',
      '\uD83E\uDDA0', '\uD83E\uDDEC', '\uD83D\uDC8B', '\uD83E\uDD70', '\uD83E\uDE78',
    ];
    this._heartInterval = setInterval(() => {
      const el = document.createElement('div');
      el.className = 'ca-falling-heart';
      el.textContent = pool[Math.floor(Math.random() * pool.length)];
      el.style.left = `${Math.random() * 100}%`;
      el.style.animationDuration = `${3 + Math.random() * 5}s`;
      el.style.fontSize = `${0.55 + Math.random() * 0.9}rem`;
      el.style.opacity = `${0.12 + Math.random() * 0.25}`;
      bg.appendChild(el);
      setTimeout(() => el.remove(), 9000);
    }, 280);
  }

  // ── State handler ─────────────────────────────────────────────────────────

  _applyState(state) {
    this.lastState = state;
    if (!this.rootEl) return;

    this._updateScoreBar(state);

    if (state.phase === 'countdown') {
      if (this._renderedPhase !== 'countdown' || this._renderedMiniGame !== state.currentMiniGame) {
        this._renderedPhase = 'countdown';
        this._renderedMiniGame = state.currentMiniGame;
        this._renderCountdown(state);
      }
      // Clear result overlay if still showing
      const ov = document.getElementById('ca-overlay');
      if (ov) ov.innerHTML = '';

    } else if (state.phase === 'playing') {
      if (this._renderedPhase !== 'playing' || this._renderedMiniGame !== state.currentMiniGame) {
        this._renderedPhase = 'playing';
        this._renderedMiniGame = state.currentMiniGame;
        this._clearGameAreas();
        this._renderMiniGameSkeleton(state);
      }
      this._updateMiniGame(state);
      // Clear result overlay
      const ov = document.getElementById('ca-overlay');
      if (ov && ov.firstChild) ov.innerHTML = '';

    } else if (state.phase === 'mini-result') {
      if (this._renderedPhase !== 'mini-result') {
        this._renderedPhase = 'mini-result';
        this._renderMiniResult(state);
      }
    }
  }

  // ── Score bar ─────────────────────────────────────────────────────────────

  _updateScoreBar(state) {
    const meEl = document.getElementById('ca-score-me');
    const oppEl = document.getElementById('ca-score-opp');
    const midEl = document.getElementById('ca-score-mid');
    if (!meEl) return;

    const { me, opp, matchScore, winScore, currentMiniGame } = state;

    meEl.innerHTML = `
      <span class="ca-sc-emoji">${me.character.emoji}</span>
      <span class="ca-sc-pips">${'\u2764\uFE0F'.repeat(matchScore.me)}${'<span class="ca-pip-empty">\u2B24</span>'.repeat(Math.max(0, winScore - matchScore.me))}</span>
    `;
    oppEl.innerHTML = `
      <span class="ca-sc-pips">${'\u2764\uFE0F'.repeat(matchScore.opp)}${'<span class="ca-pip-empty">\u2B24</span>'.repeat(Math.max(0, winScore - matchScore.opp))}</span>
      <span class="ca-sc-emoji">${opp.character.emoji}</span>
    `;
    if (midEl) {
      midEl.textContent = currentMiniGame ? MINI_NAMES[currentMiniGame] || 'VS' : 'VS';
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  _clearGameAreas() {
    const g = document.getElementById('ca-game-area');
    const c = document.getElementById('ca-ctrl-area');
    const o = document.getElementById('ca-overlay');
    if (g) g.innerHTML = '';
    if (c) c.innerHTML = '';
    if (o) o.innerHTML = '';
    this._pongActive = false;
  }

  // ── Countdown ─────────────────────────────────────────────────────────────

  _renderCountdown(state) {
    const gameArea = document.getElementById('ca-game-area');
    const ctrlArea = document.getElementById('ca-ctrl-area');
    if (!gameArea) return;

    const name = MINI_NAMES[state.currentMiniGame] || 'Virus vs Virus';
    const desc = MINI_DESC[state.currentMiniGame] || '';

    gameArea.innerHTML = `
      <div class="ca-cdwn-stage">
        <div class="ca-cdwn-chars">
          <div class="ca-cdwn-virus" style="background:${state.me.character.color}">
            ${state.me.character.emoji}
          </div>
          <div class="ca-cdwn-vs-pill">VS</div>
          <div class="ca-cdwn-virus" style="background:${state.opp.character.color}">
            ${state.opp.character.emoji}
          </div>
        </div>
        <div class="ca-cdwn-name">${name}</div>
        <div class="ca-cdwn-desc">${desc}</div>
        <div class="ca-cdwn-num" id="ca-cdwn-num">3</div>
      </div>
    `;
    ctrlArea.innerHTML = '';

    // Animate 3 → 2 → 1 → GO! (client-side display only; server controls actual timing)
    let n = 3;
    const numEl = document.getElementById('ca-cdwn-num');
    if (!numEl) return;
    numEl.classList.add('ca-num-pop');

    const tick = () => {
      if (!this.rootEl || this.lastState?.phase !== 'countdown') return;
      n--;
      if (n > 0) {
        numEl.textContent = n;
        numEl.classList.remove('ca-num-pop', 'ca-num-go');
        void numEl.offsetWidth;
        numEl.classList.add('ca-num-pop');
        setTimeout(tick, 1000);
      } else {
        numEl.textContent = 'GO!!';
        numEl.classList.remove('ca-num-pop', 'ca-num-go');
        void numEl.offsetWidth;
        numEl.classList.add('ca-num-pop', 'ca-num-go');
      }
    };
    setTimeout(tick, 1000);
  }

  // ── Mini-game skeleton builders (DOM structure, set up once) ──────────────

  _renderMiniGameSkeleton(state) {
    switch (state.currentMiniGame) {
      case 'mash': this._buildMashSkeleton(state); break;
      case 'reflex': this._buildReflexSkeleton(state); break;
      case 'pong': this._buildPongSkeleton(state); break;
      case 'sorting': this._buildSortingSkeleton(state); break;
    }
  }

  _buildMashSkeleton(state) {
    const gameArea = document.getElementById('ca-game-area');
    const ctrlArea = document.getElementById('ca-ctrl-area');

    gameArea.innerHTML = `
      <div class="ca-mash-arena">
        <div class="ca-mash-half ca-mash-opp">
          <div class="ca-mash-virus" id="ca-mash-opp"
               style="background:${state.opp.character.color};width:50px;height:50px">
            ${state.opp.character.emoji}
          </div>
          <div class="ca-mash-lbl">${state.opp.character.name}</div>
        </div>
        <div class="ca-mash-divider">
          <div class="ca-mash-timer-track"><div class="ca-mash-timer-fill" id="ca-mash-timer" style="width:100%"></div></div>
          <div class="ca-mash-center-line"></div>
        </div>
        <div class="ca-mash-half ca-mash-me">
          <div class="ca-mash-virus" id="ca-mash-me"
               style="background:${state.me.character.color};width:50px;height:50px">
            ${state.me.character.emoji}
          </div>
          <div class="ca-mash-lbl">Virusmu!</div>
        </div>
      </div>
    `;

    ctrlArea.innerHTML = `
      <button class="ca-tap-btn" id="ca-mash-btn" style="--btn-clr:${state.me.character.color}">
        \uD83E\uDDA0 TAP TAP TAP!!
      </button>
    `;

    document.getElementById('ca-mash-btn')?.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.network.sendGameAction({ type: 'mash' });
      const v = document.getElementById('ca-mash-me');
      if (v) { v.classList.remove('ca-mash-pulse'); void v.offsetWidth; v.classList.add('ca-mash-pulse'); }
    });
  }

  _buildReflexSkeleton(state) {
    const gameArea = document.getElementById('ca-game-area');
    const ctrlArea = document.getElementById('ca-ctrl-area');

    gameArea.innerHTML = `
      <div class="ca-reflex-arena">
        <div class="ca-reflex-row">
          <div class="ca-reflex-char" style="color:${state.me.character.color}">${state.me.character.emoji}</div>
          <div class="ca-reflex-signal" id="ca-reflex-signal">\uD83D\uDC40</div>
          <div class="ca-reflex-char" style="color:${state.opp.character.color}">${state.opp.character.emoji}</div>
        </div>
        <div class="ca-reflex-status" id="ca-reflex-status">Tunggu sinyal sayang~</div>
      </div>
    `;

    ctrlArea.innerHTML = `
      <button class="ca-tap-btn ca-tap-btn-wait" id="ca-reflex-btn">
        \uD83D\uDC40 SIAP-SIAP...
      </button>
    `;

    document.getElementById('ca-reflex-btn')?.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.network.sendGameAction({ type: 'tap' });
    });
  }

  _buildPongSkeleton(state) {
    const gameArea = document.getElementById('ca-game-area');
    const ctrlArea = document.getElementById('ca-ctrl-area');

    gameArea.innerHTML = `
      <div class="ca-pong-court" id="ca-pong-court">
        <div class="ca-pong-lbl ca-pong-lbl-opp">${state.opp.character.emoji} ${state.opp.character.name}</div>
        <div class="ca-pong-paddle ca-pong-opp" id="ca-pong-opp"
             style="background:${state.opp.character.color}"></div>
        <div class="ca-pong-center"></div>
        <div class="ca-pong-ball" id="ca-pong-ball">\uD83E\uDDA0</div>
        <div class="ca-pong-paddle ca-pong-me" id="ca-pong-me"
             style="background:${state.me.character.color}"></div>
        <div class="ca-pong-lbl ca-pong-lbl-me">\uD83E\uDDA0 Virusmu</div>
      </div>
    `;
    ctrlArea.innerHTML = `<div class="ca-pong-hint">\u2190 Geser di lapangan untuk gerakin paddle \u2192</div>`;

    const court = document.getElementById('ca-pong-court');
    if (!court) return;

    const move = (clientX) => {
      const rect = court.getBoundingClientRect();
      const nx = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const now = Date.now();
      if (now - this._paddleThrottleAt > 35) {
        this._paddleThrottleAt = now;
        this.network.sendGameAction({ type: 'paddle', x: nx });
      }
    };

    court.addEventListener('pointerdown', (e) => { e.preventDefault(); this._pongActive = true; move(e.clientX); });
    court.addEventListener('pointermove', (e) => { if (!this._pongActive) return; e.preventDefault(); move(e.clientX); });
    court.addEventListener('pointerup', () => { this._pongActive = false; });
    court.addEventListener('pointerleave', () => { this._pongActive = false; });
    court.addEventListener('pointercancel', () => { this._pongActive = false; });
  }

  _buildSortingSkeleton(state) {
    const gameArea = document.getElementById('ca-game-area');
    const ctrlArea = document.getElementById('ca-ctrl-area');

    gameArea.innerHTML = `
      <div class="ca-sort-arena">
        <div class="ca-sort-scores">
          <div class="ca-sort-score" id="ca-sort-me-score">${state.me.character.emoji} 0</div>
          <span class="ca-sort-score-sep">vs</span>
          <div class="ca-sort-score" id="ca-sort-opp-score">0 ${state.opp.character.emoji}</div>
        </div>
        <div class="ca-sort-field" id="ca-sort-field">
          <div class="ca-sort-viruses" id="ca-sort-viruses"></div>
          <div class="ca-sort-gate" id="ca-sort-gate">
            <div class="ca-gate-status" id="ca-gate-status">\uD83D\uDD34 TUTUP</div>
          </div>
        </div>
      </div>
    `;

    ctrlArea.innerHTML = `
      <button class="ca-tap-btn ca-tap-btn-gate" id="ca-gate-btn"
              style="--btn-clr:${state.me.character.color}">
        \uD83D\uDEAA BUKA / TUTUP GATE
      </button>
    `;

    document.getElementById('ca-gate-btn')?.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.network.sendGameAction({ type: 'gate' });
    });
  }

  // ── Mini-game updaters (called every state tick) ───────────────────────────

  _updateMiniGame(state) {
    switch (state.currentMiniGame) {
      case 'mash': this._updateMash(state); break;
      case 'reflex': this._updateReflex(state); break;
      case 'pong': this._updatePong(state); break;
      case 'sorting': this._updateSorting(state); break;
    }
  }

  _updateMash(state) {
    const mini = state.mini || {};
    const myEl = document.getElementById('ca-mash-me');
    const oppEl = document.getElementById('ca-mash-opp');
    const timerEl = document.getElementById('ca-mash-timer');

    if (myEl) {
      const sz = 40 + (mini.myScale ?? 0.1) * 110;
      myEl.style.width = myEl.style.height = `${sz}px`;
    }
    if (oppEl) {
      const sz = 40 + (mini.oppScale ?? 0.1) * 110;
      oppEl.style.width = oppEl.style.height = `${sz}px`;
    }
    if (timerEl) {
      const pct = mini.timeLeft !== null && mini.timeLeft !== undefined
        ? (mini.timeLeft / (state.mini?.winScale !== null && state.mini?.winScale !== undefined ? 25000 : 25000)) * 100
        : 100;
      timerEl.style.width = `${Math.min(100, Math.max(0, pct))}%`;
    }
  }

  _updateReflex(state) {
    const mini = state.mini || {};
    const signalEl = document.getElementById('ca-reflex-signal');
    const statusEl = document.getElementById('ca-reflex-status');
    const btn = document.getElementById('ca-reflex-btn');

    const rp = mini.reflexPhase || 'waiting';

    if (rp === 'waiting') {
      if (signalEl) { signalEl.textContent = '\uD83D\uDC40'; signalEl.className = 'ca-reflex-signal'; }
      if (statusEl) statusEl.textContent = 'Tunggu dulu... jangan duluan ya sayang~';
      if (btn) { btn.textContent = '\uD83D\uDC40 SIAP-SIAP...'; btn.className = 'ca-tap-btn ca-tap-btn-wait'; }
    } else if (rp === 'signal') {
      if (signalEl) { signalEl.textContent = '\uD83E\uDDA0'; signalEl.className = 'ca-reflex-signal ca-signal-go'; }
      if (statusEl) statusEl.textContent = 'TAP SEKARANG!! \uD83D\uDD25';
      if (btn) {
        btn.textContent = '\uD83E\uDDA0 TAP!!';
        btn.className = 'ca-tap-btn ca-tap-btn-go';
        btn.style.setProperty('--btn-clr', state.me.character.color);
      }
    } else if (rp === 'false-start') {
      if (signalEl) signalEl.textContent = '\u26D4';
      const me = mini.falseTapper === 'me';
      if (statusEl) statusEl.textContent = me ? 'Duluan dong! \uD83D\uDE31' : 'Lawan duluan! \uD83D\uDE0F';
    } else if (rp === 'done') {
      if (signalEl) signalEl.textContent = '\u2705';
      if (statusEl) statusEl.textContent = 'Cepet banget! \uD83D\uDD25';
    }
  }

  _updatePong(state) {
    const mini = state.mini || {};
    if (!mini.ball) return;

    const ballEl = document.getElementById('ca-pong-ball');
    const myPadEl = document.getElementById('ca-pong-me');
    const oppPadEl = document.getElementById('ca-pong-opp');

    if (ballEl) {
      ballEl.style.left = `${mini.ball.x * 100}%`;
      ballEl.style.top = `${mini.ball.y * 100}%`;
    }

    const pw = 30; // paddle width in %
    if (myPadEl && mini.myPaddleX !== null && mini.myPaddleX !== undefined) {
      myPadEl.style.left = `${Math.max(0, Math.min(100 - pw, mini.myPaddleX * 100 - pw / 2))}%`;
    }
    if (oppPadEl && mini.oppPaddleX !== null && mini.oppPaddleX !== undefined) {
      oppPadEl.style.left = `${Math.max(0, Math.min(100 - pw, mini.oppPaddleX * 100 - pw / 2))}%`;
    }
  }

  _updateSorting(state) {
    const mini = state.mini || {};

    const meScore = document.getElementById('ca-sort-me-score');
    const oppScore = document.getElementById('ca-sort-opp-score');
    const gateStatus = document.getElementById('ca-gate-status');
    const gateEl = document.getElementById('ca-sort-gate');

    if (meScore) meScore.textContent = `${state.me.character.emoji} ${mini.myScore ?? 0} / ${mini.winCatches || 10}`;
    if (oppScore) oppScore.textContent = `${mini.oppScore ?? 0} / ${mini.winCatches || 10} ${state.opp.character.emoji}`;

    const open = mini.gateOpen || false;
    if (gateStatus) gateStatus.textContent = open ? '\uD83D\uDFE2 BUKA' : '\uD83D\uDD34 TUTUP';
    if (gateEl) gateEl.classList.toggle('ca-gate-open', open);

    // Sync virus dots
    const container = document.getElementById('ca-sort-viruses');
    if (!container || !mini.viruses) return;

    const activeIds = new Set(mini.viruses.map((v) => v.id));
    container.querySelectorAll('[data-vid]').forEach((el) => {
      if (!activeIds.has(Number(el.dataset.vid))) el.remove();
    });

    for (const v of mini.viruses) {
      let el = container.querySelector(`[data-vid="${v.id}"]`);
      if (!el) {
        el = document.createElement('div');
        el.className = `ca-sort-virus ${v.color === 'merah' ? 'ca-virus-red' : 'ca-virus-blue'}`;
        el.dataset.vid = v.id;
        el.textContent = v.color === 'merah' ? '\uD83D\uDD34' : '\uD83D\uDD35';
        container.appendChild(el);
      }
      el.style.top = `${v.progress * 82}%`;
      el.style.left = `${8 + (v.id % 8) * 11}%`;
    }
  }

  // ── Mini result overlay ───────────────────────────────────────────────────

  _renderMiniResult(state) {
    const overlay = document.getElementById('ca-overlay');
    if (!overlay || !state.lastMiniResult) return;

    const iWon = state.lastMiniResult.iWon;

    overlay.innerHTML = iWon
      ? `<div class="ca-result ca-result-win">
           <div class="ca-result-big">\uD83C\uDF89 MENANG!! \uD83E\uDDA0</div>
           <div class="ca-result-sub">+1 poin buat ${state.me.character.emoji}</div>
           <div class="ca-result-score">${state.matchScore.me} \u2014 ${state.matchScore.opp}</div>
         </div>`
      : `<div class="ca-result ca-result-lose">
           <div class="ca-result-big">Yahhh~ \uD83D\uDE2D</div>
           <div class="ca-result-sub">+1 poin buat ${state.opp.character.emoji}</div>
           <div class="ca-result-score">${state.matchScore.me} \u2014 ${state.matchScore.opp}</div>
         </div>`;
  }

  // ── Teardown ──────────────────────────────────────────────────────────────

  destroy() {
    EventBus.off('cute-aggression:state', this._onState);
    clearInterval(this._heartInterval);
    this.rootEl?.remove();
    this.rootEl = null;
    const canvas = this.sceneManager.renderer?.domElement;
    if (canvas) canvas.style.visibility = '';
  }
}
