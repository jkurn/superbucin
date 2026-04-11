import { randomInt } from 'crypto';
import { STICKER_HIT_GAME_CONFIG } from '../../../shared/sticker-hit/gameConfig.js';
import { normalizeDeg, targetRotationDeg } from '../../../shared/sticker-hit/timeline.js';

export const GAME_CONFIG = STICKER_HIT_GAME_CONFIG;

function angularDistance(a, b) {
  const diff = Math.abs(normalizeDeg(a) - normalizeDeg(b));
  return Math.min(diff, 360 - diff);
}

function secureRandomIntInclusive(min, max) {
  return randomInt(min, max + 1);
}

function secureRandomBool() {
  return randomInt(0, 2) === 0;
}

function secureRandomAngle() {
  return randomInt(0, 360_000) / 1000;
}

function secureRandomSeed() {
  return randomInt(0, 2 ** 31);
}

function randomSpeed(minDps, maxDps) {
  const sign = secureRandomBool() ? -1 : 1;
  const shouldStop = randomInt(0, 1000) < 100; // 10%
  if (shouldStop) return 0;
  return sign * secureRandomIntInclusive(minDps, maxDps);
}

function randomAngles(count, minGap) {
  if (count <= 0) return [];
  const out = [];
  let guard = 0;
  while (out.length < count && guard < 5000) {
    guard += 1;
    const cand = secureRandomAngle();
    if (out.every((a) => angularDistance(a, cand) >= minGap)) {
      out.push(cand);
    }
  }
  return out;
}

function buildTimeline(stageCfg) {
  const segments = [];
  let t = 0;
  segments.push({ atMs: 0, dps: randomSpeed(stageCfg.minDps, stageCfg.maxDps) });
  while (t < GAME_CONFIG.TIMELINE_WINDOW_MS) {
    const delta = secureRandomIntInclusive(GAME_CONFIG.MIN_SEGMENT_MS, GAME_CONFIG.MAX_SEGMENT_MS);
    t += delta;
    segments.push({ atMs: t, dps: randomSpeed(stageCfg.minDps, stageCfg.maxDps) });
  }
  return {
    startedAt: Date.now(),
    initialAngle: secureRandomAngle(),
    segments,
  };
}

export class GameState {
  constructor(player1, player2, emitCallback, _roomOptions = {}) {
    this.p1 = player1;
    this.p2 = player2;
    this.emit = emitCallback;
    this.active = false;
    this.phase = 'countdown'; // countdown | playing | finished
    this.countdownTimer = null;
    this.countdownStartedAt = 0;
    this.countdownRemainingMs = GAME_CONFIG.COUNTDOWN_MS;
    this.tickInterval = null;
    this.pausedAt = 0;
    this.endedAt = 0;

    this.stateByPlayer = {
      [player1.id]: this._buildInitialPlayerState(),
      [player2.id]: this._buildInitialPlayerState(),
    };
  }

  _buildInitialPlayerState() {
    return {
      crashed: false,
      finished: false,
      finishedAt: 0,
      crashedAt: 0,
      stageIndex: 0,
      stage: this._createStage(0),
    };
  }

  _createStage(stageIndex) {
    const stageCfg = GAME_CONFIG.STAGES[stageIndex];
    const minGap = GAME_CONFIG.COLLISION_DEGREES + 4;
    const obstacleAngles = randomAngles(stageCfg.obstacles, minGap);
    return {
      stageIndex,
      stickersTotal: stageCfg.stickersToLand,
      stickersRemaining: stageCfg.stickersToLand,
      obstacleStickers: obstacleAngles.map((angle) => ({
        angle,
        stickerSeed: secureRandomSeed(),
      })),
      stuckStickers: [],
      timeline: buildTimeline(stageCfg),
    };
  }

  start() {
    this.active = true;
    this.phase = 'countdown';
    this.endedAt = 0;
    this.pausedAt = 0;
    this.countdownRemainingMs = GAME_CONFIG.COUNTDOWN_MS;
    this.stateByPlayer[this.p1.id] = this._buildInitialPlayerState();
    this.stateByPlayer[this.p2.id] = this._buildInitialPlayerState();
    this._clearTimers();
    this._startCountdown();
    this.broadcastState();
  }

  stop() {
    this.active = false;
    this._clearTimers();
  }

  pause() {
    if (!this.active || this.pausedAt) return;
    this.pausedAt = Date.now();
    if (this.phase === 'countdown') {
      const elapsed = this.pausedAt - this.countdownStartedAt;
      this.countdownRemainingMs = Math.max(0, this.countdownRemainingMs - elapsed);
    }
    this._clearTimers();
  }

  resume() {
    if (!this.active || !this.pausedAt) return;
    const pausedFor = Date.now() - this.pausedAt;
    this.pausedAt = 0;

    if (this.phase === 'countdown') {
      this._startCountdown();
      this.broadcastState();
      return;
    }

    if (this.phase === 'playing') {
      [this.p1.id, this.p2.id].forEach((playerId) => {
        const ps = this.stateByPlayer[playerId];
        if (ps?.stage?.timeline) {
          ps.stage.timeline.startedAt += pausedFor;
        }
      });
      this._startTickLoop();
      this.broadcastState();
    }
  }

  _startCountdown() {
    this.countdownStartedAt = Date.now();
    this.countdownTimer = setTimeout(() => {
      this.countdownTimer = null;
      this.phase = 'playing';
      this._startTickLoop();
      this.broadcastState();
    }, this.countdownRemainingMs);
  }

