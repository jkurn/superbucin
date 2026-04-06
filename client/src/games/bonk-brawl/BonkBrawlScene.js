import { EventBus } from '../../shared/EventBus.js';

/**
 * Cute aggression fighting game scene.
 * DOM-based: two characters, HP bars, BONK + SHIELD buttons.
 */
export class BonkBrawlScene {
  constructor(sceneManager, network, _ui, gameData) {
    this.sceneManager = sceneManager;
    this.network = network;
    this.gameData = gameData;
    this.rootEl = null;
    this.lastState = null;
    this._blocking = false;
    this._shakeTimer = null;
    this._floaters = [];
    this._onState = (s) => this._applyState(s);
  }

  init() {
    const canvas = this.sceneManager.renderer?.domElement;
    if (canvas) canvas.style.visibility = 'hidden';

    this.rootEl = document.createElement('div');
    this.rootEl.className = 'bk-layer';
    document.getElementById('ui-overlay').appendChild(this.rootEl);

    this._buildLayout();

    EventBus.on('bonk:state', this._onState);
    if (this.gameData.bonkState) {
      this._applyState(this.gameData.bonkState);
    }
  }

  _buildLayout() {
    this.rootEl.innerHTML = `
      <div class="bk-arena" id="bk-arena">
        <div class="bk-round-info" id="bk-round-info"></div>
        <div class="bk-hp-section">
          <div class="bk-hp-row bk-hp-mine">
            <span class="bk-hp-char" id="bk-my-char"></span>
            <div class="bk-hp-bar-wrap">
              <div class="bk-hp-bar bk-hp-bar-me" id="bk-my-hp"></div>
            </div>
            <span class="bk-hp-text" id="bk-my-hp-text"></span>
          </div>
          <div class="bk-hp-row bk-hp-opp">
            <span class="bk-hp-char" id="bk-opp-char"></span>
            <div class="bk-hp-bar-wrap">
              <div class="bk-hp-bar bk-hp-bar-opp" id="bk-opp-hp"></div>
            </div>
            <span class="bk-hp-text" id="bk-opp-hp-text"></span>
          </div>
        </div>

        <div class="bk-stage" id="bk-stage">
          <div class="bk-fighter bk-fighter-left" id="bk-fighter-me">
            <div class="bk-fighter-emoji" id="bk-me-emoji"></div>
            <div class="bk-fighter-weapon" id="bk-me-weapon"></div>
          </div>
          <div class="bk-vs">VS</div>
          <div class="bk-fighter bk-fighter-right" id="bk-fighter-opp">
            <div class="bk-fighter-emoji" id="bk-opp-emoji"></div>
            <div class="bk-fighter-weapon" id="bk-opp-weapon"></div>
          </div>
          <div class="bk-floaters" id="bk-floaters"></div>
        </div>

        <div class="bk-center-msg" id="bk-center-msg"></div>

        <div class="bk-meters">
          <div class="bk-meter-row">
            <span class="bk-meter-label">\u26A1 Special</span>
            <div class="bk-meter-bar-wrap">
              <div class="bk-meter-bar bk-special-bar" id="bk-special-bar"></div>
            </div>
          </div>
          <div class="bk-meter-row">
            <span class="bk-meter-label">\uD83D\uDEE1\uFE0F Shield</span>
            <div class="bk-meter-bar-wrap">
              <div class="bk-meter-bar bk-shield-bar" id="bk-shield-bar"></div>
            </div>
          </div>
        </div>

        <div class="bk-controls" id="bk-controls">
          <button class="bk-btn bk-btn-bonk" id="bk-btn-bonk">\uD83D\uDCA5 BONK</button>
          <button class="bk-btn bk-btn-shield" id="bk-btn-shield">\uD83D\uDEE1\uFE0F SHIELD</button>
        </div>
      </div>
    `;

    // BONK button
    const bonkBtn = document.getElementById('bk-btn-bonk');
    bonkBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.network.sendGameAction({ type: 'attack' });
    });

    // SHIELD button — hold to block
    const shieldBtn = document.getElementById('bk-btn-shield');
    shieldBtn.addEventListener('pointerdown', (e) => {
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
    shieldBtn.addEventListener('pointerup', stopBlock);
    shieldBtn.addEventListener('pointerleave', stopBlock);
    shieldBtn.addEventListener('pointercancel', stopBlock);
  }

  _applyState(state) {
    this.lastState = state;
    if (!this.rootEl) return;

    // Round info
    const roundInfo = document.getElementById('bk-round-info');
    if (roundInfo) {
      const myWins = '\u2B50'.repeat(state.myRoundWins) + '\u2796'.repeat(state.roundsToWin - state.myRoundWins);
      const oppWins = '\u2B50'.repeat(state.oppRoundWins) + '\u2796'.repeat(state.roundsToWin - state.oppRoundWins);
      roundInfo.innerHTML = `<span>${myWins}</span><span>Round ${state.round}</span><span>${oppWins}</span>`;
    }

    // HP bars
    this._updateHP('bk-my-hp', 'bk-my-hp-text', state.me);
    this._updateHP('bk-opp-hp', 'bk-opp-hp-text', state.opp);

    // Characters
    const myChar = document.getElementById('bk-my-char');
    const oppChar = document.getElementById('bk-opp-char');
    if (myChar) myChar.textContent = state.me.character.emoji;
    if (oppChar) oppChar.textContent = state.opp.character.emoji;

    // Fighter emojis in stage
    const meEmoji = document.getElementById('bk-me-emoji');
    const oppEmoji = document.getElementById('bk-opp-emoji');
    if (meEmoji) meEmoji.textContent = state.me.character.emoji;
    if (oppEmoji) oppEmoji.textContent = state.opp.character.emoji;

    // Weapons
    const meWeapon = document.getElementById('bk-me-weapon');
    const oppWeapon = document.getElementById('bk-opp-weapon');
    if (meWeapon) meWeapon.textContent = state.me.character.weapon;
    if (oppWeapon) oppWeapon.textContent = state.opp.character.weapon;

    // Fighter states (CSS classes for animations)
    const meEl = document.getElementById('bk-fighter-me');
    const oppEl = document.getElementById('bk-fighter-opp');
    if (meEl) {
      meEl.className = `bk-fighter bk-fighter-left bk-state-${state.me.state}`;
    }
    if (oppEl) {
      oppEl.className = `bk-fighter bk-fighter-right bk-state-${state.opp.state}`;
    }

    // Meters
    const specialBar = document.getElementById('bk-special-bar');
    const shieldBar = document.getElementById('bk-shield-bar');
    if (specialBar) {
      const pct = (state.me.specialMeter / state.me.specialMax) * 100;
      specialBar.style.width = `${pct}%`;
      specialBar.classList.toggle('bk-special-ready', pct >= 100);
    }
    if (shieldBar) {
      const pct = (state.me.shieldHP / state.me.shieldMax) * 100;
      shieldBar.style.width = `${pct}%`;
    }

    // BONK button text changes when special is ready
    const bonkBtn = document.getElementById('bk-btn-bonk');
    if (bonkBtn) {
      if (state.me.specialMeter >= state.me.specialMax) {
        bonkBtn.textContent = '\u2B50 SUPER BONK';
        bonkBtn.classList.add('bk-btn-super');
      } else {
        bonkBtn.textContent = '\uD83D\uDCA5 BONK';
        bonkBtn.classList.remove('bk-btn-super');
      }
    }

    // Controls enabled/disabled
    const controls = document.getElementById('bk-controls');
    if (controls) {
      controls.classList.toggle('bk-controls-disabled', state.phase !== 'fighting');
    }

    // Center message
    const centerMsg = document.getElementById('bk-center-msg');
    if (centerMsg) {
      if (state.phase === 'countdown') {
        centerMsg.textContent = 'READY...';
        centerMsg.className = 'bk-center-msg bk-msg-countdown';
      } else if (state.phase === 'round-end') {
        const iWon = state.me.hp > 0 && state.opp.hp <= 0;
        centerMsg.textContent = iWon ? 'K.O.! \uD83C\uDF89' : 'K.O.! \uD83D\uDE35';
        centerMsg.className = `bk-center-msg bk-msg-ko ${iWon ? 'bk-msg-win' : 'bk-msg-lose'}`;
      } else if (state.phase === 'fighting') {
        centerMsg.textContent = 'FIGHT!';
        centerMsg.className = 'bk-center-msg bk-msg-fight';
        // Fade out "FIGHT!" after a moment
        setTimeout(() => {
          if (centerMsg.textContent === 'FIGHT!') centerMsg.textContent = '';
        }, 800);
      } else {
        centerMsg.textContent = '';
        centerMsg.className = 'bk-center-msg';
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
      if (pct < 25) bar.classList.add('bk-hp-critical');
      else bar.classList.remove('bk-hp-critical');
    }
    if (text) {
      text.textContent = `${fighter.hp}`;
    }
  }

  _processHitEvents(events) {
    if (!events || events.length === 0) return;

    const arena = document.getElementById('bk-arena');
    const floaters = document.getElementById('bk-floaters');

    for (const evt of events) {
      // Screen shake on hits
      if (arena && (evt.iGotHit || evt.isSpecial)) {
        arena.classList.add('bk-shake');
        clearTimeout(this._shakeTimer);
        this._shakeTimer = setTimeout(() => arena.classList.remove('bk-shake'), 200);
      }

      // Floating damage/effect text
      if (floaters) {
        const float = document.createElement('div');
        float.className = 'bk-float';

        if (evt.isSpecial) {
          float.textContent = evt.iDidIt ? `\u2B50 -${evt.damage}` : `\uD83D\uDCA2 -${evt.damage}!`;
          float.classList.add('bk-float-special');
        } else if (evt.blocked) {
          float.textContent = evt.iDidIt ? '\uD83D\uDEE1\uFE0F Blocked!' : '\uD83D\uDEE1\uFE0F -2';
          float.classList.add('bk-float-blocked');
        } else {
          float.textContent = evt.iDidIt ? `\uD83D\uDCA5 -${evt.damage}` : `\uD83D\uDE35 -${evt.damage}`;
          float.classList.add(evt.iDidIt ? 'bk-float-hit' : 'bk-float-hurt');
        }

        // Position: left side if I did it, right side if opponent
        float.style.left = evt.iDidIt ? '65%' : '35%';
        floaters.appendChild(float);

        setTimeout(() => float.remove(), 1000);
      }
    }
  }

  destroy() {
    EventBus.off('bonk:state', this._onState);
    clearTimeout(this._shakeTimer);
    this.rootEl?.remove();
    this.rootEl = null;
    const canvas = this.sceneManager.renderer?.domElement;
    if (canvas) canvas.style.visibility = '';
  }
}
