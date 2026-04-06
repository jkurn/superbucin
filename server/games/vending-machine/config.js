export const VENDING_MACHINE_CONFIG = {
  GAME_TYPE: 'vending-machine',
  SKIP_SIDE_SELECT: true,

  /** Grid dimensions */
  GRID_ROWS: 3,
  GRID_COLS: 4,

  /** Starting money */
  STARTING_YEN: 500,

  /** Machine cost to place */
  MACHINE_COST: 200,

  /** Seconds per turn */
  TURN_TIME_MS: 20_000,

  /** Countdown before game starts */
  COUNTDOWN_MS: 3000,

  /** Drink catalogue: cost to stock, base sale price, emoji */
  DRINKS: [
    { id: 'greentea', name: 'Green Tea', emoji: '\uD83C\uDF75', cost: 80, price: 130, season: 'all' },
    { id: 'coffee', name: 'Coffee', emoji: '\u2615', cost: 100, price: 170, season: 'all' },
    { id: 'ramune', name: 'Ramune', emoji: '\uD83E\uDD64', cost: 90, price: 160, season: 'summer' },
    { id: 'energy', name: 'Energy Drink', emoji: '\u26A1', cost: 120, price: 210, season: 'night' },
    { id: 'juice', name: 'Juice', emoji: '\uD83E\uDDC3', cost: 70, price: 120, season: 'all' },
    { id: 'milk', name: 'Melon Milk', emoji: '\uD83E\uDD5B', cost: 110, price: 190, season: 'all' },
  ],

  /** Location types on the map grid (3x4) */
  MAP_LAYOUT: [
    ['station', 'office', 'park', 'shrine'],
    ['street', 'school', 'arcade', 'street'],
    ['konbini', 'street', 'onsen', 'station'],
  ],

  LOCATIONS: {
    station: { name: 'Station', emoji: '\uD83D\uDE89', traffic: 5, bonus: 'energy' },
    office: { name: 'Office', emoji: '\uD83C\uDFE2', traffic: 4, bonus: 'coffee' },
    park: { name: 'Park', emoji: '\uD83C\uDF38', traffic: 3, bonus: 'juice' },
    shrine: { name: 'Shrine', emoji: '\u26E9\uFE0F', traffic: 3, bonus: 'greentea' },
    street: { name: 'Street', emoji: '\uD83D\uDEB6', traffic: 2, bonus: null },
    school: { name: 'School', emoji: '\uD83C\uDFEB', traffic: 3, bonus: 'juice' },
    arcade: { name: 'Arcade', emoji: '\uD83C\uDFAE', traffic: 4, bonus: 'energy' },
    konbini: { name: 'Konbini', emoji: '\uD83C\uDFEA', traffic: 4, bonus: 'milk' },
    onsen: { name: 'Onsen', emoji: '\u2668\uFE0F', traffic: 3, bonus: 'milk' },
  },

  /** Weather/event types that rotate each round */
  EVENTS: [
    { id: 'sunny', name: 'Sunny Day', emoji: '\u2600\uFE0F', boost: 'juice', multiplier: 1.5 },
    { id: 'rainy', name: 'Rainy Day', emoji: '\uD83C\uDF27\uFE0F', boost: 'coffee', multiplier: 1.5 },
    { id: 'hot', name: 'Heat Wave', emoji: '\uD83D\uDD25', boost: 'ramune', multiplier: 2.0 },
    { id: 'festival', name: 'Festival', emoji: '\uD83C\uDF8F', boost: 'greentea', multiplier: 1.8 },
    { id: 'night', name: 'Late Night', emoji: '\uD83C\uDF19', boost: 'energy', multiplier: 1.6 },
    { id: 'calm', name: 'Calm Day', emoji: '\uD83C\uDF3F', boost: null, multiplier: 1.0 },
  ],
};

export function getClientConfig() {
  return {
    gameType: VENDING_MACHINE_CONFIG.GAME_TYPE,
    skipSideSelect: true,
    gridRows: VENDING_MACHINE_CONFIG.GRID_ROWS,
    gridCols: VENDING_MACHINE_CONFIG.GRID_COLS,
    startingYen: VENDING_MACHINE_CONFIG.STARTING_YEN,
    machineCost: VENDING_MACHINE_CONFIG.MACHINE_COST,
    turnTimeMs: VENDING_MACHINE_CONFIG.TURN_TIME_MS,
    drinks: VENDING_MACHINE_CONFIG.DRINKS,
    mapLayout: VENDING_MACHINE_CONFIG.MAP_LAYOUT,
    locations: VENDING_MACHINE_CONFIG.LOCATIONS,
    events: VENDING_MACHINE_CONFIG.EVENTS,
  };
}
