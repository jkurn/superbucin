import { PigVsChickScene } from '../games/pig-vs-chick/PigVsChickScene.js';
import { GAME_CONFIG } from '../games/pig-vs-chick/config.js';

export class UIManager {
  constructor() {
    this.overlay = null;
    this.network = null;
    this.sceneManager = null;
    this.gameScene = null;
    this.selectedSide = null;
  }

  init(network, sceneManager) {
    this.network = network;
    this.sceneManager = sceneManager;
    this.overlay = document.getElementById('ui-overlay');
  }

  clear() {
    this.overlay.innerHTML = '';
  }

  // ==================== LOBBY ====================
  showLobby() {
    this.clear();
    this.overlay.innerHTML = `
      <div class="lobby-ui">
        <div class="lobby-title">SUPERBUCIN</div>
        <div class="lobby-subtitle">sayang's game collection 💕</div>
        <div class="room-section">
          <button class="btn btn-pink" id="btn-create">Create Room</button>
          <div class="or-divider">— or —</div>
          <input class="room-code-input" id="input-code" placeholder="Enter code" maxlength="4" />
          <button class="btn btn-blue btn-small" id="btn-join">Join Room</button>
        </div>
        <div class="game-grid">
          <div class="game-card active">
            <div class="game-card-icon">🐷⚔️🐔</div>
            <div class="game-card-title">Pig vs Chick</div>
            <div class="game-card-badge">2 Players</div>
          </div>
          <div class="game-card disabled">
            <div class="game-card-icon">🔒</div>
            <div class="game-card-title">Coming Soon</div>
            <div class="game-card-badge">???</div>
          </div>
          <div class="game-card disabled">
            <div class="game-card-icon">🔒</div>
            <div class="game-card-title">Coming Soon</div>
            <div class="game-card-badge">???</div>
          </div>
          <div class="game-card disabled">
            <div class="game-card-icon">🔒</div>
            <div class="game-card-title">Coming Soon</div>
            <div class="game-card-badge">???</div>
          </div>
        </div>
      </div>
    `;
    document.getElementById('btn-create').addEventListener('click', () => this.network.createRoom());
    document.getElementById('btn-join').addEventListener('click', () => {
      const code = document.getElementById('input-code').value.trim();
      if (code.length === 4) this.network.joinRoom(code);
    });
    document.getElementById('input-code').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') document.getElementById('btn-join').click();
    });
  }

  showWaitingRoom(roomCode) {
    this.clear();
    this.overlay.innerHTML = `
      <div class="lobby-ui">
        <div class="lobby-title">SUPERBUCIN</div>
        <div class="lobby-subtitle">Share this code with sayang~</div>
        <div class="room-section">
          <div class="room-code-display">${roomCode}</div>
          <div class="waiting-text">Waiting for player 2...</div>
        </div>
      </div>
    `;
  }

  showSideSelect(roomCode) {
    this.clear();
    this.selectedSide = null;
    this.overlay.innerHTML = `
      <div class="lobby-ui">
        <div class="lobby-title" style="font-size:1.5rem;">PIG vs CHICK</div>
        <div class="lobby-subtitle">Room: ${roomCode}</div>
        <div class="side-select">
          <h2>Pick your side!</h2>
          <div class="sides-row">
            <div class="side-option" data-side="pig">
              <div class="emoji">🐷</div>
              <div class="label">Pig</div>
            </div>
            <div class="side-option" data-side="chicken">
              <div class="emoji">🐔</div>
              <div class="label">Chicken</div>
            </div>
          </div>
          <div id="side-status" class="waiting-text" style="min-height:1.5rem;"></div>
        </div>
      </div>
    `;
    document.querySelectorAll('.side-option').forEach((el) => {
      el.addEventListener('click', () => {
        const side = el.dataset.side;
        this.selectedSide = side;
        document.querySelectorAll('.side-option').forEach((o) => o.classList.remove('selected'));
        el.classList.add('selected');
        this.network.selectSide(side);
        document.getElementById('side-status').textContent = `You picked ${side}! Waiting...`;
      });
    });
  }

  updateSideSelect(data) {
    const el = document.getElementById('side-status');
    if (el && data.message) el.textContent = data.message;
  }

  // ==================== GAME ====================
  startGame(data) {
    this.clear();
    this.gameScene = new PigVsChickScene(this.sceneManager, this.network, this, data);
    this.gameScene.init();
  }

  showCountdown(number) {
    let existing = document.querySelector('.countdown-overlay');
    if (!existing) {
      existing = document.createElement('div');
      existing.className = 'countdown-overlay';
      this.overlay.appendChild(existing);
    }
    if (number === 'GO!') {
      existing.innerHTML = `<div class="countdown-text">${number}</div>`;
      setTimeout(() => existing.remove(), 600);
    } else {
      existing.innerHTML = `<div class="countdown-number">${number}</div>`;
    }
  }

  showGameHUD(data) {
    // Determine which side is top/bottom from player perspective
    // myDirection=1 means I'm at bottom marching up, opponent is top
    const isBottom = data.myDirection === 1;
    const mySide = isBottom ? data.p1Side : data.p2Side;
    const oppSide = isBottom ? data.p2Side : data.p1Side;
    const myLabel = isBottom ? data.p1Label : data.p2Label;
    const oppLabel = isBottom ? data.p2Label : data.p1Label;
    const myIcon = mySide === 'pig' ? '🐷' : '🐔';
    const oppIcon = oppSide === 'pig' ? '🐷' : '🐔';

    // Top HP bar (opponent)
    const topBar = document.createElement('div');
    topBar.className = 'hp-bar-top';
    topBar.innerHTML = `
      <div class="hp-avatar">${oppIcon}</div>
      <div class="hp-bar-wrapper">
        <div class="hp-bar-bg">
          <div class="hp-bar-fill hp-fill-opponent" id="hp-fill-top" style="width:100%"></div>
        </div>
        <div class="hp-text" id="hp-text-top">100</div>
      </div>
    `;
    this.overlay.appendChild(topBar);

    // Bottom HP bar (me)
    const bottomBar = document.createElement('div');
    bottomBar.className = 'hp-bar-bottom';
    bottomBar.innerHTML = `
      <div class="hp-avatar">${myIcon}</div>
      <div class="hp-bar-wrapper">
        <div class="hp-bar-bg">
          <div class="hp-bar-fill hp-fill-me" id="hp-fill-bottom" style="width:100%"></div>
        </div>
        <div class="hp-text" id="hp-text-bottom">100</div>
      </div>
    `;
    this.overlay.appendChild(bottomBar);

    // Left-side spawn buttons (circular, stacked vertically)
    const spawnPanel = document.createElement('div');
    spawnPanel.className = 'spawn-panel';
    spawnPanel.id = 'spawn-panel';

    GAME_CONFIG.UNITS.forEach((unit, i) => {
      const icon = mySide === 'pig' ? unit.pigIcon : unit.chickenIcon;
      const btn = document.createElement('div');
      btn.className = 'spawn-btn-circle';
      btn.dataset.tier = i + 1;
      btn.innerHTML = `
        <div class="spawn-circle-icon">${icon}</div>
        <div class="spawn-circle-cost">${unit.cost}</div>
      `;
      btn.addEventListener('click', () => {
        if (!btn.classList.contains('disabled')) {
          // Spawn in a random lane
          const lane = Math.floor(Math.random() * GAME_CONFIG.NUM_LANES);
          this.network.spawnUnit(i + 1, lane);
        }
      });
      spawnPanel.appendChild(btn);
    });
    this.overlay.appendChild(spawnPanel);

    // Energy/coins display
    const energyDisplay = document.createElement('div');
    energyDisplay.className = 'energy-display';
    energyDisplay.id = 'energy-display';
    energyDisplay.innerHTML = `<span class="energy-coin">⚡</span><span id="energy-value">0</span>`;
    this.overlay.appendChild(energyDisplay);
  }

  updateHP(playerHP, gameData) {
    // playerHP is { [playerId]: hp }
    const myHP = playerHP[this.network.playerId] || 0;
    const oppId = Object.keys(playerHP).find((id) => id !== this.network.playerId);
    const oppHP = oppId ? playerHP[oppId] : 0;

    const maxHP = GAME_CONFIG.PLAYER_HP;

    const fillTop = document.getElementById('hp-fill-top');
    const textTop = document.getElementById('hp-text-top');
    const fillBottom = document.getElementById('hp-fill-bottom');
    const textBottom = document.getElementById('hp-text-bottom');

    if (fillTop) fillTop.style.width = `${(oppHP / maxHP) * 100}%`;
    if (textTop) textTop.textContent = Math.ceil(oppHP);
    if (fillBottom) fillBottom.style.width = `${(myHP / maxHP) * 100}%`;
    if (textBottom) textBottom.textContent = Math.ceil(myHP);
  }

  updateEnergy(current, max) {
    const el = document.getElementById('energy-value');
    if (el) el.textContent = Math.floor(current);
  }

  updateSpawnButtons(energy) {
    const buttons = document.querySelectorAll('.spawn-btn-circle');
    GAME_CONFIG.UNITS.forEach((unit, i) => {
      if (buttons[i]) {
        if (energy < unit.cost) {
          buttons[i].classList.add('disabled');
        } else {
          buttons[i].classList.remove('disabled');
        }
      }
    });
  }

  showVictory(data) {
    if (this.gameScene) this.gameScene.destroy();
    this.clear();

    const isWinner = data.winner === this.network.playerId;
    const messages = isWinner
      ? ['SAYANG MENANG! 🤣🤣🤣', 'GG sayang~ kamu hebat!', 'LUCU BANGET menangnya! 💕']
      : ['Yahhh kalah~ 😭', 'Nanti revenge ya say!', 'GG sayang~ next time!'];
    const msg = messages[Math.floor(Math.random() * messages.length)];

    this.overlay.innerHTML = `
      <div class="victory-overlay">
        <div class="victory-text">${msg}</div>
        <div class="victory-sub">${isWinner ? 'You won!' : 'Better luck next time~'}</div>
        <button class="btn btn-pink" id="btn-rematch">Play Again 💕</button>
        <button class="btn btn-blue btn-small" id="btn-lobby" style="margin-top:0.75rem;">Back to Lobby</button>
      </div>
    `;
    document.getElementById('btn-rematch').addEventListener('click', () => this.network.requestRematch());
    document.getElementById('btn-lobby').addEventListener('click', () => window.location.reload());
  }

  showDisconnect() {
    if (this.gameScene) this.gameScene.destroy();
    this.clear();
    this.overlay.innerHTML = `
      <div class="victory-overlay">
        <div class="victory-text">Opponent disconnected 😢</div>
        <button class="btn btn-pink" id="btn-lobby" style="margin-top:1.5rem;">Back to Lobby</button>
      </div>
    `;
    document.getElementById('btn-lobby').addEventListener('click', () => window.location.reload());
  }

  updateScore() {} // Not used in HP pool mode
}
