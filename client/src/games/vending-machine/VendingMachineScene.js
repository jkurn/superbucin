import { EventBus } from '../../shared/EventBus.js';
import { GAME_CONFIG } from './config.js';

export class VendingMachineScene {
  constructor(sceneManager, network, _ui, gameData) {
    this.sceneManager = sceneManager;
    this.network = network;
    this.gameData = gameData;
    this.rootEl = null;
    this.lastState = null;
    this.selectedCell = null; // {row, col} awaiting drink pick
    this._onState = (s) => this._applyState(s);
  }

  init() {
    const canvas = this.sceneManager.renderer?.domElement;
    if (canvas) canvas.style.visibility = 'hidden';

    this.rootEl = document.createElement('div');
    this.rootEl.className = 'vm-layer';
    const overlay = document.getElementById('ui-overlay');
    overlay.appendChild(this.rootEl);

    EventBus.on('vending:state', this._onState);
    if (this.gameData.vendingState) {
      this._applyState(this.gameData.vendingState);
    }
  }

  _applyState(state) {
    this.lastState = state;
    this.selectedCell = null;

    const root = this.rootEl;
    if (!root) return;

    root.innerHTML = '';

    if (state.phase === 'countdown') {
      root.innerHTML = `
        <div class="vm-countdown">
          <div class="vm-countdown-icon">\uD83C\uDF38\uD83E\uDD64</div>
          <div class="vm-countdown-text">Vending Machine Tycoon!</div>
          <div class="vm-countdown-sub">Get ready to build your empire~</div>
        </div>
      `;
      return;
    }

    // Main game layout
    const wrapper = document.createElement('div');
    wrapper.className = 'vm-wrapper';

    // Event banner
    if (state.currentEvent) {
      const evt = document.createElement('div');
      evt.className = 'vm-event-banner';
      evt.innerHTML = `<span>${state.currentEvent.emoji} ${state.currentEvent.name}</span>`;
      if (state.currentEvent.boost) {
        const boostDrink = GAME_CONFIG.drinks.find((d) => d.id === state.currentEvent.boost);
        if (boostDrink) {
          evt.innerHTML += `<span class="vm-event-boost">${boostDrink.emoji} sales \u2191</span>`;
        }
      }
      wrapper.appendChild(evt);
    }

    // Score bar
    const scores = document.createElement('div');
    scores.className = 'vm-scores';
    scores.innerHTML = `
      <div class="vm-score vm-score-mine ${state.isMyTurn ? 'vm-score-active' : ''}">
        <div class="vm-score-label">You</div>
        <div class="vm-score-yen">\u00A5${state.myYen.toLocaleString()}</div>
        <div class="vm-score-machines">\uD83C\uDF7A ${state.myMachines}</div>
      </div>
      <div class="vm-round-info">
        <div class="vm-round">Round ${state.round}/${state.totalRounds}</div>
        <div class="vm-turn-indicator">${state.isMyTurn ? '\uD83D\uDC49 Your turn!' : 'Waiting...'}</div>
      </div>
      <div class="vm-score vm-score-opp ${!state.isMyTurn ? 'vm-score-active' : ''}">
        <div class="vm-score-label">Sayang</div>
        <div class="vm-score-yen">\u00A5${state.oppYen.toLocaleString()}</div>
        <div class="vm-score-machines">\uD83C\uDF7A ${state.oppMachines}</div>
      </div>
    `;
    wrapper.appendChild(scores);

    // Grid
    const gridEl = document.createElement('div');
    gridEl.className = 'vm-grid';
    gridEl.style.setProperty('--vm-cols', GAME_CONFIG.gridCols);

    for (let r = 0; r < GAME_CONFIG.gridRows; r++) {
      for (let c = 0; c < GAME_CONFIG.gridCols; c++) {
        const cell = document.createElement('div');
        cell.className = 'vm-cell';
        cell.dataset.row = r;
        cell.dataset.col = c;

        const locType = state.mapLayout[r][c];
        const loc = GAME_CONFIG.locations[locType];
        const gridCell = state.grid[r][c];

        if (gridCell) {
          // Machine placed here
          const drink = GAME_CONFIG.drinks.find((d) => d.id === gridCell.drinkId);
          cell.classList.add(gridCell.isMine ? 'vm-cell-mine' : 'vm-cell-opp');
          cell.innerHTML = `
            <div class="vm-machine">
              <div class="vm-machine-icon">\uD83C\uDF7A</div>
              <div class="vm-machine-drink">${drink ? drink.emoji : ''}</div>
            </div>
          `;

          // Highlight last placement
          if (state.lastPlacement &&
              state.lastPlacement.row === r &&
              state.lastPlacement.col === c) {
            cell.classList.add('vm-cell-last');
          }
        } else {
          // Empty cell — show location info
          cell.classList.add('vm-cell-empty');
          if (state.isMyTurn) {
            cell.classList.add('vm-cell-clickable');
          }
          cell.innerHTML = `
            <div class="vm-loc-emoji">${loc ? loc.emoji : ''}</div>
            <div class="vm-loc-name">${loc ? loc.name : ''}</div>
            <div class="vm-loc-traffic">${'\u2B50'.repeat(loc ? loc.traffic : 0)}</div>
          `;

          if (state.isMyTurn) {
            cell.addEventListener('click', () => this._onCellClick(r, c));
          }
        }

        gridEl.appendChild(cell);
      }
    }

    wrapper.appendChild(gridEl);

    // Income feedback
    if (state.lastPlacement && state.lastPlacement.income > 0) {
      const fb = document.createElement('div');
      fb.className = 'vm-income-feedback';
      fb.textContent = `+\u00A5${state.lastPlacement.income.toLocaleString()} income this turn!`;
      wrapper.appendChild(fb);
    }

    root.appendChild(wrapper);
  }

