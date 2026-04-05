export const DEFAULT_CONFIG = {
  ROUND_DURATION_MS: 75_000,
  NUM_ROUNDS: 5,
  MIN_WORD_LENGTH: 3,
  INTERMISSION_MS: 3500,
};

export let GAME_CONFIG = { ...DEFAULT_CONFIG };

export function applyServerConfig(serverConfig) {
  if (!serverConfig) return;
  GAME_CONFIG = { ...GAME_CONFIG, ...serverConfig };
}
