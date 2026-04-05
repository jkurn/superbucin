import { showError, showAchievementToast } from './ui/toasts.js';
import * as LobbyScreen from '../screens/LobbyScreen.js';
import * as AuthScreen from '../screens/AuthScreen.js';
import * as ProfileScreen from '../screens/ProfileScreen.js';
import * as PublicProfileScreen from '../screens/PublicProfileScreen.js';
import * as WaitingRoomScreen from '../screens/WaitingRoomScreen.js';
import * as JoiningRoomScreen from '../screens/JoiningRoomScreen.js';
import * as SideSelectScreen from '../screens/SideSelectScreen.js';
import * as VictoryScreen from '../screens/VictoryScreen.js';
import * as DisconnectScreen from '../screens/DisconnectScreen.js';
import * as GameScreen from '../screens/GameScreen.js';

export class UIManager {
  constructor() {
    this.overlay = null;
    this.network = null;
    this.sceneManager = null;
    this.userManager = null;
    this.gameScene = null;
    this.activeHUD = null;
    this.selectedSide = null;
    this._router = null;
    this._sideSelectHandle = null;
  }

  setRouter(router) {
    this._router = router;
  }

  init(network, sceneManager, userManager) {
    this.network = network;
    this.sceneManager = sceneManager;
    this.userManager = userManager;
    this.overlay = document.getElementById('ui-overlay');
  }

  clear() {
    this.overlay.innerHTML = '';
  }

  /** Shared deps object passed to every screen render function. */
  _deps() {
    return {
      network: this.network,
      sceneManager: this.sceneManager,
      userManager: this.userManager,
      router: this._router,
      showScreen: (name, opts) => this._navigate(name, opts),
      uiManager: this,
    };
  }

  _navigate(name, opts) {
    switch (name) {
    case 'lobby': this.showLobby(opts); break;
    case 'auth': this.showAuthScreen(opts); break;
    case 'profile': this.showProfile(opts); break;
    default: this.showLobby(opts);
    }
  }

  // ==================== SCREEN DELEGATES ====================

  showLobby(options) {
    this.clear();
    LobbyScreen.render(this.overlay, this._deps(), options);
  }

  showAuthScreen(options) {
    this.clear();
    AuthScreen.render(this.overlay, this._deps(), options);
  }

  showForgotPassword() {
    this.showAuthScreen();
  }

  showResetPassword() {
    this.clear();
    AuthScreen.renderResetPassword(this.overlay, this._deps());
  }

  showProfile(options) {
    this.clear();
    ProfileScreen.render(this.overlay, this._deps(), options);
  }

  showPublicProfile(username) {
    this.clear();
    PublicProfileScreen.render(this.overlay, this._deps(), username);
  }

  showWaitingRoom(roomCode) {
    this.clear();
    WaitingRoomScreen.render(this.overlay, this._deps(), roomCode);
  }

  showJoiningRoom(code) {
    this.clear();
    JoiningRoomScreen.render(this.overlay, this._deps(), code);
  }

  showSideSelect(roomCode) {
    this.clear();
    this.selectedSide = null;
    this._sideSelectHandle = SideSelectScreen.render(this.overlay, this._deps(), roomCode);
  }

  updateSideSelect(data) {
    const currentSide = this._sideSelectHandle?.getSelectedSide() || this.selectedSide;
    SideSelectScreen.updateSideSelect(data, currentSide);
    if (this._sideSelectHandle) {
      this.selectedSide = this._sideSelectHandle.getSelectedSide();
    }
  }

  startGame(data) {
    this.clear();
    const result = GameScreen.render(this.overlay, this._deps(), data);
    if (result) {
      this.activeHUD = result.activeHUD;
      this.gameScene = result.gameScene;
    }
  }

  showVictory(data) {
    this._cleanupGame();
    this.clear();
    VictoryScreen.render(this.overlay, this._deps(), data);
  }

  showDisconnect() {
    this._cleanupGame();
    this.clear();
    DisconnectScreen.render(this.overlay, this._deps());
  }

  // ==================== IN-GAME PROXIES (called by game scenes) ====================

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

  updateHP(playerHP) {
    if (this.activeHUD) this.activeHUD.updateHP(playerHP, this.network.playerId);
  }

  updateEnergy(current) {
    if (this.activeHUD) this.activeHUD.updateEnergy(current);
  }

  updateSpawnButtons(energy) {
    if (this.activeHUD) this.activeHUD.updateSpawnButtons(energy);
  }

  showReconnecting() {
    let overlay = document.getElementById('reconnect-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'reconnect-overlay';
      overlay.className = 'reconnect-overlay';
      overlay.innerHTML = `
        <div class="reconnect-text">Sayang disconnected...</div>
        <div class="reconnect-sub">Waiting for reconnect \u23f3</div>
      `;
      this.overlay.appendChild(overlay);
    }
  }

  hideReconnecting() {
    const overlay = document.getElementById('reconnect-overlay');
    if (overlay) overlay.remove();
    showError('Sayang reconnected! \ud83d\udc95');
  }

  showError(message) {
    showError(message);
  }

  showAchievementToast(achievements) {
    showAchievementToast(achievements);
  }

  // ==================== INTERNAL ====================

  _cleanupGame() {
    if (this.gameScene) this.gameScene.destroy();
    this.gameScene = null;
    if (this.activeHUD && this.activeHUD.destroy) this.activeHUD.destroy();
    this.activeHUD = null;
  }
}
