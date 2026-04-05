// Server-side game factory
// Each game registers: GameState class + config
// RoomManager calls create() to instantiate the right game

const games = new Map();

export const GameFactory = {
  register(gameType, GameStateClass, config) {
    games.set(gameType, { GameStateClass, config });
  },

  create(gameType, p1, p2, emitCallback) {
    const entry = games.get(gameType);
    if (!entry) {
      console.error(`Unknown game type: ${gameType}`);
      return null;
    }
    return new entry.GameStateClass(p1, p2, emitCallback);
  },

  getConfig(gameType) {
    const entry = games.get(gameType);
    if (!entry) return null;
    return { ...entry.config };
  },

  has(gameType) {
    return games.has(gameType);
  },
};
