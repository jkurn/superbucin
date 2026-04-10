import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { othelloGame } from './index.js';
import { STICKERS } from '../../shared/StickerPack.js';

function installDom() {
  const dom = new JSDOM('<!DOCTYPE html><html><body><div id="overlay"></div></body></html>', {
    url: 'https://example.com/',
  });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
}

describe('Othello HUD (Tiny Toes timer)', () => {
  beforeEach(() => {
    installDom();
  });

  afterEach(() => {
    delete globalThis.window;
    delete globalThis.document;
  });

  it('renders rotating turn sticker and urgent tick-tock copy', () => {
    const overlay = document.getElementById('overlay');
    const hud = othelloGame.createHUD(overlay);

    hud.updateTurn(true, 'black', 2200, 10_000, { turnStickerKey: 'virtualHug' });

    assert.equal(document.getElementById('turn-sticker').getAttribute('src'), STICKERS.virtualHug);
    assert.equal(document.getElementById('turn-timer').textContent, '3s');
    assert.ok(document.getElementById('turn-vibe').textContent.includes('tick tock'));
  });

  it('shows timeout penalty sticker burst with flavor text', () => {
    const overlay = document.getElementById('overlay');
    const hud = othelloGame.createHUD(overlay);

    hud.showTimeoutPenalty({
      stickerKey: 'pricyLaughing',
      flavorText: 'Cute aggression activated. Your turn got tiny-toed.',
    });

    const popEl = document.getElementById('othello-timeout-pop');
    assert.equal(popEl.hidden, false);
    assert.ok(popEl.classList.contains('show'));
    assert.equal(document.getElementById('timeout-sticker').getAttribute('src'), STICKERS.pricyLaughing);
    assert.ok(document.getElementById('timeout-text').textContent.includes('tiny-toed'));
  });

  it('supports expanded Pricylia sticker keys in turn HUD', () => {
    const overlay = document.getElementById('overlay');
    const hud = othelloGame.createHUD(overlay);

    hud.updateTurn(false, 'white', 7200, 10_000, { turnStickerKey: 'sayangilahPricy' });

    assert.equal(document.getElementById('turn-sticker').getAttribute('src'), STICKERS.sayangilahPricy);
  });
});
