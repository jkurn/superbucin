/**
 * Shared mocks + GameFactory registrations for RoomManager test suites.
 * Import this module once per process for side-effect registration.
 */
import { GameFactory } from '../games/GameFactory.js';

export class MockGameState {
  constructor(p1, p2, _emit) {
    this.p1 = p1;
    this.p2 = p2;
    this.active = false;
  }
  start() { this.active = true; }
  stop() { this.active = false; }
  pause() {}
  resume() {}
  handleAction() {}
}

const MOCK_CONFIG = { SKIP_SIDE_SELECT: false };
const MOCK_SKIP_CONFIG = { SKIP_SIDE_SELECT: true };

GameFactory.register('othello', MockGameState, MOCK_CONFIG);
GameFactory.register('pig-vs-chick', MockGameState, MOCK_CONFIG);
GameFactory.register('doodle-guess', MockGameState, MOCK_CONFIG);
GameFactory.register('memory-match', MockGameState, MOCK_SKIP_CONFIG);
GameFactory.register('word-scramble-race', MockGameState, MOCK_CONFIG);
GameFactory.register('connect-four', MockGameState, MOCK_CONFIG);
GameFactory.register('bonk-brawl', MockGameState, MOCK_CONFIG);
GameFactory.register('cute-aggression', MockGameState, MOCK_CONFIG);

export function mockSocket(id) {
  const emitted = [];
  return {
    id,
    emit(event, data) { emitted.push({ event, data }); },
    join(_room) { /* no-op */ },
    _emitted: emitted,
    lastEmit(event) {
      for (let i = emitted.length - 1; i >= 0; i--) {
        if (emitted[i].event === event) return emitted[i].data;
      }
      return null;
    },
  };
}

export function mockIo() {
  const broadcasts = [];
  return {
    to(_room) {
      return {
        emit(event, data) { broadcasts.push({ event, data }); },
      };
    },
    _broadcasts: broadcasts,
  };
}
