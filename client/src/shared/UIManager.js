import { GameRegistry } from './GameRegistry.js';

export class UIManager {
  constructor() {
    this.overlay = null;
    this.network = null;
    this.sceneManager = null;
    this.gameScene = null;
    this.activeHUD = null;
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

    // Build game cards from registry
    const registered = GameRegistry.list();
    const cardsHTML = registered.map((g) => `
      <div class="game-card active" data-game-type="${g.type}">
        <div class="game-card-icon">${g.icon}</div>
        <div class="game-card-title">${g.name}</div>
        <div class="game-card-badge">${g.badge}</div>
      </div>
    `).join('');

    // Pad with "Coming Soon" cards to fill grid
    const padCount = Math.max(0, 4 - registered.length);
    const padHTML = Array(padCount).fill(`
      <div class="game-card disabled">
        <div class="game-card-icon">🔒</div>
        <div class="game-card-title">Coming Soon</div>
        <div class="game-card-badge">???</div>
      </div>
    `).join('');

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
          ${cardsHTML}${padHTML}
        </div>
      </div>
    `;

    // For now, first registered game is the default
    const defaultGameType = registered[0]?.type || 'pig-vs-chick';

    document.getElementById('btn-create').addEventListener('click', () => {
      this.network.createRoom(defaultGameType);
    });
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
    const gameType = data.gameType || 'pig-vs-chick';
    const game = GameRegistry.get(gameType);
    if (!game) {
      this.showError(`Unknown game: ${gameType}`);
      return;
    }

    game.applyConfig(data.gameConfig);
    this.clear();

    // Build game-specific HUD
    this.activeHUD = game.createHUD(this.overlay, data, this.network);

    // Create game scene
    this.gameScene = new game.Scene(this.sceneManager, this.network, this, data);
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

  // HUD proxies — delegate to active game's HUD
  updateHP(playerHP) {
    if (this.activeHUD) this.activeHUD.updateHP(playerHP, this.network.playerId);
  }

  updateEnergy(current) {
    if (this.activeHUD) this.activeHUD.updateEnergy(current);
  }

  updateSpawnButtons(energy) {
    if (this.activeHUD) this.activeHUD.updateSpawnButtons(energy);
  }

  showVictory(data) {
    if (this.gameScene) this.gameScene.destroy();
    this.gameScene = null;
    if (this.activeHUD && this.activeHUD.destroy) this.activeHUD.destroy();
    this.activeHUD = null;
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
    document.getElementById('btn-lobby').addEventListener('click', () => {
      this.gameScene = null;
      this.activeHUD = null;
      this.showLobby();
    });
  }

  showDisconnect() {
    if (this.gameScene) this.gameScene.destroy();
    this.gameScene = null;
    if (this.activeHUD && this.activeHUD.destroy) this.activeHUD.destroy();
    this.activeHUD = null;
    this.clear();
    this.overlay.innerHTML = `
      <div class="victory-overlay">
        <div class="victory-text">Opponent disconnected 😢</div>
        <button class="btn btn-pink" id="btn-lobby" style="margin-top:1.5rem;">Back to Lobby</button>
      </div>
    `;
    document.getElementById('btn-lobby').addEventListener('click', () => {
      this.gameScene = null;
      this.activeHUD = null;
      this.showLobby();
    });
  }

  showReconnecting() {
    let overlay = document.getElementById('reconnect-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'reconnect-overlay';
      overlay.className = 'reconnect-overlay';
      overlay.innerHTML = `
        <div class="reconnect-text">Sayang disconnected...</div>
        <div class="reconnect-sub">Waiting for reconnect ⏳</div>
      `;
      this.overlay.appendChild(overlay);
    }
  }

  hideReconnecting() {
    const overlay = document.getElementById('reconnect-overlay');
    if (overlay) overlay.remove();
    this.showError('Sayang reconnected! 💕');
  }

  showError(message) {
    const toast = document.createElement('div');
    toast.className = 'error-toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }
}
