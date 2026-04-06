export const DISPLAY_CONFIG = {
  QUESTIONS_PER_ROUND: 10,
  TIME_PER_QUESTION_MS: 12_000,
};

export let GAME_CONFIG = { ...DISPLAY_CONFIG };

export function applyServerConfig(serverConfig) {
  if (!serverConfig) return;
  GAME_CONFIG = { ...GAME_CONFIG, ...serverConfig };
}
