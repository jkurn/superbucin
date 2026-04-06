/**
 * Bonk Brawl — Real-time cute fighting game.
 *
 * Two adorable characters face off in a bonk-or-block battle.
 * Two buttons: BONK (attack) and SHIELD (block).
 * Special meter charges from combat — unleash a devastating super bonk!
 * Best of 3 rounds. First to 0 HP loses the round.
 */

import { BONK_BRAWL_CONFIG as CFG } from './config.js';

export const GAME_CONFIG = CFG;

export class GameState {
  constructor(player1, player2, emitCallback, _roomOptions = {}) {
    this.p1 = player1;
    this.p2 = player2;
    this.emit = emitCallback;

    this.active = false;
    this.paused = false;
    this.phase = 'countdown'; // 'countdown' | 'fighting' | 'round-end' | 'finished'

    this.round = 0;
    this.roundWins = {};
    this.fighters = {};
    this.actionQueue = [];

    this.tickInterval = null;
    this.phaseTimer = null;

    // Hit flash tracking for client effects
    this.hitEvents = [];
  }

  start() {
    this.active = true;
    this.paused = false;
    this.round = 0;
    this.roundWins = { [this.p1.id]: 0, [this.p2.id]: 0 };

    this.phase = 'countdown';
    this.clearTimers();
    this.startCountdown();
  }

  stop() {
    this.active = false;
    this.clearTimers();
  }

  pause() {
    if (!this.active) return;
    this.paused = true;
    this.clearTimers();
  }

  resume() {
    if (!this.active) return;
    this.paused = false;
    if (this.phase === 'fighting') {
      this.startTickLoop();
      this.broadcastState();
    } else if (this.phase === 'countdown') {
      this.startCountdown();
    }
  }

  clearTimers() {
    if (this.tickInterval) { clearInterval(this.tickInterval); this.tickInterval = null; }
    if (this.phaseTimer) { clearTimeout(this.phaseTimer); this.phaseTimer = null; }
  }

  initFighters() {
    for (const p of [this.p1, this.p2]) {
      this.fighters[p.id] = {
        hp: CFG.MAX_HP,
        state: 'idle', // 'idle' | 'attacking' | 'blocking' | 'hurt' | 'special'
        stateTimer: 0,
        attackCooldown: 0,
        specialMeter: 0,
        shieldHP: CFG.SHIELD_MAX,
        character: p.side, // 'bunny' or 'kitty'
      };
    }
  }

  startCountdown() {
    this.round++;
    this.initFighters();
    this.hitEvents = [];
    this.actionQueue = [];
    this.phase = 'countdown';
    this.broadcastState();

    this.phaseTimer = setTimeout(() => {
      this.phaseTimer = null;
      this.phase = 'fighting';
      this.startTickLoop();
      this.broadcastState();
    }, CFG.COUNTDOWN_MS);
  }

  startTickLoop() {
    if (this.tickInterval) clearInterval(this.tickInterval);
    this.tickInterval = setInterval(() => this.tick(), CFG.TICK_MS);
  }

  handleAction(playerId, action) {
    if (!this.active || this.paused) return;
    if (this.phase !== 'fighting') return;
    if (!action || typeof action !== 'object') return;

    const validTypes = ['attack', 'block-start', 'block-end', 'special'];
    if (!validTypes.includes(action.type)) return;

    this.actionQueue.push({ playerId, type: action.type });
  }

