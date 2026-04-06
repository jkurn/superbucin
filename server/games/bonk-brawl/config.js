export const BONK_BRAWL_CONFIG = {
  GAME_TYPE: 'bonk-brawl',
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
  ATTACK_DAMAGE: 10,
  BLOCKED_DAMAGE: 2,
  SPECIAL_DAMAGE: 30,
  ATTACK_COOLDOWN_MS: 500,
  SPECIAL_COOLDOWN_MS: 800,
  HURT_STUN_MS: 300,
  ATTACK_ANIM_MS: 250,
  SPECIAL_ANIM_MS: 500,

  /** Special meter */
  SPECIAL_METER_MAX: 100,
  SPECIAL_GAIN_ON_HIT: 8,
  SPECIAL_GAIN_ON_HURT: 5,

  /** Shield regen rate per tick when not blocking */
  SHIELD_MAX: 50,
  SHIELD_DRAIN_PER_HIT: 10,
  SHIELD_REGEN_PER_TICK: 1,

  /** Characters (cosmetic + minor stat tweaks) */
  CHARACTERS: {
    bunny: {
      name: 'Usagi',
      emoji: '\uD83D\uDC30',
      weapon: '\uD83E\uDD55',
      taunt: 'Bonk bonk!',
    },
    kitty: {
      name: 'Neko',
      emoji: '\uD83D\uDC31',
      weapon: '\uD83D\uDC3E',
      taunt: 'Nya~!',
    },
  },
};
