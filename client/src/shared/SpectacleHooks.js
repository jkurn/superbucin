import { EventBus } from './EventBus.js';

export const SPECTACLE_EVENTS = {
  ENTRANCE: 'ENTRANCE',
  HIT: 'HIT',
  KILL: 'KILL',
  COMBO: 'COMBO',
  NEAR_MISS: 'NEAR_MISS',
  BASE_HIT: 'BASE_HIT',
};

export function emitSpectacle(type, payload = {}) {
  EventBus.emit('spectacle:hook', { type, ...payload });
}
