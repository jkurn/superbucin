import { EventBus } from '../../shared/EventBus.js';

/**
 * Virus vs Virus — Super Bucin Edition!
 * DOM-based scene. No Three.js canvas — scene hides canvas and takes full screen.
 *
 * Phases: roulette → ready (hold handshake) → playing → mini-result → repeat
 *
 * Three mini-game renderers:
 *   mash   — tug-of-war: two zones with shifting divider, TAP button
 *   color  — dot grid: tap opponent dots to flip, blunder penalty
 *   memory — count viruses displayed, then answer question
 */

const MINI_NAMES = {
  mash: '\uD83E\uDDA0 Virus Inflater',    // 🦠
  color: '\uD83C\uDFA8 Speed Color Match', // 🎨
  memory: '\uD83E\uDDE0 Virus Counting',   // 🧠
};

const MINI_DESC = {
  mash: 'Tap cepet biar virusmu menyeberang!',
  color: 'Tap titik lawan buat ganti warna! Hati-hati blunder~',
  memory: 'Hitung virus yang lewat, jawab duluan!',
};

export class CuteAggressionScene {
  constructor(sceneManager, network, _ui, gameData) {
    this.sceneManager = sceneManager;
    this.network = network;
    this.gameData = gameData;

    this.rootEl = null;
    this.lastState = null;
    this._heartInterval = null;

    // Track rendered phase to avoid redundant DOM rebuilds
    this._renderedPhase = null;
    this._renderedMiniGame = null;

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

    const overlay = document.getElementById('ca-overlay');

    if (state.phase === 'roulette') {
      if (this._renderedPhase !== 'roulette' || this._renderedMiniGame !== state.currentMiniGame) {
        this._renderedPhase = 'roulette';
        this._renderedMiniGame = state.currentMiniGame;
        this._renderRoulette(state);
      }
      if (overlay) overlay.innerHTML = '';

    } else if (state.phase === 'ready') {
      if (this._renderedPhase !== 'ready') {
        this._renderedPhase = 'ready';
        this._renderReady(state);
      }
      this._updateReady(state);
      if (overlay) overlay.innerHTML = '';

    } else if (state.phase === 'playing') {
      if (this._renderedPhase !== 'playing' || this._renderedMiniGame !== state.currentMiniGame) {
        this._renderedPhase = 'playing';
        this._renderedMiniGame = state.currentMiniGame;
        this._clearGameAreas();
        this._renderMiniGameSkeleton(state);
      }
      this._updateMiniGame(state);
      if (overlay && overlay.firstChild) overlay.innerHTML = '';

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
      midEl.textContent = currentMiniGame ? (MINI_NAMES[currentMiniGame] || 'VS') : 'VS';
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
  }

  // ── Roulette ──────────────────────────────────────────────────────────────

  _renderRoulette(state) {
    const gameArea = document.getElementById('ca-game-area');
    const ctrlArea = document.getElementById('ca-ctrl-area');
    if (!gameArea) return;

    const names = (state.miniPool || ['mash', 'color', 'memory']).map((k) => MINI_NAMES[k] || k);
    const selected = MINI_NAMES[state.currentMiniGame] || state.currentMiniGame;

    gameArea.innerHTML = `
      <div class="ca-roulette-stage">
        <div class="ca-cdwn-chars">
          <div class="ca-cdwn-virus" style="background:${state.me.character.color}">
            ${state.me.character.emoji}
          </div>
          <div class="ca-cdwn-vs-pill">VS</div>
          <div class="ca-cdwn-virus" style="background:${state.opp.character.color}">
            ${state.opp.character.emoji}
          </div>
        </div>
        <div class="ca-roulette-label">Ronde ${state.roundNum}</div>
        <div class="ca-roulette-spinner" id="ca-roulette-spinner"></div>
      </div>
    `;
    if (ctrlArea) ctrlArea.innerHTML = '';

    // Animate spinner: cycle through game names with increasing delay
    const spinner = document.getElementById('ca-roulette-spinner');
    if (!spinner) return;

    let idx = 0;
    const totalSpins = 12 + Math.floor(Math.random() * 4);
    let spinCount = 0;

    const spin = () => {
      if (!this.rootEl || this.lastState?.phase !== 'roulette') return;
      spinner.textContent = names[idx % names.length];
      spinner.classList.remove('ca-roulette-tick', 'ca-roulette-landed');
      void spinner.offsetWidth;
      spinner.classList.add('ca-roulette-tick');

      spinCount++;
      idx++;

      if (spinCount >= totalSpins) {
        spinner.textContent = selected;
        spinner.classList.remove('ca-roulette-tick');
        spinner.classList.add('ca-roulette-landed');
        return;
      }

      setTimeout(spin, 80 + spinCount * 25);
    };

    setTimeout(spin, 200);
  }

  // ── Ready (hold handshake) ────────────────────────────────────────────────

  _renderReady(state) {
    const gameArea = document.getElementById('ca-game-area');
    const ctrlArea = document.getElementById('ca-ctrl-area');
    if (!gameArea) return;

    const name = MINI_NAMES[state.currentMiniGame] || 'Virus vs Virus';
    const desc = MINI_DESC[state.currentMiniGame] || '';

    gameArea.innerHTML = `
      <div class="ca-ready-stage">
        <div class="ca-cdwn-name">${name}</div>
        <div class="ca-cdwn-desc">${desc}</div>
        <div class="ca-ready-players">
          <div class="ca-ready-player">
            <span class="ca-ready-emoji">${state.me.character.emoji}</span>
            <span class="ca-ready-dot" id="ca-ready-me-dot">\u2B24</span>
          </div>
          <div class="ca-ready-player">
            <span class="ca-ready-emoji">${state.opp.character.emoji}</span>
            <span class="ca-ready-dot" id="ca-ready-opp-dot">\u2B24</span>
          </div>
        </div>
        <div class="ca-ready-status" id="ca-ready-status">Tahan tombol READY...</div>
        <div class="ca-ready-countdown" id="ca-ready-countdown"></div>
      </div>
    `;

    ctrlArea.innerHTML = `
      <div class="ca-ready-hold" id="ca-ready-btn">
        \uD83E\uDDA0 TAHAN DI SINI
      </div>
    `;

    const btn = document.getElementById('ca-ready-btn');
    if (!btn) return;

    const sendHold = (pressed) => {
      this.network.sendGameAction({ type: 'hold', pressed });
    };

    btn.addEventListener('pointerdown', (e) => { e.preventDefault(); sendHold(true); });
    btn.addEventListener('pointerup', () => sendHold(false));
    btn.addEventListener('pointerleave', () => sendHold(false));
    btn.addEventListener('pointercancel', () => sendHold(false));
  }

  _updateReady(state) {
    const ready = state.ready || {};
    const statusEl = document.getElementById('ca-ready-status');
    const countdownEl = document.getElementById('ca-ready-countdown');
    const meDot = document.getElementById('ca-ready-me-dot');
    const oppDot = document.getElementById('ca-ready-opp-dot');
    const btn = document.getElementById('ca-ready-btn');

    if (meDot) meDot.style.color = ready.meHolding ? '#22cc44' : '#cc4444';
    if (oppDot) oppDot.style.color = ready.oppHolding ? '#22cc44' : '#cc4444';
    if (btn) btn.classList.toggle('ca-ready-active', !!ready.meHolding);

    const bothHolding = ready.meHolding && ready.oppHolding;

    if (bothHolding && ready.countdownElapsed > 0) {
      const remaining = Math.max(0, ready.countdownTotal - ready.countdownElapsed);
      const secs = Math.ceil(remaining / 1000);
      if (countdownEl) {
        const text = secs > 0 ? String(secs) : 'GO!!';
        if (countdownEl.textContent !== text) {
          countdownEl.textContent = text;
          countdownEl.classList.remove('ca-num-pop', 'ca-num-go');
          void countdownEl.offsetWidth;
          countdownEl.classList.add('ca-num-pop');
          if (secs <= 0) countdownEl.classList.add('ca-num-go');
        }
      }
      if (statusEl) statusEl.textContent = 'Tahan terus...!';
    } else if (ready.meHolding && !ready.oppHolding) {
      if (statusEl) statusEl.textContent = 'Menunggu lawan tahan juga~';
      if (countdownEl) countdownEl.textContent = '';
    } else if (!ready.meHolding && ready.oppHolding) {
      if (statusEl) statusEl.textContent = 'Lawan sudah siap! Tahan tombol~';
      if (countdownEl) countdownEl.textContent = '';
    } else {
      if (statusEl) statusEl.textContent = 'Tahan tombol READY...';
      if (countdownEl) countdownEl.textContent = '';
    }
  }

  // ── Mini-game skeleton builders (DOM structure, set up once) ──────────────

  _renderMiniGameSkeleton(state) {
    switch (state.currentMiniGame) {
      case 'mash': this._buildMashSkeleton(state); break;
      case 'color': this._buildColorSkeleton(state); break;
      case 'memory': this._buildMemorySkeleton(state); break;
    }
  }

  _buildMashSkeleton(state) {
    const gameArea = document.getElementById('ca-game-area');
    const ctrlArea = document.getElementById('ca-ctrl-area');

    gameArea.innerHTML = `
      <div class="ca-mash-arena">
        <div class="ca-mash-side ca-mash-opp" id="ca-mash-opp-side">
          <div class="ca-mash-virus" id="ca-mash-opp-virus"
               style="background:${state.opp.character.colorDark}">
            ${state.opp.character.emoji}
          </div>
          <div class="ca-mash-lbl">${state.opp.character.name}</div>
        </div>
        <div class="ca-mash-divider">
          <div class="ca-mash-line"></div>
        </div>
        <div class="ca-mash-side ca-mash-me" id="ca-mash-me-side">
          <div class="ca-mash-virus" id="ca-mash-me-virus"
               style="background:${state.me.character.colorDark}">
            ${state.me.character.emoji}
          </div>
          <div class="ca-mash-lbl">Virusmu!</div>
        </div>
        <div class="ca-mash-timer-track"><div class="ca-mash-timer-fill" id="ca-mash-timer"></div></div>
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
      const v = document.getElementById('ca-mash-me-virus');
      if (v) { v.classList.remove('ca-mash-pulse'); void v.offsetWidth; v.classList.add('ca-mash-pulse'); }
    });
  }

  _buildColorSkeleton(state) {
    const gameArea = document.getElementById('ca-game-area');
    const ctrlArea = document.getElementById('ca-ctrl-area');

    gameArea.innerHTML = `
      <div class="ca-color-arena">
        <div class="ca-color-header">
          <span class="ca-color-side-lbl" style="color:${state.me.character.color}">${state.me.character.emoji} Kamu</span>
          <span class="ca-color-vs">vs</span>
          <span class="ca-color-side-lbl" style="color:${state.opp.character.color}">${state.opp.character.emoji} Lawan</span>
        </div>
        <div class="ca-color-info">
          <span>\u26A0\uFE0F Tap titik warna lawan buat ganti!</span>
          <span class="ca-color-warn">Tap titikmu sendiri = BLUNDER!</span>
        </div>
        <div class="ca-color-track" id="ca-color-track"></div>
        <div class="ca-color-timer-track"><div class="ca-color-timer-fill" id="ca-color-timer"></div></div>
      </div>
    `;

    if (ctrlArea) ctrlArea.innerHTML = '<div class="ca-color-hint">\uD83D\uDC46 Tap langsung di titik-titik!</div>';
  }

  _buildMemorySkeleton(_state) {
    const gameArea = document.getElementById('ca-game-area');
    const ctrlArea = document.getElementById('ca-ctrl-area');

    gameArea.innerHTML = `
      <div class="ca-mem-arena">
        <div class="ca-mem-display" id="ca-mem-display">
          <div class="ca-mem-progress" id="ca-mem-progress"></div>
          <div class="ca-mem-current" id="ca-mem-current"></div>
          <div class="ca-mem-status" id="ca-mem-status">Perhatikan virus yang lewat!</div>
        </div>
        <div class="ca-mem-prompt" id="ca-mem-prompt" style="display:none"></div>
      </div>
    `;

    if (ctrlArea) ctrlArea.innerHTML = '';
  }

  // ── Mini-game updaters (called every state tick) ───────────────────────────

  _updateMiniGame(state) {
    switch (state.currentMiniGame) {
      case 'mash': this._updateMash(state); break;
      case 'color': this._updateColor(state); break;
      case 'memory': this._updateMemory(state); break;
    }
  }

  _updateMash(state) {
    const mini = state.mini || {};
    const offset = mini.offset || 0;
    const threshold = mini.threshold || 50;

    // My zone percentage: 50% at neutral, grows when winning
    const myPct = Math.max(15, Math.min(85, 50 + (offset / threshold) * 40));
    const oppPct = 100 - myPct;

    const meSide = document.getElementById('ca-mash-me-side');
    const oppSide = document.getElementById('ca-mash-opp-side');
    if (meSide) meSide.style.flex = String(myPct);
    if (oppSide) oppSide.style.flex = String(oppPct);

    // Scale viruses based on advantage
    const meVirus = document.getElementById('ca-mash-me-virus');
    const oppVirus = document.getElementById('ca-mash-opp-virus');
    const myScale = 0.7 + (myPct / 100) * 0.8;
    const oppScale = 0.7 + (oppPct / 100) * 0.8;
    if (meVirus) meVirus.style.fontSize = `${1.4 + myScale * 0.8}rem`;
    if (oppVirus) oppVirus.style.fontSize = `${1.4 + oppScale * 0.8}rem`;

    // Timer
    const timerEl = document.getElementById('ca-mash-timer');
    if (timerEl && mini.timeLimitMs) {
      timerEl.style.width = `${(mini.timeLeft / mini.timeLimitMs) * 100}%`;
    }
  }

  _updateColor(state) {
    const mini = state.mini || {};
    const track = document.getElementById('ca-color-track');
    if (!track || !mini.dots) return;

    // Build dots on first render
    if (track.children.length !== mini.dots.length) {
      track.innerHTML = '';
      mini.dots.forEach((_color, i) => {
        const dot = document.createElement('div');
        dot.className = 'ca-color-dot';
        dot.dataset.index = String(i);
        dot.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          this.network.sendGameAction({ type: 'dot', index: i });
          dot.classList.remove('ca-dot-tap');
          void dot.offsetWidth;
          dot.classList.add('ca-dot-tap');
        });
        track.appendChild(dot);
      });
    }

    // Update dot colors (preserves ca-dot-tap animation class)
    const dots = track.children;
    for (let i = 0; i < mini.dots.length; i++) {
      const dot = dots[i];
      if (!dot) continue;
      dot.classList.remove('ca-dot-merah', 'ca-dot-biru');
      dot.classList.add(mini.dots[i] === 'merah' ? 'ca-dot-merah' : 'ca-dot-biru');
    }

    // Timer
    const timerEl = document.getElementById('ca-color-timer');
    if (timerEl && mini.timeLimitMs) {
      timerEl.style.width = `${(mini.timeLeft / mini.timeLimitMs) * 100}%`;
    }
  }

  _updateMemory(state) {
    const mini = state.mini || {};
    const display = document.getElementById('ca-mem-display');
    const prompt = document.getElementById('ca-mem-prompt');
    const current = document.getElementById('ca-mem-current');
    const status = document.getElementById('ca-mem-status');
    const progress = document.getElementById('ca-mem-progress');

    if (mini.memoryPhase === 'display') {
      if (display) display.style.display = '';
      if (prompt) prompt.style.display = 'none';

      if (current && mini.currentVirus) {
        const emoji = mini.currentVirus === 'merah' ? '\uD83D\uDD34' : '\uD83D\uDD35';
        current.textContent = emoji;
        current.classList.remove('ca-mem-virus-show');
        void current.offsetWidth;
        current.classList.add('ca-mem-virus-show');
      } else if (current) {
        current.textContent = '';
      }

      if (progress && mini.displayTotal) {
        progress.textContent = `${mini.displayProgress || 0} / ${mini.displayTotal}`;
      }

      if (status) status.textContent = '\uD83E\uDDE0 Hitung virusnya!';

    } else if (mini.memoryPhase === 'pause') {
      if (current) { current.textContent = '\uD83E\uDD14'; current.className = 'ca-mem-current'; }
      if (status) status.textContent = 'Bersiap menjawab...';
      if (progress) progress.textContent = '';

    } else if (mini.memoryPhase === 'prompt') {
      if (display) display.style.display = 'none';
      if (!prompt) return;
      prompt.style.display = '';

      // Build prompt UI once
      if (!prompt.dataset.built) {
        prompt.dataset.built = 'true';
        const colorEmoji = mini.askColor === 'merah' ? '\uD83D\uDD34' : '\uD83D\uDD35';
        const colorName = mini.askColor === 'merah' ? 'MERAH' : 'BIRU';

        prompt.innerHTML = `
          <div class="ca-mem-question">Berapa virus ${colorEmoji} ${colorName}?</div>
          <div class="ca-mem-options" id="ca-mem-options">
            ${(mini.options || []).map((opt) => `
              <button class="ca-mem-opt" data-val="${opt}">${opt}</button>
            `).join('')}
          </div>
          <div class="ca-mem-feedback" id="ca-mem-feedback"></div>
        `;

        prompt.querySelectorAll('.ca-mem-opt').forEach((btn) => {
          btn.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            this.network.sendGameAction({ type: 'answer', value: Number(btn.dataset.val) });
          });
        });
      }

      // Update feedback
      const feedback = document.getElementById('ca-mem-feedback');
      if (feedback) {
        if (mini.myLocked) {
          feedback.textContent = `\u274C Salah! Jawabannya ${mini.correctAnswer ?? '?'}`;
          feedback.className = 'ca-mem-feedback ca-mem-wrong';
          prompt.querySelectorAll('.ca-mem-opt').forEach((b) => { b.disabled = true; });
        } else if (mini.oppLocked && mini.myAnswer === null) {
          feedback.textContent = '\uD83D\uDE0F Lawan salah! Giliran kamu~';
          feedback.className = 'ca-mem-feedback';
        }
      }
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
