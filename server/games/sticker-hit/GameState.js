import { randomInt } from 'crypto';
import { STICKER_HIT_GAME_CONFIG } from '../../../shared/sticker-hit/gameConfig.js';
import {
  angularDistanceDeg,
  obstacleCenterMinGap,
  ringAppleMinSeparation,
} from '../../../shared/sticker-hit/stageLayoutInvariants.js';
import { buildExpandedStageDefinitions } from '../../../shared/sticker-hit/marathonStages.js';
import { stickerHitPersistShapeFromPlayerState } from '../../../shared/sticker-hit/stickerHitProgress.js';
import { reboundHeadingDegFromImpact, resolveThrowAgainstDisc } from '../../../shared/sticker-hit/throwResolve.js';

export const GAME_CONFIG = STICKER_HIT_GAME_CONFIG;

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
    if (out.every((a) => angularDistanceDeg(a, cand) >= minGap)) {
      out.push(cand);
    }
  }
  return out;
}

function placeRingApples(wantCount, obstacleAngles) {
  const minSep = ringAppleMinSeparation(GAME_CONFIG);
  const blocked = [...obstacleAngles];
  const out = [];
  let guard = 0;
  while (out.length < wantCount && guard < 8000) {
    guard += 1;
    const cand = secureRandomAngle();
    if (blocked.every((a) => angularDistanceDeg(a, cand) >= minSep)) {
      out.push({ id: secureRandomSeed(), angle: cand });
      blocked.push(cand);
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
  constructor(player1, player2, emitCallback, roomOptions = {}) {
    this.p1 = player1;
    this.p2 = player2;
    this.emit = emitCallback;
    /** @type {Record<string, { apples: number, ownedSkinIds: string[], equippedSkinId: string | null, bossSkinUnlocked: boolean }> | null} */
    this.stickerHitHydration = roomOptions.stickerHitHydration || null;
    this.active = false;
    this.phase = 'countdown'; // countdown | playing | finished
    this.countdownTimer = null;
    this.countdownStartedAt = 0;
    this.countdownRemainingMs = GAME_CONFIG.COUNTDOWN_MS;
    this.tickInterval = null;
    this.pausedAt = 0;
    this.endedAt = 0;

    /** @type {typeof GAME_CONFIG.STAGES} */
    this.stageDefinitions = buildExpandedStageDefinitions(GAME_CONFIG);

    this.stateByPlayer = {
      [player1.id]: this._buildInitialPlayerState(player1.id),
      [player2.id]: this._buildInitialPlayerState(player2.id),
    };
  }

  _buildInitialPlayerState(playerId) {
    const h = playerId && this.stickerHitHydration ? this.stickerHitHydration[playerId] : null;
    return {
      crashed: false,
      finished: false,
      finishedAt: 0,
      crashedAt: 0,
      stageIndex: 0,
      apples: h ? h.apples : 0,
      bossSkinUnlocked: h ? !!h.bossSkinUnlocked : false,
      /** Monotonic; client plays shatter when this increases (survives tick-only broadcasts). */
      stageBreakSeq: 0,
      /** Last throw outcome for VFX; persists across TICK broadcasts until the next throw overwrites. */
      throwFx: null,
      throwFxSeq: 0,
      ownedSkinIds: h ? [...h.ownedSkinIds] : [],
      equippedSkinId: h ? h.equippedSkinId : null,
      stage: this._createStage(0),
    };
  }

  _createStage(stageIndex) {
    const stageCfg = this.stageDefinitions[stageIndex];
    if (!stageCfg) {
      throw new Error(`Sticker Hit: invalid stageIndex ${stageIndex} (len ${this.stageDefinitions.length})`);
    }
    const minGap = obstacleCenterMinGap(GAME_CONFIG);
    const slots = (stageCfg.obstacles || 0) + (stageCfg.spikes || 0);
    const obstacleAngles = randomAngles(slots, minGap);
    const obstacleStickers = obstacleAngles.map((angle, i) => ({
      angle,
      stickerSeed: secureRandomSeed(),
      kind: i < (stageCfg.obstacles || 0) ? 'knife' : 'spike',
    }));
    const appleCount = secureRandomIntInclusive(GAME_CONFIG.APPLES_MIN, GAME_CONFIG.APPLES_MAX);
    const ringApples = placeRingApples(appleCount, obstacleAngles);
    return {
      stageIndex,
      isBoss: !!stageCfg.isBoss,
      stickersTotal: stageCfg.stickersToLand,
      stickersRemaining: stageCfg.stickersToLand,
      obstacleStickers,
      ringApples,
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
    this.stateByPlayer[this.p1.id] = this._buildInitialPlayerState(this.p1.id);
    this.stateByPlayer[this.p2.id] = this._buildInitialPlayerState(this.p2.id);
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

  /**
   * Re-key per-socket state after RoomManager assigns a new socket id on reconnect.
   * (p1/p2 player objects are the same references with updated `.id`.)
   */
  migrateReconnectSocket(oldId, newId) {
    if (!oldId || !newId || oldId === newId) return;
    const ps = this.stateByPlayer[oldId];
    if (!ps) return;
    this.stateByPlayer[newId] = ps;
    delete this.stateByPlayer[oldId];
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
    if (action.type === 'throw-sticker') {
      const maxF = GAME_CONFIG.THROW_FLIGHT_MAX_MS ?? 750;
      const defF = GAME_CONFIG.THROW_FLIGHT_MS ?? 520;
      const raw = Number(action.flightMs);
      const flightMs = Number.isFinite(raw)
        ? Math.max(0, Math.min(maxF, raw))
        : defF;
      this._throwSticker(playerId, flightMs);
      return;
    }
    if (action.type === 'sticker-buy-skin') {
      this._buySkin(playerId, action.skinId);
      return;
    }
    if (action.type === 'sticker-equip-skin') {
      this._equipSkin(playerId, action.skinId);
    }
  }

  _buySkin(playerId, skinId) {
    const ps = this.stateByPlayer[playerId];
    if (!ps || ps.crashed || ps.finished) return;
    if (typeof skinId !== 'string' || !skinId) return;
    const skin = GAME_CONFIG.SKINS.find((s) => s.id === skinId);
    if (!skin) return;
    if (ps.ownedSkinIds.includes(skinId)) {
      this.broadcastState();
      return;
    }
    if (ps.apples < skin.cost) return;
    ps.apples -= skin.cost;
    ps.ownedSkinIds.push(skinId);
    this.broadcastState();
  }

  _equipSkin(playerId, skinId) {
    const ps = this.stateByPlayer[playerId];
    if (!ps || ps.crashed || ps.finished) return;
    if (skinId === null || skinId === undefined || skinId === '') {
      ps.equippedSkinId = null;
      this.broadcastState();
      return;
    }
    if (typeof skinId !== 'string') return;
    if (skinId === 'boss_glow') {
      if (!ps.bossSkinUnlocked) return;
      ps.equippedSkinId = 'boss_glow';
      this.broadcastState();
      return;
    }
    if (!ps.ownedSkinIds.includes(skinId)) return;
    ps.equippedSkinId = skinId;
    this.broadcastState();
  }

  _throwSticker(playerId, flightMs = 0) {
    const ps = this.stateByPlayer[playerId];
    if (!ps || ps.crashed || ps.finished) return;

    const stage = ps.stage;
    const nowMs = Date.now();
    const resolved = resolveThrowAgainstDisc({
      timeline: stage.timeline,
      nowMs,
      flightMs,
      obstacleStickers: stage.obstacleStickers,
      stuckStickers: stage.stuckStickers,
      ringApples: stage.ringApples || [],
      cfg: GAME_CONFIG,
      sampleCount: GAME_CONFIG.THROW_PATH_SAMPLES,
    });

    if (resolved.crash) {
      ps.throwFxSeq += 1;
      ps.throwFx = {
        type: 'crash',
        impactAngle: resolved.impactAngle,
        seq: ps.throwFxSeq,
        reboundTangentDeg: reboundHeadingDegFromImpact(resolved.impactAngle),
      };
      ps.crashed = true;
      ps.crashedAt = Date.now();
      this.broadcastState();
      this._resolveMatchIfNeeded(playerId, 'crash');
      return;
    }

    const { impactAngle, appleIdx } = resolved;

    let appleBonus = false;
    if (appleIdx >= 0) {
      stage.ringApples.splice(appleIdx, 1);
      ps.apples += 1;
      appleBonus = true;
    }

    stage.stuckStickers.push({
      angle: impactAngle,
      stickerSeed: secureRandomSeed(),
    });
    stage.stickersRemaining = Math.max(0, stage.stickersRemaining - 1);

    ps.throwFxSeq += 1;
    ps.throwFx = { type: 'stick', impactAngle, appleBonus, seq: ps.throwFxSeq };

    if (stage.stickersRemaining === 0) {
      ps.stageBreakSeq += 1;
      const clearedBoss = !!ps.stage.isBoss;
      const nextStage = ps.stageIndex + 1;
      if (nextStage >= this.stageDefinitions.length) {
        ps.finished = true;
        ps.finishedAt = Date.now();
        if (clearedBoss) ps.bossSkinUnlocked = true;
      } else {
        if (clearedBoss) ps.bossSkinUnlocked = true;
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
    const appleBonus = (ps.apples || 0) * 3;
    return Math.max(0, base + finishBonus + appleBonus - crashPenalty);
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
      stickerHitPersist: {
        [this.p1.id]: stickerHitPersistShapeFromPlayerState(this.stateByPlayer[this.p1.id]),
        [this.p2.id]: stickerHitPersistShapeFromPlayerState(this.stateByPlayer[this.p2.id]),
      },
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
      totalStages: this.stageDefinitions.length,
      collisionDegrees: GAME_CONFIG.COLLISION_DEGREES,
      skins: GAME_CONFIG.SKINS,
      you: {
        crashed: me.crashed,
        finished: me.finished,
        stageIndex: me.stageIndex,
        apples: me.apples,
        bossSkinUnlocked: me.bossSkinUnlocked,
        stageBreakSeq: me.stageBreakSeq,
        throwFx: me.throwFx,
        throwFxSeq: me.throwFxSeq,
        ownedSkinIds: me.ownedSkinIds,
        equippedSkinId: me.equippedSkinId,
        stage: me.stage,
      },
      opponent: {
        crashed: opp.crashed,
        finished: opp.finished,
        stageIndex: opp.stageIndex,
        apples: opp.apples,
        bossSkinUnlocked: opp.bossSkinUnlocked,
        stageBreakSeq: opp.stageBreakSeq,
        equippedSkinId: opp.equippedSkinId,
        /** Ghost board: full angular layout + timeline so client can mirror their disc. */
        stage: {
          stageIndex: opp.stage.stageIndex,
          stickersTotal: opp.stage.stickersTotal,
          stickersRemaining: opp.stage.stickersRemaining,
          isBoss: opp.stage.isBoss,
          obstacleStickers: opp.stage.obstacleStickers,
          stuckStickers: opp.stage.stuckStickers,
          ringApples: opp.stage.ringApples,
          timeline: opp.stage.timeline,
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

