import { SceneManager } from './shared/SceneManager.js';
import { NetworkManager } from './shared/NetworkManager.js';
import { UIManager } from './shared/UIManager.js';
import { UserManager } from './shared/UserManager.js';
import { Router } from './shared/Router.js';
import { GameRegistry } from './shared/GameRegistry.js';
import { pigVsChickGame } from './games/pig-vs-chick/index.js';
import { othelloGame } from './games/othello/index.js';
import { wordScrambleRaceGame } from './games/word-scramble-race/index.js';
import { doodleGuessGame } from './games/doodle-guess/index.js';
import { memoryMatchGame } from './games/memory-match/index.js';

GameRegistry.register('pig-vs-chick', pigVsChickGame);
GameRegistry.register('othello', othelloGame);
GameRegistry.register('word-scramble-race', wordScrambleRaceGame);
GameRegistry.register('doodle-guess', doodleGuessGame);
GameRegistry.register('memory-match', memoryMatchGame);

const app = {
  sceneManager: null,
  network: null,
  ui: null,
  userManager: null,

  async init() {
    this.userManager = new UserManager();
    await this.userManager.init();

    this.network = new NetworkManager();
    this.ui = new UIManager();
    this.sceneManager = new SceneManager(document.getElementById('app'));

    await this.sceneManager.init();

    this.ui.init(this.network, this.sceneManager, this.userManager);
    this.network.init(this.ui, this.sceneManager, this.userManager);

    const loading = document.getElementById('loading-screen');
    loading.classList.add('hidden');
    setTimeout(() => loading.remove(), 500);

    // Let the Router decide which screen to show based on the URL
    Router.init(this.ui, this.network, this.userManager);
    this.ui.setRouter(Router);
    this.sceneManager.startLoop();
  },
};

app.init().catch(console.error);
