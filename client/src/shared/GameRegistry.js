// Client-side game registry
// Each game registers: Scene class, config, HUD builder, lobby card info

/** @typedef {import('./GameTypes.js').GameDefinition} GameDefinition */
/** @typedef {import('./GameTypes.js').GameLobbyConfig} GameLobbyConfig */

/** @type {Map<string, GameDefinition>} */
const games = new Map();

export const GameRegistry = {
  /**
   * Register a game module so the engine can look it up by type.
   * @param {string}         gameType - Unique game identifier
   * @param {GameDefinition} module   - Full game definition object
   */
  register(gameType, module) {
    games.set(gameType, module);
  },

  /**
   * Retrieve a registered game definition.
   * @param   {string}              gameType
   * @returns {GameDefinition|null}
   */
  get(gameType) {
    const game = games.get(gameType);
    if (!game) return null;
    return game;
  },

  /** @param {string} gameType */
  has(gameType) {
    return games.has(gameType);
  },

  /**
   * Returns lobby card data for all registered games.
   * @returns {Array<{type: string} & GameLobbyConfig>}
   */
  list() {
    return [...games.entries()].map(([type, mod]) => ({
      type,
      ...mod.lobby,
    }));
  },
};
