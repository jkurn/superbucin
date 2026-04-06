/** @typedef {import('../../shared/GameTypes.js').GameDefinition} GameDefinition */

import { BattleshipScene } from './BattleshipScene.js';
import { GAME_CONFIG, applyServerConfig } from './config.js';
import { EventBus } from '../../shared/EventBus.js';

/** @type {GameDefinition} */
export const battleshipMiniGame = {
  type: 'battleship-mini',
  lobby: {
    name: 'Sink Squad',
    icon: '🚢💥',
    badge: '2 Players',
  },
  victoryMessages: {
    win: ['All ships sunk! GG sayang~', 'Admiral champion! 🚢', 'VICTORY! Total domination!'],
    lose: ['Yahhh sunk~ Next time!', 'GG sayang! Almost had it!', 'So close! Rematch?'],
    draw: ['Stalemate on the seas!'],
  },
  Scene: BattleshipScene,
  applyConfig: applyServerConfig,

  createHUD(overlay, _data, network) {
    const container = document.createElement('div');
    container.className = 'bs-hud';
    container.innerHTML = `
      <div class="bs-status-bar" id="bs-status-bar">
        <span id="bs-status-text">Preparing fleet...</span>
      </div>
      <div class="bs-timer-bar"><div class="bs-timer-fill" id="bs-timer-fill"></div></div>
      <div class="bs-body" id="bs-body"></div>
    `;
    overlay.appendChild(container);

    let timerEndsAt = null;
    let timerDuration = GAME_CONFIG.PLACEMENT_TIME_MS;
    let timerRAF = null;
    let _currentPhase = 'countdown';

    // Placement state
    let placementShips = [];
    let placementGrid = [];
    let currentShipIdx = 0;
    let placementOrientation = 'horizontal'; // 'horizontal' | 'vertical'
    let placementSubmitted = false;

    function initPlacementState() {
      const size = GAME_CONFIG.GRID_SIZE;
      placementGrid = Array.from({ length: size }, () => Array(size).fill(0));
      placementShips = [];
      currentShipIdx = 0;
      placementOrientation = 'horizontal';
      placementSubmitted = false;
    }

    function updateTimerBar() {
      const fill = document.getElementById('bs-timer-fill');
      if (!fill || !timerEndsAt) {
        if (fill) fill.style.width = '100%';
        timerRAF = requestAnimationFrame(updateTimerBar);
        return;
      }
      const remaining = Math.max(0, timerEndsAt - Date.now());
      const pct = (remaining / timerDuration) * 100;
      fill.style.width = `${pct}%`;

      if (pct < 20) {
        fill.classList.add('bs-timer-danger');
      } else {
        fill.classList.remove('bs-timer-danger');
      }

      if (remaining > 0) {
        timerRAF = requestAnimationFrame(updateTimerBar);
      }
    }

    function renderCountdown() {
      const body = document.getElementById('bs-body');
      if (!body) return;
      body.innerHTML = `
        <div class="bs-countdown-big">
          <div class="bs-countdown-icon">🚢💥</div>
          <div class="bs-countdown-text">Battle Stations!</div>
        </div>
      `;
    }

    function renderPlacement(state) {
      const body = document.getElementById('bs-body');
      if (!body) return;
      const size = state.gridSize;
      const shipsToPlace = state.shipsToPlace;

      if (placementSubmitted) {
        body.innerHTML = `
          <div class="bs-waiting-placement">
            <div class="bs-waiting-icon">⏳</div>
            <div>Fleet deployed! Waiting for sayang~</div>
          </div>
        `;
        return;
      }

      const shipLen = currentShipIdx < shipsToPlace.length ? shipsToPlace[currentShipIdx] : 0;
      const remaining = shipsToPlace.length - currentShipIdx;

      body.innerHTML = `
        <div class="bs-placement-info">
          <span>Place your ships! (${remaining} left)</span>
          <button class="bs-rotate-btn" id="bs-rotate-btn">🔄 Rotate</button>
        </div>
        <div class="bs-placement-hint">Ship size: ${shipLen} cells (${placementOrientation})</div>
        <div class="bs-grid bs-placement-grid" id="bs-placement-grid"></div>
      `;

      const gridEl = document.getElementById('bs-placement-grid');
      gridEl.style.setProperty('--grid-size', size);

      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          const cell = document.createElement('div');
          cell.className = 'bs-cell';
          cell.dataset.row = r;
          cell.dataset.col = c;

          if (placementGrid[r][c] === 'S') {
            cell.classList.add('bs-cell-ship');
          }

          cell.addEventListener('click', () => {
            if (currentShipIdx >= shipsToPlace.length) return;
            tryPlaceShip(r, c, shipsToPlace[currentShipIdx]);
          });

          cell.addEventListener('mouseenter', () => {
            if (currentShipIdx >= shipsToPlace.length) return;
            highlightShipPreview(r, c, shipsToPlace[currentShipIdx]);
          });

          cell.addEventListener('mouseleave', () => {
            clearShipPreview();
          });

          gridEl.appendChild(cell);
        }
      }

      const rotateBtn = document.getElementById('bs-rotate-btn');
      if (rotateBtn) {
        rotateBtn.addEventListener('click', () => {
          placementOrientation = placementOrientation === 'horizontal' ? 'vertical' : 'horizontal';
          const hint = body.querySelector('.bs-placement-hint');
          if (hint) hint.textContent = `Ship size: ${shipLen} cells (${placementOrientation})`;
        });
      }
    }

    function highlightShipPreview(r, c, len) {
      clearShipPreview();
      const gridEl = document.getElementById('bs-placement-grid');
      if (!gridEl) return;
      const size = GAME_CONFIG.GRID_SIZE;
      const cells = getShipCells(r, c, len);
      const valid = cells.every(
        (cell) => cell.r >= 0 && cell.r < size && cell.c >= 0 && cell.c < size
          && placementGrid[cell.r][cell.c] === 0,
      );

      for (const cell of cells) {
        if (cell.r < 0 || cell.r >= size || cell.c < 0 || cell.c >= size) continue;
        const el = gridEl.querySelector(`[data-row="${cell.r}"][data-col="${cell.c}"]`);
        if (el) el.classList.add(valid ? 'bs-cell-preview-valid' : 'bs-cell-preview-invalid');
      }
    }

    function clearShipPreview() {
      const gridEl = document.getElementById('bs-placement-grid');
      if (!gridEl) return;
      gridEl.querySelectorAll('.bs-cell-preview-valid, .bs-cell-preview-invalid').forEach((el) => {
        el.classList.remove('bs-cell-preview-valid', 'bs-cell-preview-invalid');
      });
    }

    function getShipCells(r, c, len) {
      const cells = [];
      for (let i = 0; i < len; i++) {
        if (placementOrientation === 'horizontal') {
          cells.push({ r, c: c + i });
        } else {
          cells.push({ r: r + i, c });
        }
      }
      return cells;
    }

    function tryPlaceShip(r, c, len) {
      const size = GAME_CONFIG.GRID_SIZE;
      const cells = getShipCells(r, c, len);

      const valid = cells.every(
        (cell) => cell.r >= 0 && cell.r < size && cell.c >= 0 && cell.c < size
          && placementGrid[cell.r][cell.c] === 0,
      );

      if (!valid) return;

      for (const cell of cells) {
        placementGrid[cell.r][cell.c] = 'S';
      }
      placementShips.push({ cells });
      currentShipIdx++;

      // If all ships placed, submit
      if (currentShipIdx >= GAME_CONFIG.SHIPS.length) {
        placementSubmitted = true;
        network.sendGameAction({
          type: 'place-ships',
          ships: placementShips,
        });
      }

      // Re-render
      renderPlacement({
        gridSize: size,
        shipsToPlace: GAME_CONFIG.SHIPS,
      });
    }

    function renderBattle(state) {
      const body = document.getElementById('bs-body');
      if (!body) return;
      const size = state.gridSize;

      body.innerHTML = `
        <div class="bs-battle-layout">
          <div class="bs-board-section">
            <div class="bs-board-label">Enemy Waters 🎯</div>
            <div class="bs-grid bs-attack-grid" id="bs-attack-grid"></div>
            <div class="bs-ship-status" id="bs-opp-ships"></div>
          </div>
          <div class="bs-board-section">
            <div class="bs-board-label">Your Fleet 🚢</div>
            <div class="bs-grid bs-defense-grid" id="bs-defense-grid"></div>
            <div class="bs-ship-status" id="bs-my-ships"></div>
          </div>
        </div>
      `;

      // Attack grid (opponent's board from our perspective)
      const attackGrid = document.getElementById('bs-attack-grid');
      attackGrid.style.setProperty('--grid-size', size);

      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          const cell = document.createElement('div');
          cell.className = 'bs-cell bs-cell-attack';
          cell.dataset.row = r;
          cell.dataset.col = c;

          const val = state.oppBoard[r][c];
          if (val === 'H') {
            cell.classList.add('bs-cell-hit');
            cell.textContent = '💥';
          } else if (val === 'M') {
            cell.classList.add('bs-cell-miss');
            cell.textContent = '·';
          }

          // Show sunk ship cells
          const isSunkCell = state.sunkOppCells?.some(
            (sc) => sc.r === r && sc.c === c,
          );
          if (isSunkCell) {
            cell.classList.add('bs-cell-sunk');
          }

          if (state.isMyTurn && val === 0) {
            cell.classList.add('bs-cell-targetable');
            cell.addEventListener('click', () => {
              network.sendGameAction({ type: 'fire', row: r, col: c });
            });
          }

          attackGrid.appendChild(cell);
        }
      }

      // Defense grid (our own board)
      const defenseGrid = document.getElementById('bs-defense-grid');
      defenseGrid.style.setProperty('--grid-size', size);

      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          const cell = document.createElement('div');
          cell.className = 'bs-cell bs-cell-defense';
          cell.dataset.row = r;
          cell.dataset.col = c;

          const val = state.myBoard[r][c];
          if (val === 'S') {
            cell.classList.add('bs-cell-ship');
          } else if (val === 'H') {
            cell.classList.add('bs-cell-hit');
            cell.textContent = '💥';
          }

          defenseGrid.appendChild(cell);
        }
      }

      // Ship status indicators
      renderShipStatus('bs-opp-ships', state.oppShips, 'Enemy');
      renderShipStatus('bs-my-ships', state.myShips, 'Your');
    }

    function renderShipStatus(elementId, ships, _label) {
      const el = document.getElementById(elementId);
      if (!el || !ships) return;

      el.innerHTML = ships.map((s) => {
        const dots = Array(s.length).fill(s.sunk ? '💀' : '🟦').join('');
        return `<span class="bs-ship-indicator ${s.sunk ? 'bs-ship-sunk' : ''}">${dots}</span>`;
      }).join(' ');
    }

    function onBattleshipState(state) {
      _currentPhase = state.phase;

      // Update status bar
      const statusText = document.getElementById('bs-status-text');
      if (statusText) {
        switch (state.phase) {
          case 'countdown':
            statusText.textContent = 'Battle Stations!';
            break;
          case 'placement':
            statusText.textContent = state.placementReady
              ? 'Fleet deployed! Waiting for opponent...'
              : 'Place your ships!';
            break;
          case 'battle':
            statusText.textContent = state.isMyTurn
              ? '🎯 Your turn — fire!'
              : 'Waiting for opponent...';
            break;
          default:
            break;
        }
      }

      // Update status bar styling
      const statusBar = document.getElementById('bs-status-bar');
      if (statusBar && state.phase === 'battle') {
        statusBar.classList.toggle('bs-my-turn', state.isMyTurn);
        statusBar.classList.toggle('bs-opp-turn', !state.isMyTurn);
      }

      // Timer
      if (state.timerEndsAt) {
        timerEndsAt = state.timerEndsAt;
        timerDuration = state.phase === 'placement'
          ? GAME_CONFIG.PLACEMENT_TIME_MS
          : GAME_CONFIG.TURN_TIME_MS;
        if (!timerRAF) timerRAF = requestAnimationFrame(updateTimerBar);
      }

      switch (state.phase) {
        case 'countdown':
          renderCountdown();
          break;
        case 'placement':
          if (!placementSubmitted && !document.getElementById('bs-placement-grid')) {
            initPlacementState();
            renderPlacement(state);
          } else if (placementSubmitted) {
            renderPlacement(state);
          }
          break;
        case 'battle':
          renderBattle(state);
          break;
        default:
          break;
      }
    }

    EventBus.on('battleship:state', onBattleshipState);

    timerRAF = requestAnimationFrame(updateTimerBar);

    return {
      updateHP() {},
      updateEnergy() {},
      updateSpawnButtons() {},
      onGameState(_state) {},
      destroy() {
        EventBus.off('battleship:state', onBattleshipState);
        if (timerRAF) cancelAnimationFrame(timerRAF);
      },
    };
  },
};