  tick() {
    if (!this.active || this.paused || this.phase !== 'fighting') return;

    // Clear hit events from previous tick
    this.hitEvents = [];

    // Update state timers
    for (const p of [this.p1, this.p2]) {
      const f = this.fighters[p.id];
      if (f.stateTimer > 0) {
        f.stateTimer -= CFG.TICK_MS;
        if (f.stateTimer <= 0) {
          f.stateTimer = 0;
          if (f.state === 'hurt' || f.state === 'attacking' || f.state === 'special') {
            f.state = 'idle';
          }
        }
      }
      if (f.attackCooldown > 0) {
        f.attackCooldown = Math.max(0, f.attackCooldown - CFG.TICK_MS);
      }
    }

    // Process action queue
    const queue = [...this.actionQueue];
    this.actionQueue = [];

    for (const action of queue) {
      const f = this.fighters[action.playerId];
      if (!f) continue;

      if (action.type === 'block-start') {
        if (f.state === 'idle' && f.shieldHP > 0) {
          f.state = 'blocking';
        }
      } else if (action.type === 'block-end') {
        if (f.state === 'blocking') {
          f.state = 'idle';
        }
      } else if (action.type === 'special') {
        if (f.specialMeter >= CFG.SPECIAL_METER_MAX && f.state !== 'hurt' && f.attackCooldown <= 0) {
          this.doSpecialAttack(action.playerId);
        }
      } else if (action.type === 'attack') {
        if (f.state !== 'hurt' && f.state !== 'attacking' && f.state !== 'special' && f.attackCooldown <= 0) {
          // Auto-upgrade to special if meter is full
          if (f.specialMeter >= CFG.SPECIAL_METER_MAX) {
            this.doSpecialAttack(action.playerId);
          } else {
            this.doAttack(action.playerId);
          }
        }
      }
    }

    // Shield regen when not blocking
    for (const p of [this.p1, this.p2]) {
      const f = this.fighters[p.id];
      if (f.state !== 'blocking' && f.shieldHP < CFG.SHIELD_MAX) {
        f.shieldHP = Math.min(CFG.SHIELD_MAX, f.shieldHP + CFG.SHIELD_REGEN_PER_TICK);
      }
    }

    this.broadcastState();
  }

  doAttack(playerId) {
    const attacker = this.fighters[playerId];
    const opponentId = playerId === this.p1.id ? this.p2.id : this.p1.id;
    const defender = this.fighters[opponentId];

    attacker.state = 'attacking';
    attacker.stateTimer = CFG.ATTACK_ANIM_MS;
    attacker.attackCooldown = CFG.ATTACK_COOLDOWN_MS;

    let damage;
    let blocked = false;

    if (defender.state === 'blocking' && defender.shieldHP > 0) {
      damage = CFG.BLOCKED_DAMAGE;
      defender.shieldHP = Math.max(0, defender.shieldHP - CFG.SHIELD_DRAIN_PER_HIT);
      blocked = true;

      // If shield breaks, stun the defender
      if (defender.shieldHP <= 0) {
        defender.state = 'hurt';
        defender.stateTimer = CFG.HURT_STUN_MS;
      }
    } else {
      damage = CFG.ATTACK_DAMAGE;
      defender.state = 'hurt';
      defender.stateTimer = CFG.HURT_STUN_MS;
    }

    defender.hp = Math.max(0, defender.hp - damage);
    attacker.specialMeter = Math.min(CFG.SPECIAL_METER_MAX, attacker.specialMeter + CFG.SPECIAL_GAIN_ON_HIT);
    defender.specialMeter = Math.min(CFG.SPECIAL_METER_MAX, defender.specialMeter + CFG.SPECIAL_GAIN_ON_HURT);

    this.hitEvents.push({
      attackerId: playerId,
      defenderId: opponentId,
      damage,
      blocked,
      isSpecial: false,
    });

    if (defender.hp <= 0) {
      this.endRound(playerId);
    }
  }

  doSpecialAttack(playerId) {
    const attacker = this.fighters[playerId];
    const opponentId = playerId === this.p1.id ? this.p2.id : this.p1.id;
    const defender = this.fighters[opponentId];

    attacker.state = 'special';
    attacker.stateTimer = CFG.SPECIAL_ANIM_MS;
    attacker.attackCooldown = CFG.SPECIAL_COOLDOWN_MS;
    attacker.specialMeter = 0;

    // Special breaks through block
    const damage = CFG.SPECIAL_DAMAGE;
    defender.state = 'hurt';
    defender.stateTimer = CFG.HURT_STUN_MS * 2; // longer stun from special

    defender.hp = Math.max(0, defender.hp - damage);
    defender.specialMeter = Math.min(CFG.SPECIAL_METER_MAX, defender.specialMeter + CFG.SPECIAL_GAIN_ON_HURT);

    this.hitEvents.push({
      attackerId: playerId,
      defenderId: opponentId,
      damage,
      blocked: false,
      isSpecial: true,
    });

    if (defender.hp <= 0) {
      this.endRound(playerId);
    }
  }

