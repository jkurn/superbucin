import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { StickerMashDuelScene } from './StickerMashDuelScene.js';

function installDom() {
  const dom = new JSDOM('<!DOCTYPE html><html><body><div id="ui-overlay"></div></body></html>', {
    url: 'http://localhost:5173/',
  });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
}

function makePlayingState(overrides = {}) {
  const you = { score: 7, stuckSeeds: [], ...(overrides.you || {}) };
  const opponent = { score: 3, stuckSeeds: [], ...(overrides.opponent || {}) };
  return {
    gameType: 'sticker-mash-duel',
    phase: 'playing',
    roundMsRemaining: 12000,
    roundTotalMs: 30000,
    ...overrides,
    you,
    opponent,
  };
}

describe('StickerMashDuelScene input contracts', () => {
  beforeEach(() => installDom());

  afterEach(() => {
    delete globalThis.window;
    delete globalThis.document;
  });

  it('tap button dispatches mash-tap action during playing', () => {
    const actions = [];
    const scene = new StickerMashDuelScene(
      null,
      { sendGameAction: (a) => actions.push(a) },
      null,
      {},
    );
    scene.init();
    scene.applyState(makePlayingState());
    document.getElementById('smd-tap-btn')?.dispatchEvent(new window.Event('pointerdown', { bubbles: true }));
    assert.deepEqual(actions[0], { type: 'mash-tap' });
    scene.destroy();
  });

  it('space key dispatches mash-tap only while playing', () => {
    const actions = [];
    const scene = new StickerMashDuelScene(
      null,
      { sendGameAction: (a) => actions.push(a) },
      null,
      {},
    );
    scene.init();
    scene.applyState({
      gameType: 'sticker-mash-duel',
      phase: 'countdown',
      countdownMsRemaining: 2500,
      roundTotalMs: 30000,
      you: { score: 0, stuckSeeds: [] },
      opponent: { score: 0, stuckSeeds: [] },
    });
    window.dispatchEvent(new window.KeyboardEvent('keydown', { code: 'Space' }));
    assert.equal(actions.length, 0);
    scene.applyState(makePlayingState());
    window.dispatchEvent(new window.KeyboardEvent('keydown', { code: 'Space' }));
    assert.equal(actions.length, 1);
    scene.destroy();
  });

  it('throttles rapid pointerdown repeats to avoid client spam', () => {
    const actions = [];
    const oldNow = Date.now;
    let now = 1000;
    Date.now = () => now;
    try {
      const scene = new StickerMashDuelScene(
        null,
        { sendGameAction: (a) => actions.push(a) },
        null,
        {},
      );
      scene.init();
      scene.applyState(makePlayingState());

      const tap = () => document.getElementById('smd-tap-btn')?.dispatchEvent(new window.Event('pointerdown', { bubbles: true }));
      tap();
      now += 10;
      tap();
      now += 50;
      tap();
      assert.equal(actions.length, 2);
      assert.deepEqual(actions[0], { type: 'mash-tap' });
      assert.deepEqual(actions[1], { type: 'mash-tap' });
      scene.destroy();
    } finally {
      Date.now = oldNow;
    }
  });

  it('renders full round state progression in UI', () => {
    const scene = new StickerMashDuelScene(
      null,
      { sendGameAction: () => {} },
      null,
      {},
    );
    scene.init();

    scene.applyState({
      gameType: 'sticker-mash-duel',
      phase: 'countdown',
      countdownMsRemaining: 2200,
      roundMsRemaining: 0,
      roundTotalMs: 30000,
      you: { score: 0, stuckSeeds: [] },
      opponent: { score: 0, stuckSeeds: [] },
    });
    assert.equal(document.getElementById('smd-status')?.textContent, 'Ready...');
    assert.equal(document.getElementById('smd-tap-btn')?.disabled, true);
    assert.ok(document.getElementById('smd-timer')?.textContent?.includes('...'));
    assert.ok(document.getElementById('smd-timer-fill'), 'timer bar fill element exists');

    scene.applyState({
      gameType: 'sticker-mash-duel',
      phase: 'playing',
      countdownMsRemaining: 0,
      roundMsRemaining: 11850,
      roundTotalMs: 30000,
      you: { score: 9, stuckSeeds: [] },
      opponent: { score: 5, stuckSeeds: [] },
    });
    assert.equal(document.getElementById('smd-status')?.textContent, 'MASH! Stickers fly everywhere!');
    assert.equal(document.getElementById('smd-tap-btn')?.disabled, false);
    assert.equal(document.getElementById('smd-you-score')?.textContent, '9');
    assert.equal(document.getElementById('smd-opp-score')?.textContent, '5');
    assert.ok(document.getElementById('smd-timer')?.textContent?.endsWith('s'));

    scene.applyState({
      gameType: 'sticker-mash-duel',
      phase: 'finished',
      countdownMsRemaining: 0,
      roundMsRemaining: 0,
      roundTotalMs: 30000,
      you: { score: 11, stuckSeeds: [] },
      opponent: { score: 10, stuckSeeds: [] },
    });
    assert.equal(document.getElementById('smd-status')?.textContent, 'Round finished.');
    assert.equal(document.getElementById('smd-tap-btn')?.disabled, true);
    scene.destroy();
  });

  it('renders deck cards from stuckSeeds', () => {
    const scene = new StickerMashDuelScene(
      null,
      { sendGameAction: () => {} },
      null,
      {},
    );
    scene.init();
    scene.stickerPool = [{ src: 'https://cdn.example.com/stickers/a.png', durationMs: 1000 }];
    scene.applyState(
      makePlayingState({
        you: {
          score: 2,
          stuckSeeds: [0, 99],
        },
      }),
    );
    const cards = document.querySelectorAll('.smd-deck-card');
    assert.equal(cards.length, 2);
    assert.ok(cards[0].style.backgroundImage.includes('cdn.example.com'));
    assert.ok(cards[1].style.backgroundImage.includes('cdn.example.com'));
    scene.destroy();
  });

  it('spawns flying sticker burst on each accepted mash tap', () => {
    const scene = new StickerMashDuelScene(
      null,
      { sendGameAction: () => {} },
      null,
      {},
    );
    scene.init();
    scene.stickerPool = [{ src: 'https://cdn.example.com/fly.png', durationMs: 1000 }];
    scene.applyState(makePlayingState());
    document.getElementById('smd-tap-btn')?.dispatchEvent(new window.Event('pointerdown', { bubbles: true }));
    assert.ok(document.querySelector('.smd-fly-sticker'));
    scene.destroy();
  });

  it('fallback stickers available immediately without async fetch', () => {
    const scene = new StickerMashDuelScene(
      null,
      { sendGameAction: () => {} },
      null,
      {},
    );
    scene.init();
    assert.ok(scene.stickerPool.length > 0, 'stickerPool has fallback entries');
    assert.ok(scene.stickerPool[0].src.includes('/stickers/'), 'fallback points to /stickers/ dir');
    scene.destroy();
  });

  it('timer bar turns red when under 5 seconds', () => {
    const scene = new StickerMashDuelScene(
      null,
      { sendGameAction: () => {} },
      null,
      {},
    );
    scene.init();
    scene.applyState(makePlayingState({ roundMsRemaining: 4500 }));
    const fill = document.getElementById('smd-timer-fill');
    assert.ok(fill?.classList.contains('smd-timer-danger'), 'danger class applied under 5s');
    scene.applyState(makePlayingState({ roundMsRemaining: 12000 }));
    assert.ok(!fill?.classList.contains('smd-timer-danger'), 'danger class removed above 5s');
    scene.destroy();
  });
});
