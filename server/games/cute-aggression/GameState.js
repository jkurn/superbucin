/**
 * Cute Aggression — Super Bucin Edition!
 *
 * Two adorable blob creatures face off in cute-aggressive combat.
 * Inspired by Virus vs Virus — red blob vs blue blob.
 * Three buttons: GEMAS (squeeze attack), PELUK (hug shield), CUBIT (charge pinch).
 * Special meter charges from combat — unleash a devastating CIUM (kiss) attack!
 * Best of 3 rounds. First to 0 HP loses the round.
 */

import { CUTE_AGGRESSION_CONFIG as CFG } from './config.js';

export const GAME_CONFIG = CFG;

export class GameState {
  constructor(player1, player2, emitCallback, _roomOptions = {}) {
    this.p1 = player1;
    this.p2 = player2;
    this.emit = emitCallback;

    this.active = false;
    this.paused = false;
    this.phase = 'countdown';

    this.round = 0;
    this.roundWins = {};
    this.fighters = {};
    this.actionQueue = [];

    this.tickInterval = null;
    this.phaseTimer = null;

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
        state: 'idle',
        stateTimer: 0,
        attackCooldown: 0,
        specialMeter: 0,
        shieldHP: CFG.SHIELD_MAX,
        character: p.side,
        chargeStartedAt: 0,
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

    const validTypes = ['attack', 'block-start', 'block-end', 'special', 'cubit-start', 'cubit-release'];
    if (!validTypes.includes(action.type)) return;

    this.actionQueue.push({ playerId, type: action.type });
  }

