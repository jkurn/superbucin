// Server-side game factory
// Each game registers: GameState class + config
// RoomManager calls create() to instantiate the right game

import { getClientConfig as getMemoryMatchClientConfig } from './memory-match/config.js';

const games = new Map();

export const GameFactory = {
  register(gameType, GameStateClass, config) {
    games.set(gameType, { GameStateClass, config });
  },

  create(gameType, p1, p2, emitCallback, roomOptions = {}) {
    const entry = games.get(gameType);
    if (!entry) {
      console.error(`Unknown game type: ${gameType}`);
      return null;
    }
    return new entry.GameStateClass(p1, p2, emitCallback, roomOptions);
  },

  skipSideSelect(gameType) {
    const entry = games.get(gameType);
    return !!(entry && entry.config && entry.config.SKIP_SIDE_SELECT);
  },

  getConfig(gameType, roomOptions = {}) {
    const entry = games.get(gameType);
    if (!entry) return null;
    const config = entry.config;

    if (gameType === 'memory-match') {
      return getMemoryMatchClientConfig(roomOptions);
    }

    if (gameType === 'word-scramble-race') {
      return {
        ROUND_DURATION_MS: config.ROUND_DURATION_MS,
        NUM_ROUNDS: config.NUM_ROUNDS,
        MIN_WORD_LENGTH: config.MIN_WORD_LENGTH,
        INTERMISSION_MS: config.INTERMISSION_MS,
      };
    }

    if (gameType === 'doodle-guess') {
      return {
        ROUND_TIME_MS: config.ROUND_TIME_MS,
        TOTAL_ROUNDS: config.TOTAL_ROUNDS,
        MAX_POINTS_PER_ROUND: config.MAX_POINTS_PER_ROUND,
        MIN_POINTS_CORRECT: config.MIN_POINTS_CORRECT,
      };
    }

    const units = config.UNITS || [];
    return {
      NUM_LANES: config.NUM_LANES,
      LANE_HEIGHT: config.LANE_HEIGHT,
      PLAYER_HP: config.PLAYER_HP,
      MAX_ENERGY: config.MAX_ENERGY,
      STARTING_ENERGY: config.STARTING_ENERGY,
      ENERGY_REGEN: config.ENERGY_REGEN,
      BASE_DAMAGE: config.BASE_DAMAGE,
      UNITS: units.map((u) => ({
        tier: u.tier, hp: u.hp, atk: u.atk,
        speed: u.speed, cost: u.cost, attackRate: u.attackRate,
      })),
    };
  },

  has(gameType) {
    return games.has(gameType);
  },
};