  _startTickLoop() {
    if (this.tickInterval) clearInterval(this.tickInterval);
    this.tickInterval = setInterval(() => {
      this.broadcastState();
    }, GAME_CONFIG.TICK_MS);
  }

  _clearTimers() {
    if (this.countdownTimer) {
      clearTimeout(this.countdownTimer);
      this.countdownTimer = null;
    }
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
  }

  handleAction(playerId, action) {
    if (!this.active || this.phase !== 'playing') return;
    if (!action || typeof action !== 'object') return;
    if (action.type !== 'throw-sticker') return;
    const flightMs = Number.isFinite(action.flightMs) ? Math.max(0, Math.min(700, action.flightMs)) : 0;
    this._throwSticker(playerId, flightMs);
  }

  _throwSticker(playerId, flightMs = 0) {
    const ps = this.stateByPlayer[playerId];
    if (!ps || ps.crashed || ps.finished) return;

    const stage = ps.stage;
    const rotation = targetRotationDeg(stage.timeline, Date.now() + flightMs);
    const impactAngle = normalizeDeg(270 - rotation);
    const occupied = [
      ...stage.obstacleStickers.map((x) => x.angle),
      ...stage.stuckStickers.map((x) => x.angle),
    ];
    const collides = occupied.some((a) => angularDistance(a, impactAngle) < GAME_CONFIG.COLLISION_DEGREES);

    if (collides) {
      ps.crashed = true;
      ps.crashedAt = Date.now();
      this.broadcastState();
      this._resolveMatchIfNeeded(playerId, 'crash');
      return;
    }

    stage.stuckStickers.push({
      angle: impactAngle,
      stickerSeed: secureRandomSeed(),
    });
    stage.stickersRemaining = Math.max(0, stage.stickersRemaining - 1);

    if (stage.stickersRemaining === 0) {
      const nextStage = ps.stageIndex + 1;
      if (nextStage >= GAME_CONFIG.STAGES.length) {
        ps.finished = true;
        ps.finishedAt = Date.now();
      } else {
        ps.stageIndex = nextStage;
        ps.stage = this._createStage(nextStage);
      }
    }

    this.broadcastState();
    this._resolveMatchIfNeeded(playerId, 'progress');
  }

  _resolveMatchIfNeeded(actorId, reason) {
    const actor = this.stateByPlayer[actorId];
    const otherId = actorId === this.p1.id ? this.p2.id : this.p1.id;
    const other = this.stateByPlayer[otherId];

    if (reason === 'crash') {
      if (other.crashed) {
        this._finishMatch(null, true);
      } else {
        this._finishMatch(otherId, false);
      }
      return;
    }

    if (actor.finished && !other.finished) {
      this._finishMatch(actorId, false);
      return;
    }

    if (actor.finished && other.finished) {
      const delta = Math.abs(actor.finishedAt - other.finishedAt);
      if (delta <= 40) {
        this._finishMatch(null, true);
        return;
      }
      this._finishMatch(actor.finishedAt < other.finishedAt ? actorId : otherId, false);
    }
  }

  _scoreFor(playerId) {
    const ps = this.stateByPlayer[playerId];
    if (!ps) return 0;
    const stageProgress = ps.stage.stickersTotal - ps.stage.stickersRemaining;
    const base = ps.stageIndex * 100 + stageProgress * 10;
    const finishBonus = ps.finished ? 250 : 0;
    const crashPenalty = ps.crashed ? 15 : 0;
    return Math.max(0, base + finishBonus - crashPenalty);
  }

  _finishMatch(winnerId, tie) {
    if (!this.active) return;
    this.active = false;
    this.phase = 'finished';
    this.endedAt = Date.now();
    this._clearTimers();
    this.emit('match-end', {
      winnerId,
      tie: !!tie,
      scores: [this._scoreFor(this.p1.id), this._scoreFor(this.p2.id)],
    });
  }

  _buildView(playerId) {
    const opponentId = playerId === this.p1.id ? this.p2.id : this.p1.id;
    const me = this.stateByPlayer[playerId];
    const opp = this.stateByPlayer[opponentId];
    const countdownMsRemaining = this.phase === 'countdown'
      ? Math.max(0, this.countdownRemainingMs - (Date.now() - this.countdownStartedAt))
      : 0;

    return {
      gameType: 'sticker-hit',
      phase: this.phase,
      serverNow: Date.now(),
      countdownMsRemaining,
      totalStages: GAME_CONFIG.STAGES.length,
      collisionDegrees: GAME_CONFIG.COLLISION_DEGREES,
      you: {
        crashed: me.crashed,
        finished: me.finished,
        stageIndex: me.stageIndex,
        stage: me.stage,
      },
      opponent: {
        crashed: opp.crashed,
        finished: opp.finished,
        stageIndex: opp.stageIndex,
        stage: {
          stageIndex: opp.stage.stageIndex,
          stickersTotal: opp.stage.stickersTotal,
          stickersRemaining: opp.stage.stickersRemaining,
        },
      },
    };
  }

  broadcastState() {
    this.emit('sticker-hit-state', {
      byPlayer: {
        [this.p1.id]: this._buildView(this.p1.id),
        [this.p2.id]: this._buildView(this.p2.id),
      },
    });
  }
}

