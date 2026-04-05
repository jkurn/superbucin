// Defaults until server sends game-start config
export let DOODLE_CONFIG = {
  ROUND_TIME_MS: 30000,
  TOTAL_ROUNDS: 6,
  MAX_POINTS_PER_ROUND: 100,
  MIN_POINTS_CORRECT: 8,
};

export function applyServerConfig(serverConfig) {
  if (!serverConfig) return;
  DOODLE_CONFIG = {
    ROUND_TIME_MS: serverConfig.ROUND_TIME_MS ?? DOODLE_CONFIG.ROUND_TIME_MS,
    TOTAL_ROUNDS: serverConfig.TOTAL_ROUNDS ?? DOODLE_CONFIG.TOTAL_ROUNDS,
    MAX_POINTS_PER_ROUND: serverConfig.MAX_POINTS_PER_ROUND ?? DOODLE_CONFIG.MAX_POINTS_PER_ROUND,
    MIN_POINTS_CORRECT: serverConfig.MIN_POINTS_CORRECT ?? DOODLE_CONFIG.MIN_POINTS_CORRECT,
  };
}
