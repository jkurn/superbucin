import { randomInt } from 'crypto';
import { STICKER_HIT_GAME_CONFIG } from '../../../shared/sticker-hit/gameConfig.js';
import { resolveThrowAgainstDisc } from '../../../shared/sticker-hit/throwResolve.js';
import { angularDistanceDeg, obstacleCenterMinGap } from '../../../shared/sticker-hit/stageLayoutInvariants.js';

export const GAME_CONFIG = {
  SKIP_SIDE_SELECT: true,
  COUNTDOWN_MS: STICKER_HIT_GAME_CONFIG.COUNTDOWN_MS,
  TICK_MS: STICKER_HIT_GAME_CONFIG.TICK_MS,
  ROUND_MS: 45_000,
  TAP_COOLDOWN_MS: 65,
  CRASH_STUN_MS: 500,
  POINTS_PER_STICK: 1,
  POINTS_PER_CRASH: -2,
  OBSTACLE_COUNT: 5,
  THROW_FLIGHT_MS: STICKER_HIT_GAME_CONFIG.THROW_FLIGHT_MS,
  THROW_PATH_SAMPLES: STICKER_HIT_GAME_CONFIG.THROW_PATH_SAMPLES,
  COLLISION_DEGREES: STICKER_HIT_GAME_CONFIG.COLLISION_DEGREES,
  SPIKE_EXTRA_DEGREES: STICKER_HIT_GAME_CONFIG.SPIKE_EXTRA_DEGREES,
  THROW_CHECK_PATH_COLLISION: STICKER_HIT_GAME_CONFIG.THROW_CHECK_PATH_COLLISION,
};

function secureRandomBool() {
  return randomInt(0, 2) === 0;
}

function secureRandomIntInclusive(min, max) {
  return randomInt(min, max + 1);
}

function secureRandomAngle() {
  return randomInt(0, 360_000) / 1000;
}

function randomSpeed(minDps, maxDps) {
  const sign = secureRandomBool() ? -1 : 1;
  return sign * secureRandomIntInclusive(minDps, maxDps);
}

function buildTimeline() {
  const stage = STICKER_HIT_GAME_CONFIG.STAGES[0];
  const segments = [{ atMs: 0, dps: randomSpeed(stage.minDps, stage.maxDps) }];
  let t = 0;
  while (t < STICKER_HIT_GAME_CONFIG.TIMELINE_WINDOW_MS) {
    t += secureRandomIntInclusive(
      STICKER_HIT_GAME_CONFIG.MIN_SEGMENT_MS,
      STICKER_HIT_GAME_CONFIG.MAX_SEGMENT_MS,
    );
    segments.push({ atMs: t, dps: randomSpeed(stage.minDps, stage.maxDps) });
  }
  return {
    startedAt: Date.now(),
    initialAngle: secureRandomAngle(),
    segments,
  };
}

function makeObstacleStickers() {
  const out = [];
  const minGap = obstacleCenterMinGap(STICKER_HIT_GAME_CONFIG);
  let guard = 0;
  while (out.length < GAME_CONFIG.OBSTACLE_COUNT && guard < 8_000) {
    guard += 1;
    const cand = secureRandomAngle();
    if (out.every((x) => angularDistanceDeg(x.angle, cand) >= minGap)) {
      out.push({
        angle: cand,
        stickerSeed: randomInt(0, 2 ** 31),
        kind: 'knife',
      });
    }
  }
  if (out.length < GAME_CONFIG.OBSTACLE_COUNT) {
    // Fallback keeps game playable under pathological random draws.
    for (let i = out.length; i < GAME_CONFIG.OBSTACLE_COUNT; i += 1) {
      out.push({
        angle: (360 / GAME_CONFIG.OBSTACLE_COUNT) * i,
        stickerSeed: randomInt(0, 2 ** 31),
        kind: 'knife',
      });
    }
  }
  return out;
}

export class GameState {
  constructor(player1, player2, emitCallback, _roomOptions = {}) {
    this.p1 = player1;
    this.p2 = player2;
    this.emit = emitCallback;

    this.active = false;
    this.phase = 'countdown';
    this.countdownTimer = null;
    this.tickInterval = null;
    this.countdownStartedAt = 0;
    this.countdownRemainingMs = GAME_CONFIG.COUNTDOWN_MS;
    this.roundEndsAtMs = 0;
    this.pausedAt = 0;
    this.nextTapAtByPlayer = { [player1.id]: 0, [player2.id]: 0 };

    this.stateByPlayer = {};
  }

  _buildInitialPlayerState() {
    return {
      score: 0,
      tapsAccepted: 0,
      crashCount: 0,
      lastFx: null,
      stage: {
        stickersTotal: Infinity,
        stickersRemaining: Infinity,
        timeline: buildTimeline(),
        obstacleStickers: makeObstacleStickers(),
        stuckStickers: [],
        ringApples: [],
      },
    };
  }

