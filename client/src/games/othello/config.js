// Display-only fields — gameplay values come from server
export const DISPLAY_CONFIG = {
  BOARD_SIZE: 8,
  CELL_SIZE: 1.0,
  DISC_RADIUS: 0.38,
  DISC_HEIGHT: 0.12,
  CAMERA_FRUSTUM: 6,
};

// Merged config — server gameplay values + client display values
export let GAME_CONFIG = {
  BOARD_SIZE: 8,
  ...DISPLAY_CONFIG,
};

export function applyServerConfig(serverConfig) {
  if (!serverConfig) return;
  GAME_CONFIG = { ...GAME_CONFIG, ...serverConfig };
}
