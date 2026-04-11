import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { EventBus } from '../../shared/EventBus.js';
import { stickerHitGame } from './index.js';

function installDom() {
  const dom = new JSDOM('<!DOCTYPE html><html><body><div id="ui-overlay"></div></body></html>', {
    url: 'http://localhost:5173/',
  });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
}

describe('Sticker Hit lobby HUD (createHUD)', () => {
  beforeEach(() => {
    installDom();
  });

  afterEach(() => {
    EventBus.clear();
    delete globalThis.window;
    delete globalThis.document;
  });

  it('updates stage and apple pills from sticker-hit:state', () => {
    const overlay = document.getElementById('ui-overlay');
    const hud = stickerHitGame.createHUD(overlay, {}, {});

    EventBus.emit('sticker-hit:state', {
      totalStages: 5,
      phase: 'playing',
      you: { stageIndex: 1, apples: 7, crashed: false, finished: false },
      opponent: { stageIndex: 0, apples: 2, crashed: false, finished: false },
    });

    assert.equal(document.getElementById('sh-hud-you').textContent, '2/5');
    assert.equal(document.getElementById('sh-hud-opp').textContent, '1/5');
    assert.equal(document.getElementById('sh-hud-apple-you').textContent, '7');
    assert.equal(document.getElementById('sh-hud-apple-opp').textContent, '2');

    hud.destroy();
  });
});
