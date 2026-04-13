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

function makePlayingState() {
  return {
    gameType: 'sticker-mash-duel',
    phase: 'playing',
    roundMsRemaining: 12000,
    you: { score: 7 },
    opponent: { score: 3 },
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
      you: { score: 0 },
      opponent: { score: 0 },
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
      you: { score: 0 },
      opponent: { score: 0 },
    });
    assert.equal(document.getElementById('smd-status')?.textContent, 'Ready...');
    assert.equal(document.getElementById('smd-tap-btn')?.disabled, true);
    assert.ok(document.getElementById('smd-timer')?.textContent?.includes('...'));

    scene.applyState({
      gameType: 'sticker-mash-duel',
      phase: 'playing',
      countdownMsRemaining: 0,
      roundMsRemaining: 11850,
      you: { score: 9 },
      opponent: { score: 5 },
    });
    assert.equal(document.getElementById('smd-status')?.textContent, 'MASH!');
    assert.equal(document.getElementById('smd-tap-btn')?.disabled, false);
    assert.equal(document.getElementById('smd-you-score')?.textContent, '9');
    assert.equal(document.getElementById('smd-opp-score')?.textContent, '5');
    assert.ok(document.getElementById('smd-timer')?.textContent?.endsWith('s'));

    scene.applyState({
      gameType: 'sticker-mash-duel',
      phase: 'finished',
      countdownMsRemaining: 0,
      roundMsRemaining: 0,
      you: { score: 11 },
      opponent: { score: 10 },
    });
    assert.equal(document.getElementById('smd-status')?.textContent, 'Round finished.');
    assert.equal(document.getElementById('smd-tap-btn')?.disabled, true);
    scene.destroy();
  });
});
