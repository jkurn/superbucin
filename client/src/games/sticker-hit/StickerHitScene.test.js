import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { GAME_CONFIG } from './config.js';
import { StickerHitScene } from './StickerHitScene.js';

const nodePerformance = globalThis.performance;

function installDom() {
  const dom = new JSDOM('<!DOCTYPE html><html><body><div id="ui-overlay"></div></body></html>', {
    url: 'http://localhost:5173/',
  });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.localStorage = dom.window.localStorage;
  /** Avoid assigning `globalThis.performance = dom.window.performance` (recursive .now() in jsdom). */
  const perfShim = { now: () => Date.now() };
  globalThis.performance = perfShim;
  globalThis.requestAnimationFrame = () => 0;
  globalThis.cancelAnimationFrame = () => {};
}

describe('StickerHitScene input contracts', () => {
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
    delete globalThis.window;
    delete globalThis.document;
    delete globalThis.localStorage;
    globalThis.performance = nodePerformance;
    delete globalThis.requestAnimationFrame;
    delete globalThis.cancelAnimationFrame;
  });

  function makeSceneManager() {
    const canvas = document.createElement('canvas');
    return {
      renderer: { domElement: canvas },
      setScene: () => {},
      onUpdate: null,
    };
  }

  function playingState() {
    return {
      gameType: 'sticker-hit',
      phase: 'playing',
      totalStages: 5,
      skins: [{ id: 'trail_pink', cost: 3, label: 'Pink' }],
      you: {
        crashed: false,
        finished: false,
        stageIndex: 0,
        apples: 10,
        bossSkinUnlocked: true,
        stageBreakSeq: 0,
        throwFx: null,
        throwFxSeq: 0,
        ownedSkinIds: ['trail_pink'],
        equippedSkinId: 'trail_pink',
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
    };
  }

  it('click on throw button sends throw-sticker with flightMs', async () => {
    const actions = [];
    const network = { sendGameAction: (a) => actions.push(a) };
    const scene = new StickerHitScene(makeSceneManager(), network, null, {});
    scene.init();
    scene.applyState(playingState());
    await new Promise((r) => setTimeout(r, 0));

    const btn = document.getElementById('sh-throw-btn');
    assert.ok(btn);
    btn.click();
    assert.equal(actions.length, 1);
    assert.equal(actions[0].type, 'throw-sticker');
    assert.equal(actions[0].flightMs, GAME_CONFIG.THROW_FLIGHT_MS);
    scene.destroy();
  });

  it('store list buy dispatches sticker-buy-skin', async () => {
    const actions = [];
    const network = { sendGameAction: (a) => actions.push(a) };
    const scene = new StickerHitScene(makeSceneManager(), network, null, {});
    scene.init();
    scene.applyState({
      ...playingState(),
      you: {
        ...playingState().you,
        ownedSkinIds: [],
        apples: 10,
      },
    });
    await new Promise((r) => setTimeout(r, 0));

    document.getElementById('sh-store-btn')?.click();
    const buy = document.querySelector('[data-skin-buy="trail_pink"]');
    assert.ok(buy);
    buy.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    assert.ok(actions.some((a) => a.type === 'sticker-buy-skin' && a.skinId === 'trail_pink'));
    scene.destroy();
  });

  it('equip none sends null skinId', async () => {
    const actions = [];
    const network = { sendGameAction: (a) => actions.push(a) };
    const scene = new StickerHitScene(makeSceneManager(), network, null, {});
    scene.init();
    scene.applyState(playingState());
    await new Promise((r) => setTimeout(r, 0));

    document.getElementById('sh-store-btn')?.click();
    document.getElementById('sh-equip-none')?.click();
    assert.ok(actions.some((a) => a.type === 'sticker-equip-skin' && a.skinId === null));
    scene.destroy();
  });

  it('boss glow button sends boss_glow equip', async () => {
    const actions = [];
    const network = { sendGameAction: (a) => actions.push(a) };
    const scene = new StickerHitScene(makeSceneManager(), network, null, {});
    scene.init();
    scene.applyState(playingState());
    await new Promise((r) => setTimeout(r, 0));

    document.getElementById('sh-store-btn')?.click();
    document.getElementById('sh-equip-boss')?.click();
    assert.ok(actions.some((a) => a.type === 'sticker-equip-skin' && a.skinId === 'boss_glow'));
    scene.destroy();
  });
});
