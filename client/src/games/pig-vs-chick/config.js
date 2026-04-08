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
  BASE_DAMAGE: [60, 35, 18, 8],
  UNITS: [
    { tier: 1, weight: 10, hp: 40, speed: 1.8, cost: 5, ...DISPLAY_CONFIG.UNITS[0] },
    { tier: 2, weight: 20, hp: 70, speed: 1.4, cost: 12, ...DISPLAY_CONFIG.UNITS[1] },
    { tier: 3, weight: 50, hp: 130, speed: 1.0, cost: 25, ...DISPLAY_CONFIG.UNITS[2] },
    { tier: 4, weight: 70, hp: 200, speed: 0.7, cost: 50, ...DISPLAY_CONFIG.UNITS[3] },
  ],
};

// Called on game-start with server's authoritative config
export function applyServerConfig(serverConfig) {
  if (!serverConfig) return;
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
