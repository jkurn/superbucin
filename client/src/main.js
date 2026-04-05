import { SceneManager } from './shared/SceneManager.js';
import { NetworkManager } from './shared/NetworkManager.js';
import { UIManager } from './shared/UIManager.js';
import { GameRegistry } from './shared/GameRegistry.js';
import { pigVsChickGame } from './games/pig-vs-chick/index.js';
import { wordScrambleRaceGame } from './games/word-scramble-race/index.js';
import { doodleGuessGame } from './games/doodle-guess/index.js';
import { memoryMatchGame } from './games/memory-match/index.js';

// Register all games
GameRegistry.register('pig-vs-chick', pigVsChickGame);
GameRegistry.register('word-scramble-race', wordScrambleRaceGame);
GameRegistry.register('doodle-guess', doodleGuessGame);
GameRegistry.register('memory-match', memoryMatchGame);

const app = {
  sceneManager: null,
  network: null,
  ui: null,

  async init() {
    this.network = new NetworkManager();
    this.ui = new UIManager();
    this.sceneManager = new SceneManager(document.getElementById('app'));

    await this.sceneManager.init();

    this.ui.init(this.network, this.sceneManager);
    this.network.init(this.ui, this.sceneManager);

    // Hide loading screen
    const loading = document.getElementById('loading-screen');
    loading.classList.add('hidden');
    setTimeout(() => loading.remove(), 500);

    // Show lobby
    this.ui.showLobby();

    // Start render loop
    this.sceneManager.startLoop();
  },
};

app.init().catch(console.error);
