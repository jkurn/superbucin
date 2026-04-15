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

function installDom(url = 'http://localhost:5173/') {
  const dom = new JSDOM('<!DOCTYPE html><html><body><div id="ui-overlay"></div></body></html>', {
    url,
  });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.localStorage = dom.window.localStorage;
  globalThis.sessionStorage = dom.window.sessionStorage;
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
    try { globalThis.sessionStorage?.removeItem?.('stickerHitKnifeFocus'); } catch (_e) { /* noop */ }
    delete globalThis.window;
    delete globalThis.document;
    delete globalThis.localStorage;
    delete globalThis.sessionStorage;
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

  // Regression for QA ISSUE-002: stage pips used cross-origin Kenney PNGs
  // that ORB-blocked in dev. Pips must now style themselves purely via CSS
  // data attributes — no inline backgroundImage URL leaking from JS.
  it('AC US07 (regression): stage pips never set inline backgroundImage to a Kenney URL', async () => {
    const scene = new StickerHitScene(makeSceneManager(), { sendGameAction: () => {} }, null, {});
    scene.init();
    scene.applyState(baseState({
      totalStages: 5,
      you: { ...baseState().you, stageIndex: 2 },
    }));
    await new Promise((r) => setTimeout(r, 0));
    const pips = scene.rootEl.querySelectorAll('#sh-stage-pips .sh-stage-pip');
    assert.equal(pips.length, 5);
    pips.forEach((pip, i) => {
      // Inline style.backgroundImage must be empty — pip visuals come from CSS.
      assert.equal(pip.style.backgroundImage, '', `pip[${i}] should have no inline backgroundImage`);
      // Data attributes drive CSS — sanity check.
      assert.ok(['true', 'false'].includes(pip.dataset.active));
      assert.ok(['true', 'false'].includes(pip.dataset.boss));
    });
    scene.destroy();
  });
});

describe('Sticker Hit acceptance — knife focus (?knifeFocus=1)', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    installDom('http://localhost:5173/room/TEST?knifeFocus=1');
    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({ stickers: [{ src: '/stickers/t.webp', durationMs: 400 }] }),
    });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    EventBus.clear();
    try { globalThis.sessionStorage?.removeItem?.('stickerHitKnifeFocus'); } catch (_e) { /* noop */ }
    delete globalThis.window;
    delete globalThis.document;
    delete globalThis.localStorage;
    delete globalThis.sessionStorage;
    globalThis.performance = nodePerformance;
    delete globalThis.requestAnimationFrame;
    delete globalThis.cancelAnimationFrame;
  });

  it('createHUD sets data-knife-focus on .sh-hud for reduced top chrome', () => {
    const overlay = document.getElementById('ui-overlay');
    const api = stickerHitGame.createHUD(overlay, {}, {});
    const hudEl = overlay.querySelector('.sh-hud');
    assert.equal(hudEl?.getAttribute('data-knife-focus'), 'true');
    api.destroy();
  });

  it('StickerHitScene sets data-knife-focus and throw still dispatches', async () => {
    const actions = [];
    const scene = new StickerHitScene(makeSceneManager(), { sendGameAction: (a) => actions.push(a) }, null, {});
    scene.init();
    assert.equal(scene.knifeFocus, true);
    assert.equal(scene.rootEl.getAttribute('data-knife-focus'), 'true');
    assert.ok(scene.rootEl.querySelector('.sh-side'));
    scene.applyState(baseState());
    await new Promise((r) => setTimeout(r, 0));
    document.getElementById('sh-throw-btn')?.click();
    assert.equal(actions.length, 1);
    assert.equal(actions[0].type, 'throw-sticker');
    scene.destroy();
  });

  // Regression for QA ISSUE-001: Router strips `?knifeFocus=1` when navigating
  // from `/?knifeFocus=1` → `/room/{code}`. The flag must persist via
  // sessionStorage so the scene mounted on the room URL still gets the
  // reduced-chrome layout.
  it('knifeFocus persists across `/` → `/room/{code}` navigation (sessionStorage)', async () => {
    // 1. First scene mounts on `/?knifeFocus=1` (this beforeEach already loads
    //    that URL). Confirm data-knife-focus is set + cache is populated.
    const sceneOnLobby = new StickerHitScene(makeSceneManager(), { sendGameAction: () => {} }, null, {});
    sceneOnLobby.init();
    assert.equal(sceneOnLobby.knifeFocus, true);
    assert.equal(globalThis.sessionStorage.getItem('stickerHitKnifeFocus'), '1');
    sceneOnLobby.destroy();

    // 2. Simulate navigation: tear down + reinstall DOM at the room URL with
    //    NO query string (Router strips it). sessionStorage carries over in a
    //    real tab — emulate that by re-using the same key.
    const cachedFlag = globalThis.sessionStorage.getItem('stickerHitKnifeFocus');
    delete globalThis.window;
    delete globalThis.document;
    delete globalThis.localStorage;
    delete globalThis.sessionStorage;
    installDom('http://localhost:5173/room/ABCD'); // no ?knifeFocus
    globalThis.sessionStorage.setItem('stickerHitKnifeFocus', cachedFlag);

    // 3. New scene on the room URL must still detect knifeFocus from the cache.
    const sceneOnRoom = new StickerHitScene(makeSceneManager(), { sendGameAction: () => {} }, null, {});
    sceneOnRoom.init();
    assert.equal(sceneOnRoom.knifeFocus, true, 'knifeFocus should survive Router-stripped query');
    assert.equal(sceneOnRoom.rootEl.getAttribute('data-knife-focus'), 'true');
    sceneOnRoom.destroy();
  });
});

describe('Sticker Hit acceptance — US01 knife-hit throw (Done)', () => {
  it('resolver matches landing-only default (clear slot at throw = stick)', () => {
    const nowMs = 3000;
    const timeline = {
      startedAt: nowMs,
      initialAngle: 0,
      segments: [{ atMs: 0, dps: 360 }],
    };
    const flightMs = 1000;
    const finalImpact = normalizeDeg(270 - targetRotationDeg(timeline, nowMs + flightMs));
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
    assert.equal(finalImpact, 270);
    assert.equal(resolved.crash, false);
    assert.equal(resolved.impactAngle, 270);
  });
});
