import { EventBus } from '../../shared/EventBus.js';

/**
 * Cute Aggression — SUPER BUCIN MAXIMUM GEMAS Edition!
 * DOM-based: two cute blob creatures with arms, legs, expressive faces.
 * GEMAS (squeeze) + GIGIT (bite combo) + CUBIT (charge pinch) + PELUK (hug shield)
 * Special: CIUM (kiss super attack) with heart explosion.
 * Combo counter, rage mode, falling hearts, screen shake, emoji explosions.
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
    this._comboTimeout = null;
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

    const particles = [
      '\u2764\uFE0F', '\uD83D\uDC95', '\uD83D\uDC96', '\uD83D\uDC97', '\uD83D\uDC93',
      '\u2728', '\uD83C\uDF1F', '\uD83D\uDC8B', '\uD83E\uDD0F', '\uD83E\uDD17',
      '\uD83D\uDE18', '\uD83E\uDD70', '\uD83D\uDC9E', '\uD83D\uDC9D',
    ];

    this._heartInterval = setInterval(() => {
      const heart = document.createElement('div');
      heart.className = 'ca-falling-heart';
      heart.textContent = particles[Math.floor(Math.random() * particles.length)];
      heart.style.left = `${Math.random() * 100}%`;
      heart.style.animationDuration = `${2.5 + Math.random() * 4}s`;
      heart.style.fontSize = `${0.5 + Math.random() * 1}rem`;
      heart.style.opacity = `${0.2 + Math.random() * 0.4}`;
      bg.appendChild(heart);
      setTimeout(() => heart.remove(), 7000);
    }, 200);
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
              <div class="ca-hp-rage-overlay" id="ca-my-rage"></div>
            </div>
            <span class="ca-hp-text" id="ca-my-hp-text"></span>
          </div>
          <div class="ca-hp-row ca-hp-opp">
            <div class="ca-hp-icon" id="ca-opp-icon"></div>
            <div class="ca-hp-bar-wrap">
              <div class="ca-hp-bar ca-hp-bar-opp" id="ca-opp-hp"></div>
              <div class="ca-hp-rage-overlay" id="ca-opp-rage"></div>
            </div>
            <span class="ca-hp-text" id="ca-opp-hp-text"></span>
          </div>
        </div>

        <div class="ca-combo-display" id="ca-combo-display"></div>

        <div class="ca-stage" id="ca-stage">
          <div class="ca-blob ca-blob-left" id="ca-blob-me">
            <div class="ca-blob-arm ca-arm-left" id="ca-me-arm-l"></div>
            <div class="ca-blob-arm ca-arm-right" id="ca-me-arm-r"></div>
            <div class="ca-blob-body" id="ca-me-body">
              <div class="ca-blob-blush ca-blush-left"></div>
              <div class="ca-blob-blush ca-blush-right"></div>
              <div class="ca-blob-eye ca-eye-left">
                <div class="ca-pupil"></div>
              </div>
              <div class="ca-blob-eye ca-eye-right">
                <div class="ca-pupil"></div>
              </div>
              <div class="ca-blob-mouth" id="ca-me-mouth"></div>
              <div class="ca-blob-fang ca-fang-left"></div>
              <div class="ca-blob-fang ca-fang-right"></div>
            </div>
            <div class="ca-blob-feet">
              <div class="ca-foot ca-foot-left"></div>
              <div class="ca-foot ca-foot-right"></div>
            </div>
            <div class="ca-blob-label" id="ca-me-label"></div>
          </div>

          <div class="ca-vs-section">
            <div class="ca-vs-heart">\uD83D\uDC98</div>
            <div class="ca-vs-text">VS</div>
          </div>

          <div class="ca-blob ca-blob-right" id="ca-blob-opp">
            <div class="ca-blob-arm ca-arm-left" id="ca-opp-arm-l"></div>
            <div class="ca-blob-arm ca-arm-right" id="ca-opp-arm-r"></div>
            <div class="ca-blob-body" id="ca-opp-body">
              <div class="ca-blob-blush ca-blush-left"></div>
              <div class="ca-blob-blush ca-blush-right"></div>
              <div class="ca-blob-eye ca-eye-left">
                <div class="ca-pupil"></div>
              </div>
              <div class="ca-blob-eye ca-eye-right">
                <div class="ca-pupil"></div>
              </div>
              <div class="ca-blob-mouth" id="ca-opp-mouth"></div>
              <div class="ca-blob-fang ca-fang-left"></div>
              <div class="ca-blob-fang ca-fang-right"></div>
            </div>
            <div class="ca-blob-feet">
              <div class="ca-foot ca-foot-left"></div>
              <div class="ca-foot ca-foot-right"></div>
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
          <div class="ca-controls-row">
            <button class="ca-btn ca-btn-gemas" id="ca-btn-gemas">\uD83D\uDE21 GEMAS</button>
            <button class="ca-btn ca-btn-gigit" id="ca-btn-gigit">\uD83E\uDE77 GIGIT</button>
          </div>
          <div class="ca-controls-row">
            <button class="ca-btn ca-btn-cubit" id="ca-btn-cubit">
              \uD83E\uDD0F CUBIT
              <div class="ca-cubit-charge-bar"><div class="ca-cubit-charge-fill" id="ca-cubit-fill"></div></div>
            </button>
            <button class="ca-btn ca-btn-peluk" id="ca-btn-peluk">\uD83E\uDD17 PELUK</button>
          </div>
        </div>
      </div>
    `;

    // GEMAS (squeeze attack)
    const gemasBtn = document.getElementById('ca-btn-gemas');
    gemasBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.network.sendGameAction({ type: 'attack' });
    });

    // GIGIT (bite — fast combo attack)
    const gigitBtn = document.getElementById('ca-btn-gigit');
    gigitBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.network.sendGameAction({ type: 'gigit' });
    });

    // PELUK (hug shield — hold)
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

    // CUBIT (pinch charge — hold to charge, release to unleash)
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
      roundInfo.innerHTML = `<span>${myWins}</span><span class="ca-round-label">Round ${state.round}</span><span>${oppWins}</span>`;
    }

    // HP bars
    this._updateHP('ca-my-hp', 'ca-my-hp-text', state.me);
    this._updateHP('ca-opp-hp', 'ca-opp-hp-text', state.opp);

    // Rage overlays
    const myRage = document.getElementById('ca-my-rage');
    const oppRage = document.getElementById('ca-opp-rage');
    if (myRage) myRage.classList.toggle('ca-rage-active', state.me.rage);
    if (oppRage) oppRage.classList.toggle('ca-rage-active', state.opp.rage);

    // HP icons
    const myIcon = document.getElementById('ca-my-icon');
    const oppIcon = document.getElementById('ca-opp-icon');
    if (myIcon) myIcon.textContent = state.me.rage ? '\uD83D\uDD25' : state.me.character.emoji;
    if (oppIcon) oppIcon.textContent = state.opp.rage ? '\uD83D\uDD25' : state.opp.character.emoji;

    // Blob bodies — color
    const meBody = document.getElementById('ca-me-body');
    const oppBody = document.getElementById('ca-opp-body');
    if (meBody) meBody.style.background = `radial-gradient(circle at 35% 35%, ${state.me.character.colorLight}, ${state.me.character.color} 60%, ${state.me.character.colorDark})`;
    if (oppBody) oppBody.style.background = `radial-gradient(circle at 35% 35%, ${state.opp.character.colorLight}, ${state.opp.character.color} 60%, ${state.opp.character.colorDark})`;

    // Feet color
    this.rootEl.querySelectorAll('#ca-blob-me .ca-foot').forEach((f) => { f.style.background = state.me.character.colorDark; });
    this.rootEl.querySelectorAll('#ca-blob-opp .ca-foot').forEach((f) => { f.style.background = state.opp.character.colorDark; });

    // Arm color
    this.rootEl.querySelectorAll('#ca-blob-me .ca-blob-arm').forEach((a) => { a.style.background = state.me.character.color; });
    this.rootEl.querySelectorAll('#ca-blob-opp .ca-blob-arm').forEach((a) => { a.style.background = state.opp.character.color; });

    // Labels
    const meLabel = document.getElementById('ca-me-label');
    const oppLabel = document.getElementById('ca-opp-label');
    if (meLabel) meLabel.textContent = state.me.character.name;
    if (oppLabel) oppLabel.textContent = state.opp.character.name;

    // Blob states (CSS classes)
    const meEl = document.getElementById('ca-blob-me');
    const oppEl = document.getElementById('ca-blob-opp');
    if (meEl) {
      meEl.className = `ca-blob ca-blob-left ca-state-${state.me.state}${state.me.rage ? ' ca-rage' : ''}`;
    }
    if (oppEl) {
      oppEl.className = `ca-blob ca-blob-right ca-state-${state.opp.state}${state.opp.rage ? ' ca-rage' : ''}`;
    }

    // Mouth expression based on state
    this._updateMouth('ca-me-mouth', state.me.state, state.me.rage);
    this._updateMouth('ca-opp-mouth', state.opp.state, state.opp.rage);

    // Combo display
    const comboDisplay = document.getElementById('ca-combo-display');
    if (comboDisplay) {
      if (state.me.combo >= 2) {
        comboDisplay.textContent = `${state.me.combo}x COMBO! \uD83E\uDE77\uD83D\uDD25`;
        comboDisplay.className = `ca-combo-display ca-combo-show${state.me.combo >= 5 ? ' ca-combo-fire' : ''}`;
      } else {
        comboDisplay.className = 'ca-combo-display';
      }
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

    // GEMAS button upgrades to CIUM when special ready
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

    // GIGIT button also upgrades when special ready
    const gigitBtn = document.getElementById('ca-btn-gigit');
    if (gigitBtn) {
      if (state.me.specialMeter >= state.me.specialMax) {
        gigitBtn.textContent = '\uD83D\uDC8B CIUMM!!';
        gigitBtn.classList.add('ca-btn-super');
      } else {
        gigitBtn.textContent = '\uD83E\uDE77 GIGIT';
        gigitBtn.classList.remove('ca-btn-super');
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

    // Charge indicator on opponent
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

    // Controls
    const controls = document.getElementById('ca-controls');
    if (controls) {
      controls.classList.toggle('ca-controls-disabled', state.phase !== 'fighting');
    }

    // Center message
    const centerMsg = document.getElementById('ca-center-msg');
    if (centerMsg) {
      if (state.phase === 'countdown') {
        centerMsg.innerHTML = 'SIAP-SIAP SAYANG~<br><span class="ca-subtitle">jangan nangis ya\u2026</span>';
        centerMsg.className = 'ca-center-msg ca-msg-countdown';
      } else if (state.phase === 'round-end') {
        const iWon = state.me.hp > 0 && state.opp.hp <= 0;
        if (iWon) {
          centerMsg.innerHTML = 'GEMESSS!! \uD83D\uDC96\uD83D\uDC96\uD83D\uDC96<br><span class="ca-subtitle">habis di-gemasin~</span>';
        } else {
          centerMsg.innerHTML = 'Yahhh kena~ \uD83D\uDE35\u200D\uD83D\uDCAB<br><span class="ca-subtitle">terlalu gemas\u2026</span>';
        }
        centerMsg.className = `ca-center-msg ca-msg-ko ${iWon ? 'ca-msg-win' : 'ca-msg-lose'}`;
      } else if (state.phase === 'fighting') {
        centerMsg.innerHTML = 'GEMAS!! \uD83D\uDE24\uD83E\uDE77\uD83E\uDD0F';
        centerMsg.className = 'ca-center-msg ca-msg-fight';
        setTimeout(() => {
          if (centerMsg.textContent.startsWith('GEMAS')) {
            centerMsg.textContent = '';
            centerMsg.className = 'ca-center-msg';
          }
        }, 900);
      } else {
        centerMsg.textContent = '';
        centerMsg.className = 'ca-center-msg';
      }
    }

    // Hit effects
    this._processHitEvents(state.hitEvents);
  }

  _updateMouth(id, state, rage) {
    const mouth = document.getElementById(id);
    if (!mouth) return;
    // Reset
    mouth.className = 'ca-blob-mouth';
    if (state === 'gigit' || state === 'attacking') {
      mouth.classList.add('ca-mouth-open');
    } else if (state === 'special') {
      mouth.classList.add('ca-mouth-kiss');
    } else if (state === 'hurt') {
      mouth.classList.add('ca-mouth-ouch');
    } else if (state === 'blocking') {
      mouth.classList.add('ca-mouth-hug');
    } else if (state === 'charging') {
      mouth.classList.add('ca-mouth-focus');
    } else if (rage) {
      mouth.classList.add('ca-mouth-rage');
    }
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
      // Screen shake — bigger for specials
      if (arena && (evt.iGotHit || evt.isSpecial)) {
        arena.classList.remove('ca-shake', 'ca-shake-big');
        // Force reflow for re-triggering animation
        void arena.offsetWidth;
        arena.classList.add(evt.isSpecial ? 'ca-shake-big' : 'ca-shake');
        clearTimeout(this._shakeTimer);
        this._shakeTimer = setTimeout(() => {
          arena.classList.remove('ca-shake', 'ca-shake-big');
        }, evt.isSpecial ? 400 : 200);
      }

      // Floating damage/effect text
      if (floaters) {
        const float = document.createElement('div');
        float.className = 'ca-float';

        if (evt.isGigit) {
          const comboText = evt.combo >= 2 ? ` ${evt.combo}x` : '';
          float.textContent = evt.iDidIt
            ? `\uD83E\uDE77 GIGIT${comboText} -${evt.damage}`
            : `\uD83E\uDE77 -${evt.damage}!`;
          float.classList.add('ca-float-gigit');
          if (evt.combo >= 5) float.classList.add('ca-float-combo-fire');
        } else if (evt.isCubit) {
          const pwr = evt.chargeRatio >= 0.6 ? 'MAX ' : '';
          float.textContent = evt.iDidIt
            ? `\uD83E\uDD0F ${pwr}CUBIT -${evt.damage}`
            : `\uD83E\uDD0F ${pwr}-${evt.damage}!`;
          float.classList.add('ca-float-cubit');
          if (evt.chargeRatio >= 0.6) float.classList.add('ca-float-cubit-max');
        } else if (evt.isSpecial) {
          float.textContent = evt.iDidIt
            ? `\uD83D\uDC8B\uD83D\uDC8B CIUM!! -${evt.damage}`
            : `\uD83D\uDE35 DICIUM!! -${evt.damage}`;
          float.classList.add('ca-float-special');
        } else if (evt.blocked) {
          float.textContent = evt.iDidIt ? '\uD83E\uDD17 Dipeluk~' : `\uD83E\uDD17 -${evt.damage}`;
          float.classList.add('ca-float-blocked');
        } else {
          float.textContent = evt.iDidIt
            ? `\uD83D\uDE21 GEMAS -${evt.damage}`
            : `\uD83D\uDE16 -${evt.damage}`;
          float.classList.add(evt.iDidIt ? 'ca-float-hit' : 'ca-float-hurt');
        }

        float.style.left = evt.iDidIt ? '60%' : '40%';
        float.style.top = `${20 + Math.random() * 25}%`;
        floaters.appendChild(float);
        setTimeout(() => float.remove(), 1200);
      }

      // GIGIT bite marks
      if (evt.isGigit && !evt.blocked && floaters) {
        const bite = document.createElement('div');
        bite.className = 'ca-bite-mark';
        bite.textContent = '\uD83E\uDE77';
        bite.style.left = evt.iDidIt ? '60%' : '40%';
        bite.style.top = `${35 + Math.random() * 20}%`;
        floaters.appendChild(bite);
        setTimeout(() => bite.remove(), 800);
      }

      // Heart/kiss explosions on special attacks
      if (evt.isSpecial && floaters) {
        const emojis = ['\uD83D\uDC95', '\uD83D\uDC96', '\uD83D\uDC97', '\uD83D\uDC8B', '\u2764\uFE0F', '\uD83D\uDE18', '\uD83E\uDD70', '\uD83D\uDC9E', '\uD83D\uDC93', '\u2728'];
        for (let i = 0; i < 15; i++) {
          const h = document.createElement('div');
          h.className = 'ca-burst-heart';
          h.textContent = emojis[Math.floor(Math.random() * emojis.length)];
          h.style.left = `${20 + Math.random() * 60}%`;
          h.style.top = `${10 + Math.random() * 50}%`;
          h.style.animationDelay = `${i * 40}ms`;
          h.style.fontSize = `${1 + Math.random() * 1.2}rem`;
          floaters.appendChild(h);
          setTimeout(() => h.remove(), 1500);
        }
      }

      // Cubit max charge sparkles
      if (evt.isCubit && evt.chargeRatio >= 0.6 && floaters) {
        for (let i = 0; i < 6; i++) {
          const s = document.createElement('div');
          s.className = 'ca-burst-heart';
          s.textContent = ['\uD83E\uDD0F', '\u2728', '\uD83D\uDCAB'][Math.floor(Math.random() * 3)];
          s.style.left = `${35 + Math.random() * 30}%`;
          s.style.top = `${25 + Math.random() * 30}%`;
          s.style.animationDelay = `${i * 60}ms`;
          floaters.appendChild(s);
          setTimeout(() => s.remove(), 1000);
        }
      }
    }
  }

  destroy() {
    EventBus.off('cute-aggression:state', this._onState);
    clearTimeout(this._shakeTimer);
    clearTimeout(this._comboTimeout);
    clearInterval(this._heartInterval);
    this.rootEl?.remove();
    this.rootEl = null;
    const canvas = this.sceneManager.renderer?.domElement;
    if (canvas) canvas.style.visibility = '';
  }
}
