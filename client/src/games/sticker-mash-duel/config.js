export let GAME_CONFIG = {
  COUNTDOWN_MS: 3000,
  ROUND_MS: 45000,
  TAP_COOLDOWN_MS: 65,
  POINTS_PER_STICK: 1,
  POINTS_PER_CRASH: -2,
};

export function applyServerConfig(serverConfig) {
  if (!serverConfig) return;
  GAME_CONFIG = { ...GAME_CONFIG, ...serverConfig };
}
