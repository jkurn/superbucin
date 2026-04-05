// Hides the WebGL canvas; gameplay is DOM/canvas in the HUD overlay.

export class DoodleGuessScene {
  constructor(sceneManager, network, ui, gameData) {
    this.sceneManager = sceneManager;
    this.network = network;
    this.ui = ui;
    this.gameData = gameData;
    this._canvasDisplay = '';
  }

  init() {
    const el = this.sceneManager.renderer?.domElement;
    if (el) {
      this._canvasDisplay = el.style.display;
      el.style.display = 'none';
    }
  }

  destroy() {
    const el = this.sceneManager.renderer?.domElement;
    if (el) el.style.display = this._canvasDisplay || '';
  }
}
