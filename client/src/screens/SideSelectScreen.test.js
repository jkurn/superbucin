import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { GameRegistry } from '../shared/GameRegistry.js';
import { render as renderSideSelect, updateSideSelect } from './SideSelectScreen.js';

function installDom() {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
    url: 'https://example.com/',
  });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
}

describe('SideSelectScreen', () => {
  beforeEach(() => {
    installDom();
    GameRegistry.__clearForTests();
    GameRegistry.register('custom-duel', {
      lobby: { name: 'Custom', icon: '\u2694', badge: '1v1' },
      sideSelect: {
        title: 'CUSTOM',
        pickTitle: 'Pick!',
        options: [
          { side: 'alpha', emoji: '\ud83c\udfaf', label: 'Alpha' },
          { side: 'beta', emoji: '\ud83c\udfaf', label: 'Beta' },
        ],
      },
    });
  });

  afterEach(() => {
    GameRegistry.__clearForTests();
    delete globalThis.window;
    delete globalThis.document;
  });

  it('clicking a side button calls network.selectSide and exposes getSelectedSide', () => {
    const sides = [];
    const network = {
      roomGameType: 'custom-duel',
      opponentIdentity: null,
      selectSide: (s) => sides.push(s),
    };
    const userManager = {
      profile: { avatarUrl: '/a.png' },
      getDisplayLabel: () => 'P1',
    };
    const overlay = document.createElement('div');
    document.body.appendChild(overlay);
    const handle = renderSideSelect(overlay, { network, userManager }, 'ROOM');
    overlay.querySelector('.side-option[data-side="beta"]').click();
    assert.deepEqual(sides, ['beta']);
    assert.equal(handle.getSelectedSide(), 'beta');
    const status = document.getElementById('side-status');
    assert.ok(status.textContent.includes('Waiting'));
  });

  it('updateSideSelect sets status text and suggests remaining side when opponent picked', () => {
    const network = {
      roomGameType: 'custom-duel',
      opponentIdentity: null,
      selectSide: () => {},
    };
    const overlay = document.createElement('div');
    document.body.appendChild(overlay);
    renderSideSelect(overlay, { network, userManager: { profile: { avatarUrl: '/a.png' }, getDisplayLabel: () => 'Me' } }, 'R1');
    updateSideSelect({ message: 'Opponent chose Beta', opponentSide: 'beta' }, null);
    const status = document.getElementById('side-status');
    assert.equal(status.textContent, 'Opponent chose Beta');
    const alpha = overlay.querySelector('.side-option[data-side="alpha"]');
    assert.ok(alpha.classList.contains('suggested'));
  });
});