  _onCellClick(row, col) {
    const state = this.lastState;
    if (!state || !state.isMyTurn) return;
    if (state.grid[row][col] !== null) return;

    this.selectedCell = { row, col };
    this._showDrinkPicker(row, col);
  }

  _showDrinkPicker(row, col) {
    const state = this.lastState;
    if (!state) return;

    const locType = state.mapLayout[row][col];
    const loc = GAME_CONFIG.locations[locType];

    // Remove existing picker
    const old = this.rootEl.querySelector('.vm-drink-picker');
    if (old) old.remove();

    const picker = document.createElement('div');
    picker.className = 'vm-drink-picker';

    const header = document.createElement('div');
    header.className = 'vm-picker-header';
    header.innerHTML = `
      <span>${loc ? loc.emoji : ''} ${loc ? loc.name : 'Location'}</span>
      <button class="vm-picker-close">\u2715</button>
    `;
    picker.appendChild(header);

    header.querySelector('.vm-picker-close').addEventListener('click', () => {
      picker.remove();
      this.selectedCell = null;
    });

    const hint = document.createElement('div');
    hint.className = 'vm-picker-hint';
    if (loc && loc.bonus) {
      const bonusDrink = GAME_CONFIG.drinks.find((d) => d.id === loc.bonus);
      hint.textContent = `${bonusDrink ? bonusDrink.emoji : ''} ${bonusDrink ? bonusDrink.name : ''} sells great here!`;
    } else {
      hint.textContent = 'Pick a drink to stock:';
    }
    picker.appendChild(hint);

    const list = document.createElement('div');
    list.className = 'vm-drink-list';

    for (const drink of GAME_CONFIG.drinks) {
      const totalCost = GAME_CONFIG.machineCost + drink.cost;
      const canAfford = state.myYen >= totalCost;

      const btn = document.createElement('button');
      btn.className = 'vm-drink-btn';
      if (!canAfford) btn.classList.add('vm-drink-disabled');
      btn.disabled = !canAfford;

      // Show if this drink has location or weather bonus
      let bonusLabel = '';
      if (loc && loc.bonus === drink.id) bonusLabel += ' \uD83D\uDCCD';
      if (state.currentEvent && state.currentEvent.boost === drink.id) bonusLabel += ' ' + state.currentEvent.emoji;

      btn.innerHTML = `
        <span class="vm-drink-emoji">${drink.emoji}</span>
        <span class="vm-drink-info">
          <span class="vm-drink-name">${drink.name}${bonusLabel}</span>
          <span class="vm-drink-cost">\u00A5${totalCost}</span>
        </span>
      `;

      if (canAfford) {
        btn.addEventListener('click', () => {
          this.network.sendGameAction({
            type: 'place-machine',
            row,
            col,
            drinkId: drink.id,
          });
          picker.remove();
        });
      }

      list.appendChild(btn);
    }

    picker.appendChild(list);
    this.rootEl.appendChild(picker);
  }

  destroy() {
    EventBus.off('vending:state', this._onState);
    this.rootEl?.remove();
    this.rootEl = null;
    const canvas = this.sceneManager.renderer?.domElement;
    if (canvas) canvas.style.visibility = '';
  }
}
