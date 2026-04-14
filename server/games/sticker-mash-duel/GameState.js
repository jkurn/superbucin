import { randomInt } from 'crypto';

export const GAME_CONFIG = {
  SKIP_SIDE_SELECT: true,
  COUNTDOWN_MS: 3000,
  TICK_MS: 100,
  ROUND_MS: 30_000,
  TAP_COOLDOWN_MS: 65,
  POINTS_PER_STICK: 1,
  MAX_STACKED_STICKERS: 160,
};

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
      stuckSeeds: [],
      lastFx: null,
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
    ps.tapsAccepted += 1;
    ps.score += GAME_CONFIG.POINTS_PER_STICK;
    const seed = randomInt(0, 2 ** 31);
    ps.stuckSeeds.push(seed);
    if (ps.stuckSeeds.length > GAME_CONFIG.MAX_STACKED_STICKERS) {
      ps.stuckSeeds = ps.stuckSeeds.slice(-GAME_CONFIG.MAX_STACKED_STICKERS);
    }
    ps.lastFx = { type: 'stick', stickerSeed: seed, atMs: Date.now() };
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
      roundTotalMs: GAME_CONFIG.ROUND_MS,
      you: {
        score: me.score,
        tapsAccepted: me.tapsAccepted,
        lastFx: me.lastFx,
        stuckSeeds: me.stuckSeeds,
      },
      opponent: {
        score: opp.score,
        tapsAccepted: opp.tapsAccepted,
        stuckSeeds: opp.stuckSeeds,
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
