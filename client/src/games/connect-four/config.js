export const DISPLAY_CONFIG = {
  ROWS: 6,
  COLS: 7,
};

export let GAME_CONFIG = {
  ...DISPLAY_CONFIG,
};

export function applyServerConfig(serverConfig) {
  if (!serverConfig) return;
  GAME_CONFIG = { ...GAME_CONFIG, ...serverConfig };
}
