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
    const config = entry.config;
    return {
      NUM_LANES: config.NUM_LANES,
      LANE_HEIGHT: config.LANE_HEIGHT,
      PLAYER_HP: config.PLAYER_HP,
      MAX_ENERGY: config.MAX_ENERGY,
      STARTING_ENERGY: config.STARTING_ENERGY,
      ENERGY_REGEN: config.ENERGY_REGEN,
      BASE_DAMAGE: config.BASE_DAMAGE,
      UNITS: config.UNITS.map((u) => ({
        tier: u.tier, hp: u.hp, atk: u.atk,
        speed: u.speed, cost: u.cost, attackRate: u.attackRate,
      })),
    };
  },

  has(gameType) {
    return games.has(gameType);
  },
};
