import { EventBus } from '../../shared/EventBus.js';

/**
 * Cute Aggression — Super Bucin fighting game scene.
 * DOM-based: two cute blob creatures, HP bars, GEMAS + PELUK + CUBIT buttons.
 * Inspired by Virus vs Virus — red blob vs blue blob with maximum cute aggression.
 */
export class CuteAggressionScene {
  constructor(sceneManager, network, _ui, gameData) {
    this.sceneManager = sceneManager;
    this.network = network;
    this.gameData = gameData;
    this.rootEl = null;
    this.lastState = null;
    this._blocking = false;
    this._charging = false;
    this._shakeTimer = null;
    this._heartInterval = null;
    this._onState = (s) => this._applyState(s);
  }

  init() {
    const canvas = this.sceneManager.renderer?.domElement;
    if (canvas) canvas.style.visibility = 'hidden';

    this.rootEl = document.createElement('div');
    this.rootEl.className = 'ca-layer';
    document.getElementById('ui-overlay').appendChild(this.rootEl);

    this._buildLayout();
    this._startHeartRain();

    EventBus.on('cute-aggression:state', this._onState);
    if (this.gameData.cuteAggressionState) {
      this._applyState(this.gameData.cuteAggressionState);
    }
  }

  _startHeartRain() {
    const bg = this.rootEl.querySelector('.ca-heart-bg');
    if (!bg) return;

    const hearts = ['\u2764\uFE0F', '\uD83D\uDC95', '\uD83D\uDC96', '\uD83D\uDC97', '\uD83D\uDC93', '\u2728', '\uD83C\uDF1F'];

    this._heartInterval = setInterval(() => {
      const heart = document.createElement('div');
      heart.className = 'ca-falling-heart';
      heart.textContent = hearts[Math.floor(Math.random() * hearts.length)];
      heart.style.left = `${Math.random() * 100}%`;
      heart.style.animationDuration = `${2 + Math.random() * 3}s`;
      heart.style.fontSize = `${0.6 + Math.random() * 0.8}rem`;
      heart.style.opacity = `${0.3 + Math.random() * 0.4}`;
      bg.appendChild(heart);
      setTimeout(() => heart.remove(), 5000);
    }, 300);
  }

