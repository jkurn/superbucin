export let GAME_CONFIG = {
  gridRows: 3,
  gridCols: 4,
  startingYen: 500,
  machineCost: 200,
  turnTimeMs: 20_000,
  drinks: [],
  mapLayout: [],
  locations: {},
  events: [],
};

export function applyServerConfig(cfg) {
  GAME_CONFIG = { ...GAME_CONFIG, ...cfg };
}
