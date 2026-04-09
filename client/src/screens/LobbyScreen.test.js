import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { GameRegistry } from '../shared/GameRegistry.js';
import { render as renderLobby } from './LobbyScreen.js';

function installDom(url = 'https://example.com/') {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', { url });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.localStorage = dom.window.localStorage;
}

function stubUserManager() {
  return {
    profile: { avatarUrl: '/avatars/panda.png', points: 0 },
    getDisplayLabel: () => 'Tester',
    isGuest: true,
  };
}

describe('LobbyScreen render', () => {
  beforeEach(() => {
    installDom();
    GameRegistry.__clearForTests();
    GameRegistry.register('pig-vs-chick', {
      lobby: { name: 'Pig vs Chick', icon: '\ud83d\udc37', badge: '2P' },
    });
    GameRegistry.register('memory-match', {
      lobby: { name: 'Memory', icon: '\ud83c\udfaf', badge: 'Mem' },
    });
  });

  afterEach(() => {
    GameRegistry.__clearForTests();
    delete globalThis.window;
    delete globalThis.document;
    delete globalThis.localStorage;
  });

  it('Create Room calls network.createRoom with default selected game', () => {
    const calls = [];
    const network = {
      createRoom: (...args) => calls.push(args),
      joinRoom: () => {},
    };
    const overlay = document.createElement('div');
    document.body.appendChild(overlay);
    renderLobby(overlay, {
      network,
      userManager: stubUserManager(),
      showScreen: () => {},
    });
    document.getElementById('btn-create').click();
    assert.deepEqual(calls, [['pig-vs-chick', undefined]]);
  });

  it('selecting another game card then create passes memory-match options payload', () => {
    const calls = [];
    const network = {
      createRoom: (...args) => calls.push(args),
      joinRoom: () => {},
    };
    const overlay = document.createElement('div');
    document.body.appendChild(overlay);
    renderLobby(overlay, {
      network,
      userManager: stubUserManager(),
      showScreen: () => {},
    });
    const memoryCard = overlay.querySelector('.game-card[data-game-type="memory-match"]');
    assert.ok(memoryCard);
    memoryCard.click();
    document.getElementById('btn-create').click();
    assert.equal(calls.length, 1);
    const [arg] = calls[0];
    assert.equal(typeof arg, 'object');
    assert.equal(arg.gameType, 'memory-match');
    assert.ok(typeof arg.packId === 'string');
    assert.ok([4, 6].includes(arg.gridSize));
    assert.equal(typeof arg.speedMode, 'boolean');
  });

  it('Join Room validates 4-character code before calling joinRoom', () => {
    const joins = [];
    const network = {
      createRoom: () => {},
      joinRoom: (code) => joins.push(code),
    };
    const overlay = document.createElement('div');
    document.body.appendChild(overlay);
    renderLobby(overlay, {
      network,
      userManager: stubUserManager(),
      showScreen: () => {},
    });
    const input = document.getElementById('input-code');
    const feedback = document.getElementById('join-feedback');
    input.value = 'ab';
    document.getElementById('btn-join').click();
    assert.equal(joins.length, 0);
    assert.ok(feedback.textContent.includes('4-character'));
    input.value = 'abcd';
    document.getElementById('btn-join').click();
    assert.deepEqual(joins, ['abcd']);
  });

  it('Enter in room code input triggers join', () => {
    const joins = [];
    const network = {
      createRoom: () => {},
      joinRoom: (code) => joins.push(code),
    };
    const overlay = document.createElement('div');
    document.body.appendChild(overlay);
    renderLobby(overlay, {
      network,
      userManager: stubUserManager(),
      showScreen: () => {},
    });
    document.getElementById('input-code').value = 'wxyz';
    document.getElementById('input-code').dispatchEvent(
      new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
    );
    assert.deepEqual(joins, ['wxyz']);
  });

  it('challenge deep-link shows banner and dismiss hides it', () => {
    installDom('https://example.com/?challenge=FromLink');
    const network = { createRoom: () => {}, joinRoom: () => {} };
    const overlay = document.createElement('div');
    document.body.appendChild(overlay);
    renderLobby(overlay, {
      network,
      userManager: stubUserManager(),
      showScreen: () => {},
    });
    const root = overlay.querySelector('#lobby-deep-link-root');
    assert.equal(root.hidden, false);
    const dismiss = root.querySelector('.lobby-deep-link-banner__dismiss');
    assert.ok(dismiss);
    dismiss.click();
    assert.equal(root.hidden, true);
  });

  it('memory-match options toggle expands and collapses the options body', () => {
    const network = { createRoom: () => {}, joinRoom: () => {} };
    const overlay = document.createElement('div');
    document.body.appendChild(overlay);
    renderLobby(overlay, {
      network,
      userManager: stubUserManager(),
      showScreen: () => {},
    });
    overlay.querySelector('.game-card[data-game-type="memory-match"]').click();
    const body = document.getElementById('game-options-body');
    const toggle = document.getElementById('game-options-toggle');
    assert.equal(body.hidden, true);
    toggle.click();
    assert.equal(body.hidden, false);
    toggle.click();
    assert.equal(body.hidden, true);
  });

  it('doodle-guess createRoom sends trimmed custom prompt lines', () => {
    GameRegistry.register('doodle-guess', {
      lobby: { name: 'Doodle', icon: '\u270f', badge: 'Draw' },
    });
    const calls = [];
    const network = {
      createRoom: (...args) => calls.push(args),
      joinRoom: () => {},
    };
    const overlay = document.createElement('div');
    document.body.appendChild(overlay);
    renderLobby(overlay, {
      network,
      userManager: stubUserManager(),
      showScreen: () => {},
    });
    overlay.querySelector('.game-card[data-game-type="doodle-guess"]').click();
    document.getElementById('game-options-toggle').click();
    const ta = document.getElementById('doodle-custom-prompts');
    ta.value = ' first \n\nsecond\t';
    document.getElementById('btn-create').click();
    assert.deepEqual(calls, [['doodle-guess', ['first', 'second']]]);
  });
});
