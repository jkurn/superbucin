export const CUTE_AGGRESSION_CONFIG = {
  GAME_TYPE: 'cute-aggression',
  SKIP_SIDE_SELECT: false,

  /** Tick interval in ms (server game loop) */
  TICK_MS: 80,

  /** Countdown before fight starts */
  COUNTDOWN_MS: 3000,

  /** Pause between rounds */
  ROUND_PAUSE_MS: 2500,

  /** Best of N rounds */
  ROUNDS_TO_WIN: 2,

  /** Player stats */
  MAX_HP: 120,

  /** GEMAS — squeeze attack (medium damage, medium speed) */
  ATTACK_DAMAGE: 12,
  ATTACK_COOLDOWN_MS: 400,
  ATTACK_ANIM_MS: 300,

  /** GIGIT — bite attack (low damage, fast, builds combo + special faster) */
  GIGIT_DAMAGE: 7,
  GIGIT_COOLDOWN_MS: 220,
  GIGIT_ANIM_MS: 180,
  GIGIT_SPECIAL_GAIN: 12,
  GIGIT_COMBO_WINDOW_MS: 800,

  /** Combo multiplier: base * (1 + comboCount * COMBO_MULT) */
  COMBO_MULT: 0.15,
  MAX_COMBO: 10,

  /** Blocked damage */
  BLOCKED_DAMAGE: 1,

  /** CIUM — kiss super attack (breaks through block) */
  SPECIAL_DAMAGE: 40,
  SPECIAL_COOLDOWN_MS: 800,
  SPECIAL_ANIM_MS: 700,

  /** Special meter */
  SPECIAL_METER_MAX: 100,
  SPECIAL_GAIN_ON_HIT: 8,
  SPECIAL_GAIN_ON_HURT: 5,

  /** Hurt stun */
  HURT_STUN_MS: 250,

  /** CUBIT — hold-to-charge pinch attack */
  CUBIT_MAX_CHARGE_MS: 2000,
  CUBIT_MIN_DAMAGE: 5,
  CUBIT_MAX_DAMAGE: 45,
  CUBIT_VULNERABLE_MULT: 1.5,
  CUBIT_COOLDOWN_MS: 800,
  CUBIT_ANIM_MS: 350,

  /** PELUK — hug shield */
  SHIELD_MAX: 50,
  SHIELD_DRAIN_PER_HIT: 10,
  SHIELD_REGEN_PER_TICK: 1,

  /** Rage mode — triggered at low HP, boosts damage */
  RAGE_HP_THRESHOLD: 30,
  RAGE_DAMAGE_MULT: 1.3,

  /** Characters */
  CHARACTERS: {
    merah: {
      name: 'Si Merah',
      emoji: '\u2764\uFE0F',
      blob: '\uD83D\uDE21',
      weapon: '\uD83D\uDC8B',
      taunt: 'Gemesss banget sih kamu!!',
      color: '#ff4466',
      colorLight: '#ff8899',
      colorDark: '#cc2244',
    },
    biru: {
      name: 'Si Biru',
      emoji: '\uD83D\uDC99',
      blob: '\uD83D\uDE24',
      weapon: '\uD83E\uDD0F',
      taunt: 'Cubittt pipinya!!',
      color: '#4488ff',
      colorLight: '#88bbff',
      colorDark: '#2266dd',
    },
  },
};
