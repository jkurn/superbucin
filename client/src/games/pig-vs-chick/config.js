export const GAME_CONFIG = {
  // Battlefield — 5 vertical lanes
  NUM_LANES: 5,
  LANE_HEIGHT: 10,       // total vertical distance units travel
  LANE_WIDTH: 2.0,       // width of each lane

  // Player HP pool
  PLAYER_HP: 100,

  // Energy (coins)
  MAX_ENERGY: 100,
  STARTING_ENERGY: 20,
  ENERGY_REGEN: 3,       // per second

  // Damage when unit reaches enemy base
  BASE_DAMAGE: [8, 18, 35, 60], // per tier

  // Unit tiers
  UNITS: [
    {
      tier: 1,
      name: { pig: 'Piglet', chicken: 'Chick' },
      pigIcon: '🐷',
      chickenIcon: '🐤',
      hp: 30,
      atk: 10,
      speed: 1.5,
      cost: 5,
      attackRate: 1.0,
    },
    {
      tier: 2,
      name: { pig: 'Pig', chicken: 'Hen' },
      pigIcon: '🐖',
      chickenIcon: '🐥',
      hp: 60,
      atk: 18,
      speed: 1.3,
      cost: 12,
      attackRate: 0.8,
    },
    {
      tier: 3,
      name: { pig: 'Boar', chicken: 'Chicken' },
      pigIcon: '🐗',
      chickenIcon: '🐔',
      hp: 120,
      atk: 30,
      speed: 1.0,
      cost: 25,
      attackRate: 0.6,
    },
    {
      tier: 4,
      name: { pig: 'Big Boar', chicken: 'Rooster' },
      pigIcon: '🦏',
      chickenIcon: '🐓',
      hp: 250,
      atk: 50,
      speed: 0.8,
      cost: 50,
      attackRate: 0.5,
    },
  ],
};
