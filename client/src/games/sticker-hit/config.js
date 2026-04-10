export let GAME_CONFIG = {
  COUNTDOWN_MS: 2500,
  COLLISION_DEGREES: 14,
  TICK_MS: 100,
  STAGES: [
    { stickersToLand: 6, obstacles: 1, minDps: 60, maxDps: 120 },
    { stickersToLand: 7, obstacles: 2, minDps: 70, maxDps: 150 },
    { stickersToLand: 8, obstacles: 3, minDps: 85, maxDps: 180 },
  ],
};

export function applyServerConfig(serverConfig) {
  if (!serverConfig) return;
  GAME_CONFIG = { ...GAME_CONFIG, ...serverConfig };
}

