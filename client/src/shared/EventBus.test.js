import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { EventBus } from './EventBus.js';

describe('EventBus', () => {
  beforeEach(() => {
    EventBus.clear();
  });

  afterEach(() => {
    EventBus.clear();
  });

  it('emit with no listeners does not throw', () => {
    EventBus.emit('orphan:event', { x: 1 });
  });

  it('on + emit delivers payload to one subscriber', () => {
    const seen = [];
    const fn = (data) => seen.push(data);
    EventBus.on('game:state', fn);
    EventBus.emit('game:state', { phase: 'x' });
    assert.deepEqual(seen, [{ phase: 'x' }]);
  });

  it('supports multiple subscribers for the same event', () => {
    const a = [];
    const f1 = () => a.push(1);
    const f2 = () => a.push(2);
    EventBus.on('e', f1);
    EventBus.on('e', f2);
    EventBus.emit('e', null);
    assert.deepEqual(a.sort(), [1, 2]);
  });

  it('off removes a specific handler', () => {
    const log = [];
    const f1 = () => log.push('a');
    const f2 = () => log.push('b');
    EventBus.on('e', f1);
    EventBus.on('e', f2);
    EventBus.off('e', f1);
    EventBus.emit('e');
    assert.deepEqual(log, ['b']);
  });

  it('off on unknown event is a no-op', () => {
    EventBus.off('missing', () => {});
  });

  it('clear removes all subscriptions', () => {
    let calls = 0;
    EventBus.on('a', () => { calls += 1; });
    EventBus.on('b', () => { calls += 1; });
    EventBus.clear();
    EventBus.emit('a');
    EventBus.emit('b');
    assert.equal(calls, 0);
  });
});
