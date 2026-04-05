import { GameRegistry } from '../shared/GameRegistry.js';
import { showError } from '../shared/ui/toasts.js';

export function render(overlay, deps, data) {
  const { network, sceneManager } = deps;

  const gameType = data.gameType || 'pig-vs-chick';
  const game = GameRegistry.get(gameType);
  if (!game) {
    showError(`Unknown game: ${gameType}`);
    return null;
  }

  game.applyConfig(data.gameConfig);

  const activeHUD = game.createHUD(overlay, data, network);
  const gameScene = new game.Scene(sceneManager, network, deps.uiManager, data);
  gameScene.init();

  return { activeHUD, gameScene };
}
