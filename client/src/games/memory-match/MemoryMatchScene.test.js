import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { EventBus } from '../../shared/EventBus.js';
import { MemoryMatchScene } from './MemoryMatchScene.js';

function installDom() {
  const dom = new JSDOM('<!DOCTYPE html><html><body><div id="ui-overlay"></div></body></html>', {
    url: 'http://localhost:5173/',
  });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
}

describe('MemoryMatchScene input contract', () => {
  beforeEach(() => {
    installDom();
  });

  afterEach(() => {
    EventBus.clear();
    delete globalThis.window;
    delete globalThis.document;
  });

  it('clicking a hidden card on your turn calls network.memoryFlip with index', () => {
    const flips = [];
    const network = {
      playerId: 'p1',
      memoryFlip: (idx) => {
        flips.push(idx);
      },
    };
    const sceneManager = {
      renderer: { domElement: document.createElement('canvas') },
      setScene: () => {},
      onUpdate: null,
    };
    const scene = new MemoryMatchScene(sceneManager, network, {}, {});

    scene.init();
    scene._applyState({
      gridSize: 4,
      scores: { p1: 0, p2: 0 },
      currentTurn: 'p1',
      speedMode: false,
      elapsedSec: 0,
      pairsFound: 0,
      totalPairs: 8,
      slots: Array.from({ length: 16 }, () => ({ state: 'hidden' })),
    });

    const firstCard = scene.boardEl.querySelector('[data-idx="0"]');
    assert.ok(firstCard);
    firstCard.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));

    assert.deepEqual(flips, [0]);
    scene.destroy();
  });

  it('does not flip when it is not your turn', () => {
    const flips = [];
    const network = {
      playerId: 'p1',
      memoryFlip: (idx) => {
        flips.push(idx);
      },
    };
    const sceneManager = {
      renderer: { domElement: document.createElement('canvas') },
      setScene: () => {},
      onUpdate: null,
    };
    const scene = new MemoryMatchScene(sceneManager, network, {}, {});

    scene.init();
    scene._applyState({
      gridSize: 4,
      scores: { p1: 0, p2: 0 },
      currentTurn: 'p2',
      speedMode: false,
      elapsedSec: 0,
      pairsFound: 0,
      totalPairs: 8,
      slots: Array.from({ length: 16 }, () => ({ state: 'hidden' })),
    });

    const firstCard = scene.boardEl.querySelector('[data-idx="0"]');
    firstCard.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));

    assert.deepEqual(flips, []);
    scene.destroy();
  });
});
