export const CUTE_AGGRESSION_CONFIG = {
  GAME_TYPE: 'cute-aggression',
  SKIP_SIDE_SELECT: false,

  /** Tick interval in ms (server game loop) */
  TICK_MS: 100,

  /** Countdown before fight starts */
  COUNTDOWN_MS: 3000,

  /** Pause between rounds */
  ROUND_PAUSE_MS: 2500,

  /** Best of N rounds */
  ROUNDS_TO_WIN: 2,

  /** Player stats */
  MAX_HP: 100,
  ATTACK_DAMAGE: 12,
  BLOCKED_DAMAGE: 2,
  SPECIAL_DAMAGE: 35,
  ATTACK_COOLDOWN_MS: 450,
  SPECIAL_COOLDOWN_MS: 800,
  HURT_STUN_MS: 300,
  ATTACK_ANIM_MS: 300,
  SPECIAL_ANIM_MS: 600,

  /** Special meter */
  SPECIAL_METER_MAX: 100,
  SPECIAL_GAIN_ON_HIT: 10,
  SPECIAL_GAIN_ON_HURT: 6,

  /** Cubit — hold-to-charge pinch attack */
  CUBIT_MAX_CHARGE_MS: 2000,
  CUBIT_MIN_DAMAGE: 5,
  CUBIT_MAX_DAMAGE: 40,
  CUBIT_VULNERABLE_MULT: 1.5,
  CUBIT_COOLDOWN_MS: 900,
  CUBIT_ANIM_MS: 400,

  /** Shield (Peluk/Hug defense) */
  SHIELD_MAX: 50,
  SHIELD_DRAIN_PER_HIT: 12,
  SHIELD_REGEN_PER_TICK: 1,

  /** Characters */
  CHARACTERS: {
    merah: {
      name: 'Si Merah',
      emoji: '\u2764\uFE0F',
      blob: '😡',
      weapon: '\uD83D\uDC8B',
      taunt: 'Gemesss!',
      color: '#ff4466',
    },
    biru: {
      name: 'Si Biru',
      emoji: '\uD83D\uDC99',
      blob: '😤',
      weapon: '\uD83E\uDD0F',
      taunt: 'Cubittt!',
      color: '#4488ff',
    },
  },
};
