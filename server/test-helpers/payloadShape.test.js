import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  assertRequiredKeys,
  assertAllowedKeysOnly,
} from './payloadShape.js';

describe('payloadShape helpers', () => {
  it('assertRequiredKeys passes when all keys exist', () => {
    assertRequiredKeys({ a: 1, b: 2 }, ['a', 'b'], 'x');
  });

  it('assertRequiredKeys throws when a key is missing', () => {
    assert.throws(
      () => assertRequiredKeys({ a: 1 }, ['a', 'b'], 'x'),
      /missing required key: b/,
    );
  });

  it('assertAllowedKeysOnly passes when there are no extra keys', () => {
    assertAllowedKeysOnly({ a: 1 }, ['a'], 'x');
  });

  it('assertAllowedKeysOnly throws on unexpected keys', () => {
    assert.throws(
      () => assertAllowedKeysOnly({ a: 1, leak: true }, ['a'], 'slice'),
      /unexpected key: leak/,
    );
  });
});
