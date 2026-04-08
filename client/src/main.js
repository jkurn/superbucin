import './styles/stickers.css';
import { SceneManager } from './shared/SceneManager.js';
import { NetworkManager } from './shared/NetworkManager.js';
import { UIManager } from './shared/UIManager.js';
import { UserManager } from './shared/UserManager.js';
import { Router } from './shared/Router.js';
import { GameRegistry } from './shared/GameRegistry.js';
import { WebAudioManager } from './shared/WebAudioManager.js';
import { captureEvent, initAnalytics, syncUserIdentity } from './shared/analytics.js';
import { pigVsChickGame } from './games/pig-vs-chick/index.js';
import { othelloGame } from './games/othello/index.js';
import { wordScrambleRaceGame } from './games/word-scramble-race/index.js';
import { doodleGuessGame } from './games/doodle-guess/index.js';
import { memoryMatchGame } from './games/memory-match/index.js';
import { speedMatchGame } from './games/speed-match/index.js';
import { connectFourGame } from './games/connect-four/index.js';
import { quizRaceGame } from './games/quiz-race/index.js';
import { battleshipMiniGame } from './games/battleship-mini/index.js';
import { vendingMachineGame } from './games/vending-machine/index.js';
import { bonkBrawlGame } from './games/bonk-brawl/index.js';
import { cuteAggressionGame } from './games/cute-aggression/index.js';

GameRegistry.register('pig-vs-chick', pigVsChickGame);
GameRegistry.register('othello', othelloGame);
GameRegistry.register('word-scramble-race', wordScrambleRaceGame);
GameRegistry.register('doodle-guess', doodleGuessGame);
GameRegistry.register('memory-match', memoryMatchGame);
GameRegistry.register('speed-match', speedMatchGame);
GameRegistry.register('connect-four', connectFourGame);
GameRegistry.register('quiz-race', quizRaceGame);
GameRegistry.register('battleship-mini', battleshipMiniGame);
GameRegistry.register('vending-machine', vendingMachineGame);
GameRegistry.register('bonk-brawl', bonkBrawlGame);
GameRegistry.register('cute-aggression', cuteAggressionGame);

const appBootStartMs = typeof performance !== 'undefined' ? performance.now() : Date.now();

function getConnectionType() {
  const connection = navigator?.connection || navigator?.mozConnection || navigator?.webkitConnection;
  return connection?.effectiveType || null;
}

function isMobileWeb() {
  const userAgent = navigator?.userAgent || '';
  return /android|iphone|ipad|ipod|mobile/i.test(userAgent);
}

function getTelemetryContext() {
  return {
    is_mobile_web: isMobileWeb(),
    viewport_width: window.innerWidth,
    viewport_height: window.innerHeight,
    device_pixel_ratio: window.devicePixelRatio || 1,
    connection_type: getConnectionType(),
    route: window.location.pathname,
  };
}

const app = {
  sceneManager: null,
  network: null,
  ui: null,
  userManager: null,
  audio: null,

  async init() {
    initAnalytics();
    const loadingStartMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const loading = document.getElementById('loading-screen');
    let loadingTappedOnce = false;
    captureEvent('loading_started', {
      ...getTelemetryContext(),
    });

    if (loading) {
      loading.addEventListener('pointerdown', () => {
        if (loadingTappedOnce) return;
        loadingTappedOnce = true;
        const elapsedMs = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - loadingStartMs;
        captureEvent('loading_tapped', {
          ...getTelemetryContext(),
          elapsed_ms_since_loading_start: Math.round(elapsedMs),
        });
      });
    }

    this.userManager = new UserManager();
    await this.userManager.init();
    syncUserIdentity(this.userManager);
    this.audio = new WebAudioManager();
    this.audio.init();

    this.network = new NetworkManager();
    this.ui = new UIManager();
    this.sceneManager = new SceneManager(document.getElementById('app'));

    await this.sceneManager.init();

    this.ui.init(this.network, this.sceneManager, this.userManager);
    this.network.init(this.ui, this.sceneManager, this.userManager);

    if (loading) {
      loading.classList.add('hidden');
      loading.setAttribute('aria-hidden', 'true');
      loading.setAttribute('hidden', '');
      setTimeout(() => loading.remove(), 500);
    }

    // Let the Router decide which screen to show based on the URL
    Router.init(this.ui, this.network, this.userManager);
    this.ui.setRouter(Router);

    const elapsedMs = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - appBootStartMs;
    const loadingElapsedMs = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - loadingStartMs;
    captureEvent('loading_completed', {
      ...getTelemetryContext(),
      loading_time_ms: Math.round(loadingElapsedMs),
      loading_time_seconds: Number((loadingElapsedMs / 1000).toFixed(2)),
      exceeded_5s: loadingElapsedMs > 5000,
      was_tapped_during_loading: loadingTappedOnce,
    });

    captureEvent('game_loaded', {
      ...getTelemetryContext(),
      load_time_ms: Math.round(elapsedMs),
      load_time_seconds: Number((elapsedMs / 1000).toFixed(2)),
    });

    // Listen for password recovery event from Supabase
    this.userManager.onChange(() => {
      syncUserIdentity(this.userManager);
      if (this.userManager._passwordRecoveryPending) {
        this.userManager._passwordRecoveryPending = false;
        Router.replace('/reset-password');
        this.ui.showResetPassword();
      }
    });

    this.sceneManager.startLoop();

    // Debug helper for QA/Playwright and quick console inspection.
    window.getGameState = () => this.getDebugState();
  },

  getDebugState() {
    return {
      timestamp: new Date().toISOString(),
      route: window.location.pathname,
      network: this.network?.getDebugSnapshot?.() || null,
      ui: {
        hasGameScene: !!this.ui?.gameScene,
        selectedSide: this.ui?.selectedSide || null,
      },
    };
  },
};

app.init().catch(console.error);