  _buildLayout() {
    this.rootEl.innerHTML = `
      <div class="ca-heart-bg"></div>
      <div class="ca-arena" id="ca-arena">
        <div class="ca-round-info" id="ca-round-info"></div>
        <div class="ca-hp-section">
          <div class="ca-hp-row ca-hp-mine">
            <div class="ca-hp-icon" id="ca-my-icon"></div>
            <div class="ca-hp-bar-wrap">
              <div class="ca-hp-bar ca-hp-bar-me" id="ca-my-hp"></div>
            </div>
            <span class="ca-hp-text" id="ca-my-hp-text"></span>
          </div>
          <div class="ca-hp-row ca-hp-opp">
            <div class="ca-hp-icon" id="ca-opp-icon"></div>
            <div class="ca-hp-bar-wrap">
              <div class="ca-hp-bar ca-hp-bar-opp" id="ca-opp-hp"></div>
            </div>
            <span class="ca-hp-text" id="ca-opp-hp-text"></span>
          </div>
        </div>

        <div class="ca-stage" id="ca-stage">
          <div class="ca-blob ca-blob-left" id="ca-blob-me">
            <div class="ca-blob-body" id="ca-me-body">
              <div class="ca-blob-eye ca-eye-left"></div>
              <div class="ca-blob-eye ca-eye-right"></div>
              <div class="ca-blob-mouth"></div>
            </div>
            <div class="ca-blob-label" id="ca-me-label"></div>
          </div>
          <div class="ca-vs-heart">\u2764\uFE0F</div>
          <div class="ca-blob ca-blob-right" id="ca-blob-opp">
            <div class="ca-blob-body" id="ca-opp-body">
              <div class="ca-blob-eye ca-eye-left"></div>
              <div class="ca-blob-eye ca-eye-right"></div>
              <div class="ca-blob-mouth"></div>
            </div>
            <div class="ca-blob-label" id="ca-opp-label"></div>
          </div>
          <div class="ca-floaters" id="ca-floaters"></div>
        </div>

        <div class="ca-center-msg" id="ca-center-msg"></div>

        <div class="ca-meters">
          <div class="ca-meter-row">
            <span class="ca-meter-label">\uD83D\uDC96 Gemas</span>
            <div class="ca-meter-bar-wrap">
              <div class="ca-meter-bar ca-special-bar" id="ca-special-bar"></div>
            </div>
          </div>
          <div class="ca-meter-row">
            <span class="ca-meter-label">\uD83E\uDD17 Peluk</span>
            <div class="ca-meter-bar-wrap">
              <div class="ca-meter-bar ca-shield-bar" id="ca-shield-bar"></div>
            </div>
          </div>
        </div>

        <div class="ca-controls" id="ca-controls">
          <button class="ca-btn ca-btn-gemas" id="ca-btn-gemas">\uD83D\uDE21 GEMAS</button>
          <button class="ca-btn ca-btn-cubit" id="ca-btn-cubit">
            \uD83E\uDD0F CUBIT
            <div class="ca-cubit-charge-bar"><div class="ca-cubit-charge-fill" id="ca-cubit-fill"></div></div>
          </button>
          <button class="ca-btn ca-btn-peluk" id="ca-btn-peluk">\uD83E\uDD17 PELUK</button>
        </div>
      </div>
    `;

    // GEMAS (squeeze attack) button
    const gemasBtn = document.getElementById('ca-btn-gemas');
    gemasBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.network.sendGameAction({ type: 'attack' });
    });

    // PELUK (hug shield) button — hold to block
    const pelukBtn = document.getElementById('ca-btn-peluk');
    pelukBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this._blocking = true;
      this.network.sendGameAction({ type: 'block-start' });
    });

    const stopBlock = (e) => {
      e.preventDefault();
      if (this._blocking) {
        this._blocking = false;
        this.network.sendGameAction({ type: 'block-end' });
      }
    };
    pelukBtn.addEventListener('pointerup', stopBlock);
    pelukBtn.addEventListener('pointerleave', stopBlock);
    pelukBtn.addEventListener('pointercancel', stopBlock);

    // CUBIT (pinch charge) button — hold to charge, release to unleash
    const cubitBtn = document.getElementById('ca-btn-cubit');
    cubitBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this._charging = true;
      this.network.sendGameAction({ type: 'cubit-start' });
    });

    const releaseCubit = (e) => {
      e.preventDefault();
      if (this._charging) {
        this._charging = false;
        this.network.sendGameAction({ type: 'cubit-release' });
      }
    };
    cubitBtn.addEventListener('pointerup', releaseCubit);
    cubitBtn.addEventListener('pointerleave', releaseCubit);
    cubitBtn.addEventListener('pointercancel', releaseCubit);
  }

  _applyState(state) {
    this.lastState = state;
    if (!this.rootEl) return;

    // Round info
    const roundInfo = document.getElementById('ca-round-info');
    if (roundInfo) {
      const myWins = '\uD83D\uDC96'.repeat(state.myRoundWins) + '\uD83D\uDDA4'.repeat(state.roundsToWin - state.myRoundWins);
      const oppWins = '\uD83D\uDC96'.repeat(state.oppRoundWins) + '\uD83D\uDDA4'.repeat(state.roundsToWin - state.oppRoundWins);
      roundInfo.innerHTML = `<span>${myWins}</span><span>Round ${state.round}</span><span>${oppWins}</span>`;
    }

    // HP bars
    this._updateHP('ca-my-hp', 'ca-my-hp-text', state.me);
    this._updateHP('ca-opp-hp', 'ca-opp-hp-text', state.opp);

    // HP icons (colored hearts)
    const myIcon = document.getElementById('ca-my-icon');
    const oppIcon = document.getElementById('ca-opp-icon');
    if (myIcon) myIcon.textContent = state.me.character.emoji;
    if (oppIcon) oppIcon.textContent = state.opp.character.emoji;

    // Blob bodies — color based on side
    const meBody = document.getElementById('ca-me-body');
    const oppBody = document.getElementById('ca-opp-body');
    if (meBody) meBody.style.background = state.me.character.color;
    if (oppBody) oppBody.style.background = state.opp.character.color;

    // Labels
    const meLabel = document.getElementById('ca-me-label');
    const oppLabel = document.getElementById('ca-opp-label');
    if (meLabel) meLabel.textContent = state.me.character.name;
    if (oppLabel) oppLabel.textContent = state.opp.character.name;

    // Blob states (CSS classes for animations)
    const meEl = document.getElementById('ca-blob-me');
    const oppEl = document.getElementById('ca-blob-opp');
    if (meEl) {
      meEl.className = `ca-blob ca-blob-left ca-state-${state.me.state}`;
    }
    if (oppEl) {
      oppEl.className = `ca-blob ca-blob-right ca-state-${state.opp.state}`;
    }

    // Meters
    const specialBar = document.getElementById('ca-special-bar');
    const shieldBar = document.getElementById('ca-shield-bar');
    if (specialBar) {
      const pct = (state.me.specialMeter / state.me.specialMax) * 100;
      specialBar.style.width = `${pct}%`;
      specialBar.classList.toggle('ca-special-ready', pct >= 100);
    }
    if (shieldBar) {
      const pct = (state.me.shieldHP / state.me.shieldMax) * 100;
      shieldBar.style.width = `${pct}%`;
    }

    // GEMAS button text changes when special is ready
    const gemasBtn = document.getElementById('ca-btn-gemas');
    if (gemasBtn) {
      if (state.me.specialMeter >= state.me.specialMax) {
        gemasBtn.textContent = '\uD83D\uDC8B CIUMM!!';
        gemasBtn.classList.add('ca-btn-super');
      } else {
        gemasBtn.textContent = '\uD83D\uDE21 GEMAS';
        gemasBtn.classList.remove('ca-btn-super');
      }
    }

    // Cubit charge bar
    const cubitFill = document.getElementById('ca-cubit-fill');
    const cubitBtn = document.getElementById('ca-btn-cubit');
    if (cubitFill) {
      const pct = (state.me.chargePct || 0) * 100;
      cubitFill.style.width = `${pct}%`;
      cubitFill.classList.toggle('ca-cubit-charged', pct >= 60);
    }
    if (cubitBtn) {
      cubitBtn.classList.toggle('ca-btn-cubit-active', state.me.state === 'charging');
    }

    // Show charge indicator on opponent
    if (oppEl && state.opp.state === 'charging') {
      if (!oppEl.querySelector('.ca-charge-glow')) {
        const glow = document.createElement('div');
        glow.className = 'ca-charge-glow';
        glow.textContent = '\uD83E\uDD0F';
        oppEl.appendChild(glow);
      }
    } else if (oppEl) {
      const existing = oppEl.querySelector('.ca-charge-glow');
      if (existing) existing.remove();
    }

    // Controls enabled/disabled
    const controls = document.getElementById('ca-controls');
    if (controls) {
      controls.classList.toggle('ca-controls-disabled', state.phase !== 'fighting');
    }

    // Center message
    const centerMsg = document.getElementById('ca-center-msg');
    if (centerMsg) {
      if (state.phase === 'countdown') {
        centerMsg.textContent = 'SIAP-SIAP SAYANG~';
        centerMsg.className = 'ca-center-msg ca-msg-countdown';
      } else if (state.phase === 'round-end') {
        const iWon = state.me.hp > 0 && state.opp.hp <= 0;
        centerMsg.textContent = iWon ? 'GEMESSS! \uD83D\uDC96\uD83D\uDC96\uD83D\uDC96' : 'Yahhh kena~ \uD83D\uDE35\u200D\uD83D\uDCAB';
        centerMsg.className = `ca-center-msg ca-msg-ko ${iWon ? 'ca-msg-win' : 'ca-msg-lose'}`;
      } else if (state.phase === 'fighting') {
        centerMsg.textContent = 'GEMAS!! \uD83D\uDE24';
        centerMsg.className = 'ca-center-msg ca-msg-fight';
        setTimeout(() => {
          if (centerMsg.textContent.startsWith('GEMAS')) centerMsg.textContent = '';
        }, 800);
      } else {
        centerMsg.textContent = '';
        centerMsg.className = 'ca-center-msg';
      }
    }

    // Hit effects
    this._processHitEvents(state.hitEvents);
  }

  _updateHP(barId, textId, fighter) {
    const bar = document.getElementById(barId);
    const text = document.getElementById(textId);
    if (bar) {
      const pct = (fighter.hp / fighter.maxHp) * 100;
      bar.style.width = `${pct}%`;
      bar.classList.toggle('ca-hp-critical', pct < 25);
    }
    if (text) {
      text.textContent = `${fighter.hp}`;
    }
  }

  _processHitEvents(events) {
    if (!events || events.length === 0) return;

    const arena = document.getElementById('ca-arena');
    const floaters = document.getElementById('ca-floaters');

    for (const evt of events) {
      // Screen shake
      if (arena && (evt.iGotHit || evt.isSpecial)) {
        arena.classList.add('ca-shake');
        clearTimeout(this._shakeTimer);
        this._shakeTimer = setTimeout(() => arena.classList.remove('ca-shake'), 200);
      }

      // Floating damage/effect text
      if (floaters) {
        const float = document.createElement('div');
        float.className = 'ca-float';

        if (evt.isCubit) {
          const pwr = evt.chargeRatio >= 0.6 ? 'MAX ' : '';
          float.textContent = evt.iDidIt ? `\uD83E\uDD0F ${pwr}-${evt.damage}` : `\uD83E\uDD0F ${pwr}-${evt.damage}!`;
          float.classList.add('ca-float-cubit');
          if (evt.chargeRatio >= 0.6) float.classList.add('ca-float-cubit-max');
        } else if (evt.isSpecial) {
          float.textContent = evt.iDidIt ? `\uD83D\uDC8B CIUM -${evt.damage}` : `\uD83D\uDE35 DICIUM -${evt.damage}!`;
          float.classList.add('ca-float-special');
        } else if (evt.blocked) {
          float.textContent = evt.iDidIt ? '\uD83E\uDD17 Dipeluk!' : `\uD83E\uDD17 -${evt.damage}`;
          float.classList.add('ca-float-blocked');
        } else {
          float.textContent = evt.iDidIt ? `\uD83D\uDE21 -${evt.damage}` : `\uD83D\uDE16 -${evt.damage}`;
          float.classList.add(evt.iDidIt ? 'ca-float-hit' : 'ca-float-hurt');
        }

        float.style.left = evt.iDidIt ? '65%' : '35%';
        floaters.appendChild(float);
        setTimeout(() => float.remove(), 1000);
      }

      // Burst hearts on special attacks
      if (evt.isSpecial && floaters) {
        for (let i = 0; i < 8; i++) {
          const h = document.createElement('div');
          h.className = 'ca-burst-heart';
          h.textContent = ['\uD83D\uDC95', '\uD83D\uDC96', '\uD83D\uDC97', '\uD83D\uDC8B', '\u2764\uFE0F'][Math.floor(Math.random() * 5)];
          h.style.left = `${30 + Math.random() * 40}%`;
          h.style.top = `${20 + Math.random() * 40}%`;
          h.style.animationDelay = `${i * 50}ms`;
          floaters.appendChild(h);
          setTimeout(() => h.remove(), 1200);
        }
      }
    }
  }

  destroy() {
    EventBus.off('cute-aggression:state', this._onState);
    clearTimeout(this._shakeTimer);
    clearInterval(this._heartInterval);
    this.rootEl?.remove();
    this.rootEl = null;
    const canvas = this.sceneManager.renderer?.domElement;
    if (canvas) canvas.style.visibility = '';
  }
}
