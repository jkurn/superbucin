// Client-side game registry
// Each game registers: Scene class, config, HUD builder, lobby card info

const games = new Map();

export const GameRegistry = {
  register(gameType, module) {
    games.set(gameType, module);
  },

  get(gameType) {
    const game = games.get(gameType);
    if (!game) {
      console.error(`Unknown game type: ${gameType}`);
      return null;
    }
    return game;
  },

  // Returns lobby card data for all registered games
  list() {
    return [...games.entries()].map(([type, mod]) => ({
      type,
      ...mod.lobby,
    }));
  },
};
