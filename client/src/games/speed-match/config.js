export let GAME_CONFIG = {
  QUESTIONS_PER_ROUND: 10,
  BONUS_QUESTIONS: 2,
  TIME_PER_QUESTION_MS: 15_000,
  MATCH_POINTS: 10,
  BONUS_MATCH_POINTS: 20,
  REVEAL_DURATION_MS: 3500,
  COUNTDOWN_MS: 3000,
};

export function applyServerConfig(serverConfig) {
  if (!serverConfig) return;
  GAME_CONFIG = { ...GAME_CONFIG, ...serverConfig };
}
