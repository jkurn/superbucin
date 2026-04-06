export const DISPLAY_CONFIG = {
  GRID_SIZE: 6,
  SHIPS: [3, 2, 2],
  TURN_TIME_MS: 20_000,
  PLACEMENT_TIME_MS: 60_000,
};

export let GAME_CONFIG = { ...DISPLAY_CONFIG };

export function applyServerConfig(serverConfig) {
  if (!serverConfig) return;
  GAME_CONFIG = { ...GAME_CONFIG, ...serverConfig };
}
