// Display-only fields — gameplay values come from server via game-start
export const DISPLAY_CONFIG = {
  LANE_WIDTH: 2.0,

  // Unit display info (icons, names) — indexed by tier (0-based)
  UNITS: [
    { tier: 1, name: { pig: 'Piglet', chicken: 'Chick' }, pigIcon: '🐷', chickenIcon: '🐤' },
    { tier: 2, name: { pig: 'Pig', chicken: 'Hen' }, pigIcon: '🐖', chickenIcon: '🐥' },
    { tier: 3, name: { pig: 'Boar', chicken: 'Chicken' }, pigIcon: '🐗', chickenIcon: '🐔' },
    { tier: 4, name: { pig: 'Big Boar', chicken: 'Rooster' }, pigIcon: '🦏', chickenIcon: '🐓' },
  ],
};

// Merged config — server gameplay values + client display values
// Set once on game-start, read everywhere
export let GAME_CONFIG = {
  // Defaults (overwritten by server on game-start)
  NUM_LANES: 5,
  LANE_HEIGHT: 10,
  LANE_WIDTH: 2.0,
  PLAYER_HP: 100,
  MAX_ENERGY: 100,
  STARTING_ENERGY: 20,
  ENERGY_REGEN: 3,
  BASE_DAMAGE: [8, 18, 35, 60],
  UNITS: [
    { tier: 1, hp: 30, atk: 10, speed: 1.5, cost: 5, attackRate: 1.0, ...DISPLAY_CONFIG.UNITS[0] },
    { tier: 2, hp: 60, atk: 18, speed: 1.3, cost: 12, attackRate: 0.8, ...DISPLAY_CONFIG.UNITS[1] },
    { tier: 3, hp: 120, atk: 30, speed: 1.0, cost: 25, attackRate: 0.6, ...DISPLAY_CONFIG.UNITS[2] },
    { tier: 4, hp: 250, atk: 50, speed: 0.8, cost: 50, attackRate: 0.5, ...DISPLAY_CONFIG.UNITS[3] },
  ],
};

// Called on game-start with server's authoritative config
export function applyServerConfig(serverConfig) {
  if (!serverConfig) {
    console.warn('No server config received, using defaults');
    return;
  }
  GAME_CONFIG = {
    ...GAME_CONFIG,
    ...serverConfig,
    LANE_WIDTH: DISPLAY_CONFIG.LANE_WIDTH,
    // Merge server unit gameplay values with client display values
    UNITS: serverConfig.UNITS.map((su, i) => ({
      ...su,
      ...(DISPLAY_CONFIG.UNITS[i] || {}),
    })),
  };
}