  endRound(winnerId) {
    this.clearTimers();
    this.phase = 'round-end';
    this.roundWins[winnerId]++;

    this.broadcastState();

    // Check match winner
    if (this.roundWins[winnerId] >= CFG.ROUNDS_TO_WIN) {
      this.phaseTimer = setTimeout(() => {
        this.finishMatch(winnerId);
      }, CFG.ROUND_PAUSE_MS);
    } else {
      // Start next round
      this.phaseTimer = setTimeout(() => {
        this.phaseTimer = null;
        this.startCountdown();
      }, CFG.ROUND_PAUSE_MS);
    }
  }

  finishMatch(winnerId) {
    this.active = false;
    this.phase = 'finished';
    this.clearTimers();

    const s1 = this.roundWins[this.p1.id];
    const s2 = this.roundWins[this.p2.id];

    this.emit('match-end', {
      winnerId,
      tie: false,
      scores: [s1, s2],
    });
  }

  broadcastState() {
    const buildSlice = (player, opponent) => {
      const pf = this.fighters[player.id] || {};
      const of = this.fighters[opponent.id] || {};
      const pChar = CFG.CHARACTERS[pf.character] || CFG.CHARACTERS.bunny;
      const oChar = CFG.CHARACTERS[of.character] || CFG.CHARACTERS.kitty;

      return {
        gameType: 'bonk-brawl',
        phase: this.phase,
        round: this.round,
        myRoundWins: this.roundWins[player.id] || 0,
        oppRoundWins: this.roundWins[opponent.id] || 0,
        roundsToWin: CFG.ROUNDS_TO_WIN,
        me: {
          hp: pf.hp ?? CFG.MAX_HP,
          maxHp: CFG.MAX_HP,
          state: pf.state || 'idle',
          specialMeter: pf.specialMeter || 0,
          specialMax: CFG.SPECIAL_METER_MAX,
          shieldHP: pf.shieldHP ?? CFG.SHIELD_MAX,
          shieldMax: CFG.SHIELD_MAX,
          character: pChar,
          side: pf.character,
        },
        opp: {
          hp: of.hp ?? CFG.MAX_HP,
          maxHp: CFG.MAX_HP,
          state: of.state || 'idle',
          specialMeter: of.specialMeter || 0,
          specialMax: CFG.SPECIAL_METER_MAX,
          shieldHP: of.shieldHP ?? CFG.SHIELD_MAX,
          shieldMax: CFG.SHIELD_MAX,
          character: oChar,
          side: of.character,
        },
        hitEvents: this.hitEvents.map((e) => ({
          ...e,
          iDidIt: e.attackerId === player.id,
          iGotHit: e.defenderId === player.id,
        })),
      };
    };

    this.emit('bonk-state', {
      byPlayer: {
        [this.p1.id]: buildSlice(this.p1, this.p2),
        [this.p2.id]: buildSlice(this.p2, this.p1),
      },
    });
  }

  getReconnectPayload(socketId) {
    const player = socketId === this.p1.id ? this.p1 : this.p2;
    const opponent = socketId === this.p1.id ? this.p2 : this.p1;
    const pf = this.fighters[player.id] || {};
    const of = this.fighters[opponent.id] || {};
    const pChar = CFG.CHARACTERS[pf.character] || CFG.CHARACTERS.bunny;
    const oChar = CFG.CHARACTERS[of.character] || CFG.CHARACTERS.kitty;

    return {
      bonkState: {
        gameType: 'bonk-brawl',
        phase: this.phase,
        round: this.round,
        myRoundWins: this.roundWins[player.id] || 0,
        oppRoundWins: this.roundWins[opponent.id] || 0,
        roundsToWin: CFG.ROUNDS_TO_WIN,
        me: {
          hp: pf.hp ?? CFG.MAX_HP,
          maxHp: CFG.MAX_HP,
          state: pf.state || 'idle',
          specialMeter: pf.specialMeter || 0,
          specialMax: CFG.SPECIAL_METER_MAX,
          shieldHP: pf.shieldHP ?? CFG.SHIELD_MAX,
          shieldMax: CFG.SHIELD_MAX,
          character: pChar,
          side: pf.character,
        },
        opp: {
          hp: of.hp ?? CFG.MAX_HP,
          maxHp: CFG.MAX_HP,
          state: of.state || 'idle',
          specialMeter: of.specialMeter || 0,
          specialMax: CFG.SPECIAL_METER_MAX,
          shieldHP: of.shieldHP ?? CFG.SHIELD_MAX,
          shieldMax: CFG.SHIELD_MAX,
          character: oChar,
          side: of.character,
        },
        hitEvents: [],
      },
    };
  }
}