  tick() {
    if (!this.active || this.paused || this.phase !== 'fighting') return;

    this.hitEvents = [];

    // Update state timers
    for (const p of [this.p1, this.p2]) {
      const f = this.fighters[p.id];
      if (f.stateTimer > 0) {
        f.stateTimer -= CFG.TICK_MS;
        if (f.stateTimer <= 0) {
          f.stateTimer = 0;
          if (f.state === 'hurt' || f.state === 'attacking' || f.state === 'special' || f.state === 'cubit') {
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

      if (action.type === 'cubit-start') {
        if (f.state === 'idle' && f.attackCooldown <= 0) {
          f.state = 'charging';
          f.chargeStartedAt = Date.now();
        }
      } else if (action.type === 'cubit-release') {
        if (f.state === 'charging') {
          this.doCubitAttack(action.playerId);
        }
      } else if (action.type === 'block-start') {
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
        if (f.state !== 'hurt' && f.state !== 'attacking' && f.state !== 'special' && f.state !== 'charging' && f.state !== 'cubit' && f.attackCooldown <= 0) {
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

      if (defender.shieldHP <= 0) {
        defender.state = 'hurt';
        defender.stateTimer = CFG.HURT_STUN_MS;
      }
    } else {
      damage = CFG.ATTACK_DAMAGE;
      if (defender.state === 'charging') {
        damage = Math.floor(damage * CFG.CUBIT_VULNERABLE_MULT);
        defender.chargeStartedAt = 0;
      }
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

    const damage = CFG.SPECIAL_DAMAGE;
    defender.state = 'hurt';
    defender.stateTimer = CFG.HURT_STUN_MS * 2;

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

  doCubitAttack(playerId) {
    const attacker = this.fighters[playerId];
    const opponentId = playerId === this.p1.id ? this.p2.id : this.p1.id;
    const defender = this.fighters[opponentId];

    const chargeMs = Math.min(Date.now() - attacker.chargeStartedAt, CFG.CUBIT_MAX_CHARGE_MS);
    const chargeRatio = chargeMs / CFG.CUBIT_MAX_CHARGE_MS;
    const damage = Math.floor(
      CFG.CUBIT_MIN_DAMAGE + (CFG.CUBIT_MAX_DAMAGE - CFG.CUBIT_MIN_DAMAGE) * chargeRatio,
    );

    attacker.state = 'cubit';
    attacker.stateTimer = CFG.CUBIT_ANIM_MS;
    attacker.attackCooldown = CFG.CUBIT_COOLDOWN_MS;
    attacker.chargeStartedAt = 0;

    const breaksBlock = chargeRatio >= 0.6;

    if (defender.state === 'blocking' && defender.shieldHP > 0 && !breaksBlock) {
      const blockedDmg = Math.max(CFG.BLOCKED_DAMAGE, Math.floor(damage * 0.2));
      defender.hp = Math.max(0, defender.hp - blockedDmg);
      defender.shieldHP = Math.max(0, defender.shieldHP - CFG.SHIELD_DRAIN_PER_HIT * 2);

      this.hitEvents.push({
        attackerId: playerId,
        defenderId: opponentId,
        damage: blockedDmg,
        blocked: true,
        isSpecial: false,
        isCubit: true,
        chargeRatio,
      });
    } else {
      defender.hp = Math.max(0, defender.hp - damage);
      defender.state = 'hurt';
      defender.stateTimer = CFG.HURT_STUN_MS + Math.floor(chargeRatio * 200);

      this.hitEvents.push({
        attackerId: playerId,
        defenderId: opponentId,
        damage,
        blocked: false,
        isSpecial: false,
        isCubit: true,
        chargeRatio,
      });
    }

    attacker.specialMeter = Math.min(
      CFG.SPECIAL_METER_MAX,
      attacker.specialMeter + Math.floor(CFG.SPECIAL_GAIN_ON_HIT * (1 + chargeRatio)),
    );
    defender.specialMeter = Math.min(CFG.SPECIAL_METER_MAX, defender.specialMeter + CFG.SPECIAL_GAIN_ON_HURT);

    if (defender.hp <= 0) {
      this.endRound(playerId);
    }
  }

  endRound(winnerId) {
    this.clearTimers();
    this.phase = 'round-end';
    this.roundWins[winnerId]++;

    this.broadcastState();

    if (this.roundWins[winnerId] >= CFG.ROUNDS_TO_WIN) {
      this.phaseTimer = setTimeout(() => {
        this.finishMatch(winnerId);
      }, CFG.ROUND_PAUSE_MS);
    } else {
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
      const of2 = this.fighters[opponent.id] || {};
      const pChar = CFG.CHARACTERS[pf.character] || CFG.CHARACTERS.merah;
      const oChar = CFG.CHARACTERS[of2.character] || CFG.CHARACTERS.biru;

      return {
        gameType: 'cute-aggression',
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
          chargePct: pf.state === 'charging' && pf.chargeStartedAt
            ? Math.min(1, (Date.now() - pf.chargeStartedAt) / CFG.CUBIT_MAX_CHARGE_MS)
            : 0,
        },
        opp: {
          hp: of2.hp ?? CFG.MAX_HP,
          maxHp: CFG.MAX_HP,
          state: of2.state || 'idle',
          specialMeter: of2.specialMeter || 0,
          specialMax: CFG.SPECIAL_METER_MAX,
          shieldHP: of2.shieldHP ?? CFG.SHIELD_MAX,
          shieldMax: CFG.SHIELD_MAX,
          character: oChar,
          side: of2.character,
          chargePct: of2.state === 'charging' && of2.chargeStartedAt
            ? Math.min(1, (Date.now() - of2.chargeStartedAt) / CFG.CUBIT_MAX_CHARGE_MS)
            : 0,
        },
        hitEvents: this.hitEvents.map((e) => ({
          ...e,
          iDidIt: e.attackerId === player.id,
          iGotHit: e.defenderId === player.id,
        })),
      };
    };

    this.emit('cute-aggression-state', {
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
    const of2 = this.fighters[opponent.id] || {};
    const pChar = CFG.CHARACTERS[pf.character] || CFG.CHARACTERS.merah;
    const oChar = CFG.CHARACTERS[of2.character] || CFG.CHARACTERS.biru;

    return {
      cuteAggressionState: {
        gameType: 'cute-aggression',
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
          chargePct: 0,
        },
        opp: {
          hp: of2.hp ?? CFG.MAX_HP,
          maxHp: CFG.MAX_HP,
          state: of2.state || 'idle',
          specialMeter: of2.specialMeter || 0,
          specialMax: CFG.SPECIAL_METER_MAX,
          shieldHP: of2.shieldHP ?? CFG.SHIELD_MAX,
          shieldMax: CFG.SHIELD_MAX,
          character: oChar,
          side: of2.character,
          chargePct: 0,
        },
        hitEvents: [],
      },
    };
  }
}
