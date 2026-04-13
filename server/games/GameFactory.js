// Server-side game factory
// Each game registers: GameState class + config
// RoomManager calls create() to instantiate the right game

import { getClientConfig as getMemoryMatchClientConfig } from './memory-match/config.js';
import {
  getDoodlePacksMeta,
  DEFAULT_DOODLE_PACK_ID,
} from './doodle-guess/prompts.js';
import { getClientConfig as getVendingClientConfig } from './vending-machine/config.js';
import { STICKER_HIT_GAME_CONFIG } from '../../shared/sticker-hit/gameConfig.js';

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

    if (gameType === 'vending-machine') {
      return getVendingClientConfig();
    }

    if (gameType === 'bonk-brawl') {
      return {
        CHARACTERS: config.CHARACTERS,
      };
    }

    if (gameType === 'cute-aggression') {
      return {
        CHARACTERS: config.CHARACTERS,
      };
    }

    if (gameType === 'speed-match') {
      return {
        QUESTIONS_PER_ROUND: config.QUESTIONS_PER_ROUND,
        BONUS_QUESTIONS: config.BONUS_QUESTIONS,
        TIME_PER_QUESTION_MS: config.TIME_PER_QUESTION_MS,
        MATCH_POINTS: config.MATCH_POINTS,
        BONUS_MATCH_POINTS: config.BONUS_MATCH_POINTS,
        REVEAL_DURATION_MS: config.REVEAL_DURATION_MS,
        COUNTDOWN_MS: config.COUNTDOWN_MS,
      };
    }

    if (gameType === 'othello') {
      return {
        BOARD_SIZE: config.BOARD_SIZE,
        TURN_TIME_MS: config.TURN_TIME_MS,
        TURN_STICKERS: config.TURN_STICKERS,
      };
    }

    if (gameType === 'connect-four') {
      return {
        ROWS: config.ROWS,
        COLS: config.COLS,
      };
    }

    if (gameType === 'quiz-race') {
      return {
        QUESTIONS_PER_ROUND: config.QUESTIONS_PER_ROUND,
        TIME_PER_QUESTION_MS: config.TIME_PER_QUESTION_MS,
      };
    }

    if (gameType === 'battleship-mini') {
      return {
        GRID_SIZE: config.GRID_SIZE,
        SHIPS: config.SHIPS,
        TURN_TIME_MS: config.TURN_TIME_MS,
        PLACEMENT_TIME_MS: config.PLACEMENT_TIME_MS,
      };
    }

    if (gameType === 'word-scramble-race') {
      return {
        ROUND_DURATION_MS: config.ROUND_DURATION_MS,
        NUM_ROUNDS: config.NUM_ROUNDS,
        MIN_WORD_LENGTH: config.MIN_WORD_LENGTH,
        INTERMISSION_MS: config.INTERMISSION_MS,
      };
    }

    if (gameType === 'sticker-hit') {
      const sh = STICKER_HIT_GAME_CONFIG;
      return {
        COUNTDOWN_MS: sh.COUNTDOWN_MS,
        TICK_MS: sh.TICK_MS,
        COLLISION_DEGREES: sh.COLLISION_DEGREES,
        STAGES: sh.STAGES,
        SKINS: sh.SKINS,
        APPLES_MIN: sh.APPLES_MIN,
        APPLES_MAX: sh.APPLES_MAX,
        APPLE_HIT_DEGREES: sh.APPLE_HIT_DEGREES,
        SPIKE_EXTRA_DEGREES: sh.SPIKE_EXTRA_DEGREES,
        THROW_FLIGHT_MS: sh.THROW_FLIGHT_MS,
        THROW_FLIGHT_MAX_MS: sh.THROW_FLIGHT_MAX_MS,
        THROW_CHECK_PATH_COLLISION: sh.THROW_CHECK_PATH_COLLISION,
        THROW_PATH_SAMPLES: sh.THROW_PATH_SAMPLES,
        MARATHON_ROUNDS: sh.MARATHON_ROUNDS,
        THROW_WOBBLE_X: sh.THROW_WOBBLE_X,
        THROW_WOBBLE_Y: sh.THROW_WOBBLE_Y,
      };
    }

    if (gameType === 'doodle-guess') {
      return {
        ROUND_TIME_MS: config.ROUND_TIME_MS,
        TOTAL_ROUNDS: config.TOTAL_ROUNDS,
        MAX_POINTS_PER_ROUND: config.MAX_POINTS_PER_ROUND,
        MIN_POINTS_CORRECT: config.MIN_POINTS_CORRECT,
        packs: getDoodlePacksMeta(),
        defaultPackId: DEFAULT_DOODLE_PACK_ID,
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
