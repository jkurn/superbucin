export const GAME_CONFIG = {
  NUM_LANES: 5,
  LANE_HEIGHT: 10,
  PLAYER_HP: 100,
  MAX_ENERGY: 100,
  STARTING_ENERGY: 20,
  ENERGY_REGEN: 3,
  TICK_RATE: 20,
  BASE_DAMAGE: [60, 35, 18, 8],

  // Tug-of-war push combat
  PUSH_SPEED: 0.015,        // push speed per weight-difference unit
  PUSH_DAMAGE: 0.3,         // HP damage/sec per weight-difference unit
  EQUAL_PUSH_DAMAGE: 3,     // HP damage/sec when weights are equal
  COLLISION_DIST: 1.0,      // distance at which units begin pushing

  UNITS: [
    { tier: 1, weight: 10, hp: 40, speed: 1.8, cost: 5 },
    { tier: 2, weight: 20, hp: 70, speed: 1.4, cost: 12 },
    { tier: 3, weight: 50, hp: 130, speed: 1.0, cost: 25 },
    { tier: 4, weight: 70, hp: 200, speed: 0.7, cost: 50 },
  ],
};

export class GameState {
  constructor(player1, player2, emitCallback, _roomOptions = {}) {
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

  pause() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  resume() {
    if (!this.active || this.interval) return;
    const dt = 1 / GAME_CONFIG.TICK_RATE;
    this.interval = setInterval(() => this.tick(dt), 1000 / GAME_CONFIG.TICK_RATE);
  }

  migratePlayer(oldId, newId, playerObj) {
    if (this.p1.id === oldId) this.p1 = playerObj;
    else if (this.p2.id === oldId) this.p2 = playerObj;
    this.energies[newId] = this.energies[oldId];
    delete this.energies[oldId];
    this.playerHP[newId] = this.playerHP[oldId];
    delete this.playerHP[oldId];
    this.units.forEach((u) => { if (u.ownerId === oldId) u.ownerId = newId; });
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
        maxHp: u.maxHp,
        weight: u.weight,
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

  // ── Tug-of-war push combat ──────────────────────────────────
  //
  //  march ──► collision ──► push (weight determines direction)
  //                            │
  //            ┌───────────────┤
  //            ▼               ▼
  //     weaker loses HP   stronger advances
  //            │
  //     hp ≤ 0 → dead     reaches base → base damage
  //
  updateUnits(dt) {
    const halfLane = GAME_CONFIG.LANE_HEIGHT / 2;
    const alive = this.units.filter((u) => u.state !== 'dead');

    // Phase 1: Detect new collisions (march → push)
    for (const unit of alive) {
      if (unit.state !== 'march') continue;

      const opponent = this.findClosestOpponent(unit, alive);
      if (opponent && Math.abs(unit.z - opponent.z) < GAME_CONFIG.COLLISION_DIST) {
        unit.state = 'push';
        unit.targetId = opponent.id;
        if (opponent.state === 'march') {
          opponent.state = 'push';
          opponent.targetId = unit.id;
        }
      }
    }

    // Phase 2: March (only marching units)
    for (const unit of alive) {
      if (unit.state !== 'march') continue;

      unit.z -= unit.speed * unit.direction * dt;

      if (unit.direction === 1 && unit.z <= -halfLane) {
        this.onUnitReachedBase(unit);
      } else if (unit.direction === -1 && unit.z >= halfLane) {
        this.onUnitReachedBase(unit);
      }
    }

    // Phase 3: Resolve pushes (each pair processed once)
    const processed = new Set();

    for (const unit of alive) {
      if (unit.state !== 'push') continue;

      const target = alive.find((u) => u.id === unit.targetId);
      if (!target || target.state === 'dead') {
        unit.state = 'march';
        unit.targetId = null;
        continue;
      }

      // Process each pair once
      const pairKey = Math.min(unit.id, target.id) + ':' + Math.max(unit.id, target.id);
      if (processed.has(pairKey)) continue;
      processed.add(pairKey);

      const weightDiff = unit.weight - target.weight;
      const pushMove = Math.abs(weightDiff) * GAME_CONFIG.PUSH_SPEED * dt;

      // Push movement — stronger pushes in its march direction
      if (weightDiff > 0) {
        unit.z -= pushMove * unit.direction;
        target.z -= pushMove * unit.direction;
      } else if (weightDiff < 0) {
        unit.z -= pushMove * target.direction;
        target.z -= pushMove * target.direction;
      }
      // Equal weight: no movement (stuck)

      // Attrition damage
      if (weightDiff > 0) {
        target.hp -= weightDiff * GAME_CONFIG.PUSH_DAMAGE * dt;
      } else if (weightDiff < 0) {
        unit.hp -= Math.abs(weightDiff) * GAME_CONFIG.PUSH_DAMAGE * dt;
      } else {
        unit.hp -= GAME_CONFIG.EQUAL_PUSH_DAMAGE * dt;
        target.hp -= GAME_CONFIG.EQUAL_PUSH_DAMAGE * dt;
      }

      // Check HP deaths
      for (const u of [unit, target]) {
        if (u.hp <= 0 && u.state !== 'dead') {
          u.state = 'dead';
          alive.forEach((a) => {
            if (a.targetId === u.id) {
              a.state = 'march';
              a.targetId = null;
            }
          });
        }
      }

      // Check if pushed past own base (eliminated)
      for (const u of [unit, target]) {
        if (u.state === 'dead') continue;
        if (u.direction === 1 && u.z > halfLane + 0.5) {
          u.state = 'dead';
          u.deadTimer = 10;
        } else if (u.direction === -1 && u.z < -halfLane - 0.5) {
          u.state = 'dead';
          u.deadTimer = 10;
        }
      }

      // Check if reached enemy base while pushing
      for (const u of [unit, target]) {
        if (u.state === 'dead') continue;
        if (u.direction === 1 && u.z <= -halfLane) {
          this.onUnitReachedBase(u);
        } else if (u.direction === -1 && u.z >= halfLane) {
          this.onUnitReachedBase(u);
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
      if (other.lane !== unit.lane) continue;

      const dist = Math.abs(unit.z - other.z);
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
    const damage = GAME_CONFIG.BASE_DAMAGE[unit.tier - 1];
    const opponentId = unit.ownerId === this.p1.id ? this.p2.id : this.p1.id;
    this.playerHP[opponentId] = Math.max(0, this.playerHP[opponentId] - damage);

    unit.state = 'dead';
    unit.deadTimer = 10;
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
      weight: config.weight,
      speed: config.speed,
      state: 'march',
      targetId: null,
    };

    this.units.push(unit);
  }
}
