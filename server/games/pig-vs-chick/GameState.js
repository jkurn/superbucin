const GAME_CONFIG = {
  NUM_LANES: 5,
  LANE_HEIGHT: 10,
  PLAYER_HP: 100,
  MAX_ENERGY: 100,
  STARTING_ENERGY: 20,
  ENERGY_REGEN: 3,
  TICK_RATE: 20,
  BASE_DAMAGE: [8, 18, 35, 60],

  UNITS: [
    { tier: 1, hp: 30, atk: 10, speed: 1.5, cost: 5, attackRate: 1.0 },
    { tier: 2, hp: 60, atk: 18, speed: 1.3, cost: 12, attackRate: 0.8 },
    { tier: 3, hp: 120, atk: 30, speed: 1.0, cost: 25, attackRate: 0.6 },
    { tier: 4, hp: 250, atk: 50, speed: 0.8, cost: 50, attackRate: 0.5 },
  ],
};

export class GameState {
  constructor(player1, player2, emitCallback) {
    this.p1 = player1;
    this.p2 = player2;
    this.emit = emitCallback;

    this.units = [];
    this.nextUnitId = 1;
    this.energies = { [player1.id]: GAME_CONFIG.STARTING_ENERGY, [player2.id]: GAME_CONFIG.STARTING_ENERGY };
    this.playerHP = { [player1.id]: GAME_CONFIG.PLAYER_HP, [player2.id]: GAME_CONFIG.PLAYER_HP };
    this.active = false;
    this.interval = null;
  }

  start() {
    this.active = true;
    this.units = [];
    this.energies[this.p1.id] = GAME_CONFIG.STARTING_ENERGY;
    this.energies[this.p2.id] = GAME_CONFIG.STARTING_ENERGY;
    this.playerHP[this.p1.id] = GAME_CONFIG.PLAYER_HP;
    this.playerHP[this.p2.id] = GAME_CONFIG.PLAYER_HP;

    const dt = 1 / GAME_CONFIG.TICK_RATE;
    this.interval = setInterval(() => this.tick(dt), 1000 / GAME_CONFIG.TICK_RATE);
  }

  stop() {
    this.active = false;
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  tick(dt) {
    if (!this.active) return;

    // Regen energy
    this.energies[this.p1.id] = Math.min(GAME_CONFIG.MAX_ENERGY, this.energies[this.p1.id] + GAME_CONFIG.ENERGY_REGEN * dt);
    this.energies[this.p2.id] = Math.min(GAME_CONFIG.MAX_ENERGY, this.energies[this.p2.id] + GAME_CONFIG.ENERGY_REGEN * dt);

    // Update units
    this.updateUnits(dt);

    // Clean dead units
    this.units = this.units.filter((u) => {
      if (u.state === 'dead') {
        u.deadTimer = (u.deadTimer || 0) + dt;
        return u.deadTimer < 0.5;
      }
      return true;
    });

    // Send state
    this.emit('state-update', {
      units: this.units.filter((u) => u.state !== 'dead').map((u) => ({
        id: u.id,
        side: u.side,
        tier: u.tier,
        direction: u.direction,
        lane: u.lane,
        z: u.z,
        hp: u.hp,
        state: u.state,
      })),
      energies: this.energies,
      playerHP: this.playerHP,
    });

    // Check win condition
    if (this.playerHP[this.p1.id] <= 0 || this.playerHP[this.p2.id] <= 0) {
      const winnerId = this.playerHP[this.p1.id] <= 0 ? this.p2.id : this.p1.id;
      this.stop();
      this.emit('match-end', { winnerId, scores: [0, 0] });
    }
  }

  updateUnits(dt) {
    const halfLane = GAME_CONFIG.LANE_HEIGHT / 2;
    const alive = this.units.filter((u) => u.state !== 'dead');

    for (const unit of alive) {
      if (unit.state === 'march') {
        // Find closest opponent in SAME lane, ahead of us
        const opponent = this.findClosestOpponent(unit, alive);

        if (opponent && Math.abs(unit.z - opponent.z) < 0.9) {
          unit.state = 'fight';
          unit.targetId = opponent.id;
          if (opponent.state === 'march') {
            opponent.state = 'fight';
            opponent.targetId = unit.id;
          }
        } else {
          // March: direction=1 means bottom-to-top (positive z to negative z)
          // P1 goes from +halfLane toward -halfLane
          // P2 goes from -halfLane toward +halfLane
          unit.z -= unit.speed * unit.direction * dt;

          // Check if reached enemy base
          if (unit.direction === 1 && unit.z <= -halfLane) {
            this.onUnitReachedBase(unit);
          } else if (unit.direction === -1 && unit.z >= halfLane) {
            this.onUnitReachedBase(unit);
          }
        }
      } else if (unit.state === 'fight') {
        const target = alive.find((u) => u.id === unit.targetId);
        if (!target || target.state === 'dead') {
          unit.state = 'march';
          unit.targetId = null;
          continue;
        }

        unit.attackTimer += dt;
        if (unit.attackTimer >= 1 / unit.attackRate) {
          unit.attackTimer = 0;
          target.hp -= unit.atk;

          if (target.hp <= 0) {
            target.state = 'dead';
            // Release all fighters targeting this unit
            alive.forEach((u) => {
              if (u.targetId === target.id) {
                u.state = 'march';
                u.targetId = null;
              }
            });
          }
        }
      }
    }
  }

  findClosestOpponent(unit, alive) {
    let closest = null;
    let minDist = Infinity;

    for (const other of alive) {
      if (other.state === 'dead') continue;
      if (other.direction === unit.direction) continue;
      if (other.lane !== unit.lane) continue; // Same lane only

      const dist = Math.abs(unit.z - other.z);
      // Check opponent is ahead
      const ahead = unit.direction === 1
        ? other.z < unit.z
        : other.z > unit.z;

      if (ahead && dist < minDist) {
        minDist = dist;
        closest = other;
      }
    }
    return closest;
  }

  onUnitReachedBase(unit) {
    // Deal damage to the opponent's HP pool
    const damage = GAME_CONFIG.BASE_DAMAGE[unit.tier - 1];
    const opponentId = unit.ownerId === this.p1.id ? this.p2.id : this.p1.id;
    this.playerHP[opponentId] = Math.max(0, this.playerHP[opponentId] - damage);

    // Remove the unit
    unit.state = 'dead';
    unit.deadTimer = 10; // remove immediately
  }

  requestSpawn(playerId, tier, lane) {
    if (!this.active) return;
    if (tier < 1 || tier > 4) return;
    if (lane < 0 || lane >= GAME_CONFIG.NUM_LANES) return;

    const config = GAME_CONFIG.UNITS[tier - 1];
    const energy = this.energies[playerId];
    if (energy < config.cost) return;

    this.energies[playerId] -= config.cost;

    const isP1 = playerId === this.p1.id;
    const direction = isP1 ? 1 : -1;
    const side = isP1 ? this.p1.side : this.p2.side;
    const halfLane = GAME_CONFIG.LANE_HEIGHT / 2;
    const startZ = isP1 ? halfLane : -halfLane;

    const unit = {
      id: this.nextUnitId++,
      ownerId: playerId,
      side,
      tier,
      direction,
      lane,
      z: startZ,
      hp: config.hp,
      maxHp: config.hp,
      atk: config.atk,
      speed: config.speed,
      attackRate: config.attackRate,
      attackTimer: 0,
      state: 'march',
      targetId: null,
    };

    this.units.push(unit);
  }
}