  start() {
    this.active = true;
    this.phase = 'countdown';
    this.countdownRemainingMs = GAME_CONFIG.COUNTDOWN_MS;
    this.countdownStartedAt = Date.now();
    this.roundEndsAtMs = 0;
    this.pausedAt = 0;
    this.nextTapAtByPlayer[this.p1.id] = 0;
    this.nextTapAtByPlayer[this.p2.id] = 0;
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
      this.roundEndsAtMs += pausedFor;
      this.stateByPlayer[this.p1.id].stage.timeline.startedAt += pausedFor;
      this.stateByPlayer[this.p2.id].stage.timeline.startedAt += pausedFor;
      this._startTickLoop();
      this.broadcastState();
    }
  }

  migrateReconnectSocket(oldId, newId) {
    if (!oldId || !newId || oldId === newId) return;
    const ps = this.stateByPlayer[oldId];
    if (!ps) return;
    this.stateByPlayer[newId] = ps;
    delete this.stateByPlayer[oldId];
    this.nextTapAtByPlayer[newId] = this.nextTapAtByPlayer[oldId] || 0;
    delete this.nextTapAtByPlayer[oldId];
  }

  _startCountdown() {
    this.countdownStartedAt = Date.now();
    this.countdownTimer = setTimeout(() => {
      this.countdownTimer = null;
      this.phase = 'playing';
      this.roundEndsAtMs = Date.now() + GAME_CONFIG.ROUND_MS;
      this._emitTelemetry('round_started', { roundMs: GAME_CONFIG.ROUND_MS });
      this._startTickLoop();
      this.broadcastState();
    }, this.countdownRemainingMs);
  }

  _startTickLoop() {
    if (this.tickInterval) clearInterval(this.tickInterval);
    this.tickInterval = setInterval(() => {
      if (Date.now() >= this.roundEndsAtMs) {
        this._finishMatch();
        return;
      }
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
    if (!action || typeof action !== 'object' || action.type !== 'mash-tap') return;
    const ps = this.stateByPlayer[playerId];
    if (!ps) return;
    const now = Date.now();
    if (now < (this.nextTapAtByPlayer[playerId] || 0)) {
      this._emitTelemetry('tap_dropped_cooldown', { playerId });
      return;
    }
    this.nextTapAtByPlayer[playerId] = now + GAME_CONFIG.TAP_COOLDOWN_MS;
    this._resolveTap(playerId);
    this.broadcastState();
  }

  _resolveTap(playerId) {
    const ps = this.stateByPlayer[playerId];
    const stage = ps.stage;
    const resolved = resolveThrowAgainstDisc({
      timeline: stage.timeline,
      nowMs: Date.now(),
      flightMs: GAME_CONFIG.THROW_FLIGHT_MS,
      obstacleStickers: stage.obstacleStickers,
      stuckStickers: stage.stuckStickers,
      ringApples: stage.ringApples,
      cfg: GAME_CONFIG,
      sampleCount: GAME_CONFIG.THROW_PATH_SAMPLES,
    });

    if (resolved.crash) {
      ps.crashCount += 1;
      ps.score = Math.max(0, ps.score + GAME_CONFIG.POINTS_PER_CRASH);
      ps.lastFx = { type: 'crash', impactAngle: resolved.impactAngle, atMs: Date.now() };
      stage.stuckStickers = [];
      this.nextTapAtByPlayer[playerId] = Date.now() + GAME_CONFIG.CRASH_STUN_MS;
      this._emitTelemetry('tap_crash_penalty', {
        playerId,
        score: ps.score,
        crashCount: ps.crashCount,
      });
      return;
    }

    ps.tapsAccepted += 1;
    ps.score += GAME_CONFIG.POINTS_PER_STICK;
    stage.stuckStickers.push({
      angle: resolved.impactAngle,
      stickerSeed: randomInt(0, 2 ** 31),
    });
    ps.lastFx = { type: 'stick', impactAngle: resolved.impactAngle, atMs: Date.now() };
  }

  _emitTelemetry(kind, data = {}) {
    this.emit('sticker-mash-duel-metric', {
      kind,
      atMs: Date.now(),
      ...data,
    });
  }

  _buildView(playerId) {
    const opponentId = playerId === this.p1.id ? this.p2.id : this.p1.id;
    const me = this.stateByPlayer[playerId];
    const opp = this.stateByPlayer[opponentId];
    const now = Date.now();
    const countdownMsRemaining = this.phase === 'countdown'
      ? Math.max(0, this.countdownRemainingMs - (now - this.countdownStartedAt))
      : 0;
    const roundMsRemaining = this.phase === 'playing'
      ? Math.max(0, this.roundEndsAtMs - now)
      : 0;
    return {
      gameType: 'sticker-mash-duel',
      phase: this.phase,
      serverNow: now,
      countdownMsRemaining,
      roundMsRemaining,
      you: {
        score: me.score,
        tapsAccepted: me.tapsAccepted,
        crashCount: me.crashCount,
        lastFx: me.lastFx,
        stage: me.stage,
      },
      opponent: {
        score: opp.score,
        tapsAccepted: opp.tapsAccepted,
        crashCount: opp.crashCount,
        stage: opp.stage,
      },
    };
  }

  _finishMatch() {
    if (!this.active) return;
    this.active = false;
    this.phase = 'finished';
    this._clearTimers();
    const p1Score = this.stateByPlayer[this.p1.id]?.score || 0;
    const p2Score = this.stateByPlayer[this.p2.id]?.score || 0;
    let winnerId = null;
    let tie = false;
    if (p1Score === p2Score) {
      tie = true;
    } else {
      winnerId = p1Score > p2Score ? this.p1.id : this.p2.id;
    }
    this.emit('match-end', {
      winnerId,
      tie,
      scores: [p1Score, p2Score],
    });
    this._emitTelemetry('round_finished', { winnerId, tie, p1Score, p2Score });
  }

  broadcastState() {
    this.emit('sticker-mash-duel-state', {
      byPlayer: {
        [this.p1.id]: this._buildView(this.p1.id),
        [this.p2.id]: this._buildView(this.p2.id),
      },
    });
  }
}
