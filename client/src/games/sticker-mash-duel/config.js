export let GAME_CONFIG = {
  COUNTDOWN_MS: 3000,
  ROUND_MS: 30000,
  TAP_COOLDOWN_MS: 65,
  POINTS_PER_STICK: 1,
};

export function applyServerConfig(serverConfig) {
  if (!serverConfig) return;
  GAME_CONFIG = { ...GAME_CONFIG, ...serverConfig };
}
