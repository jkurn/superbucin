export let GAME_CONFIG = {
  CHARACTERS: {},
};

export function applyServerConfig(cfg) {
  GAME_CONFIG = { ...GAME_CONFIG, ...cfg };
}
