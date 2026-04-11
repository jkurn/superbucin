/**
 * Sticker Hit — acceptance criteria (client HUD / scene).
 *
 * Passing tests document current UI contracts for partial requirements.
 * Skipped describes are backlog acceptance tests.
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { EventBus } from '../../shared/EventBus.js';
import { resolveThrowAgainstDisc } from '../../../../shared/sticker-hit/throwResolve.js';
import { STICKER_HIT_GAME_CONFIG } from '../../../../shared/sticker-hit/gameConfig.js';
import { normalizeDeg, targetRotationDeg } from '../../../../shared/sticker-hit/timeline.js';
import { stickerHitGame } from './index.js';
import { StickerHitScene } from './StickerHitScene.js';

const nodePerformance = globalThis.performance;

function installDom() {
  const dom = new JSDOM('<!DOCTYPE html><html><body><div id="ui-overlay"></div></body></html>', {
    url: 'http://localhost:5173/',
  });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.localStorage = dom.window.localStorage;
  globalThis.performance = { now: () => Date.now() };
  globalThis.requestAnimationFrame = () => 0;
  globalThis.cancelAnimationFrame = () => {};
}

function makeSceneManager() {
  const canvas = document.createElement('canvas');
  return {
    renderer: { domElement: canvas },
    setScene: () => {},
    onUpdate: null,
  };
}

function baseState(overrides = {}) {
  return {
    gameType: 'sticker-hit',
    phase: 'playing',
    serverNow: Date.now(),
    totalStages: 5,
    skins: [{ id: 'trail_pink', cost: 3, label: 'Pink' }],
    you: {
      crashed: false,
      finished: false,
      stageIndex: 0,
      apples: 0,
      bossSkinUnlocked: false,
      stageBreakSeq: 0,
      throwFx: null,
      throwFxSeq: 0,
      ownedSkinIds: [],
      equippedSkinId: null,
      stage: {
        stageIndex: 0,
        isBoss: false,
        stickersTotal: 6,
        stickersRemaining: 6,
        obstacleStickers: [],
        ringApples: [],
        stuckStickers: [],
        timeline: { startedAt: Date.now(), initialAngle: 0, segments: [{ atMs: 0, dps: 0 }] },
      },
    },
    opponent: {
      crashed: false,
      finished: false,
      stageIndex: 0,
      apples: 0,
      bossSkinUnlocked: false,
      stageBreakSeq: 0,
      equippedSkinId: null,
      stage: {
        stageIndex: 0,
        stickersTotal: 6,
        stickersRemaining: 6,
        isBoss: false,
        obstacleStickers: [],
        stuckStickers: [],
        ringApples: [],
        timeline: { startedAt: Date.now(), initialAngle: 0, segments: [{ atMs: 0, dps: 0 }] },
      },
    },
    ...overrides,
  };
}

describe('Sticker Hit acceptance — HUD (partial / Done)', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    installDom();
    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({ stickers: [{ src: '/stickers/t.webp', durationMs: 400 }] }),
    });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    EventBus.clear();
    delete globalThis.window;
    delete globalThis.document;
    delete globalThis.localStorage;
    globalThis.performance = nodePerformance;
    delete globalThis.requestAnimationFrame;
    delete globalThis.cancelAnimationFrame;
  });

  it('AC US06 (partial): ammo rail renders one dot per stickersTotal; spent dots match throws used', async () => {
    const scene = new StickerHitScene(makeSceneManager(), { sendGameAction: () => {} }, null, {});
    scene.init();
    scene.applyState(baseState({
      you: {
        ...baseState().you,
        stage: {
          ...baseState().you.stage,
          stickersTotal: 8,
          stickersRemaining: 5,
        },
      },
    }));
    await new Promise((r) => setTimeout(r, 0));

    const dots = scene.rootEl.querySelectorAll('#sh-ammo .sh-ammo-dot');
    assert.equal(dots.length, 8);
    let spent = 0;
    dots.forEach((d) => {
      if (d.dataset.spent === 'true') spent += 1;
    });
    assert.equal(spent, 3);
    scene.destroy();
  });

  it('AC US07 (partial): stage pip count matches totalStages from state', async () => {
    const scene = new StickerHitScene(makeSceneManager(), { sendGameAction: () => {} }, null, {});
    scene.init();
    scene.applyState(baseState({ totalStages: 5 }));
    await new Promise((r) => setTimeout(r, 0));

    const pips = scene.rootEl.querySelectorAll('#sh-stage-pips .sh-stage-pip');
    assert.equal(pips.length, 5);
    scene.destroy();
  });

  it('AC US07: boss label when current stage is boss', async () => {
    const scene = new StickerHitScene(makeSceneManager(), { sendGameAction: () => {} }, null, {});
    scene.init();
    scene.applyState(baseState({
      you: {
        ...baseState().you,
        stageIndex: 4,
        stage: {
          ...baseState().you.stage,
          stageIndex: 4,
          isBoss: true,
        },
      },
    }));
    await new Promise((r) => setTimeout(r, 0));

    const label = document.getElementById('sh-stage-label');
    assert.ok(label.textContent.includes('BOSS'));
    scene.destroy();
  });

  it('createHUD: lobby column updates stage and apple pills from sticker-hit:state', async () => {
    const overlay = document.getElementById('ui-overlay');
    const hud = stickerHitGame.createHUD(overlay, {}, {});
    EventBus.emit('sticker-hit:state', {
      totalStages: 5,
      phase: 'playing',
      you: { stageIndex: 1, apples: 7, crashed: false, finished: false },
      opponent: { stageIndex: 0, apples: 2, crashed: false, finished: false },
    });
    await new Promise((r) => setTimeout(r, 0));
    assert.equal(document.getElementById('sh-hud-you').textContent, '2/5');
    assert.equal(document.getElementById('sh-hud-opp').textContent, '1/5');
    assert.equal(document.getElementById('sh-hud-apple-you').textContent, '7');
    assert.equal(document.getElementById('sh-hud-apple-opp').textContent, '2');
    hud.destroy();
  });

  it('AC US07: marathon-length ladder marks boss pips on indices 4 and 9 (0-based)', async () => {
    const scene = new StickerHitScene(makeSceneManager(), { sendGameAction: () => {} }, null, {});
    scene.init();
    scene.applyState(baseState({ totalStages: 10, you: { ...baseState().you, stageIndex: 3 } }));
    await new Promise((r) => setTimeout(r, 0));
    const pips = scene.rootEl.querySelectorAll('#sh-stage-pips .sh-stage-pip');
    assert.equal(pips.length, 10);
    assert.equal(pips[4].dataset.boss, 'true');
    assert.equal(pips[9].dataset.boss, 'true');
    assert.equal(pips[0].dataset.boss, 'false');
    scene.destroy();
  });
});

describe('Sticker Hit acceptance — US01 client/server resolver parity (Done)', () => {
  it('client throw preview uses same multi-sample resolver as server (not final-only)', () => {
    const nowMs = 3000;
    const timeline = {
      startedAt: nowMs,
      initialAngle: 0,
      segments: [{ atMs: 0, dps: 360 }],
    };
    const flightMs = 1000;
    const legacyFinal = normalizeDeg(270 - targetRotationDeg(timeline, nowMs + flightMs));
    const resolved = resolveThrowAgainstDisc({
      timeline,
      nowMs,
      flightMs,
      obstacleStickers: [{ angle: 180, kind: 'knife' }],
      stuckStickers: [],
      ringApples: [],
      cfg: STICKER_HIT_GAME_CONFIG,
      sampleCount: STICKER_HIT_GAME_CONFIG.THROW_PATH_SAMPLES,
    });
    assert.equal(legacyFinal, 270);
    assert.equal(resolved.crash, true);
    assert.equal(resolved.impactAngle, 180);
  });
});
