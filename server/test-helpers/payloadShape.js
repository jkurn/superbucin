import assert from 'node:assert/strict';

/**
 * Asserts obj has every listed key as an own property (values may be undefined).
 * @param {object} obj
 * @param {string[]} requiredKeys
 * @param {string} [label]
 */
export function assertRequiredKeys(obj, requiredKeys, label = 'payload') {
  assert.ok(obj && typeof obj === 'object', `${label} must be a non-null object`);
  for (const k of requiredKeys) {
    assert.ok(
      Object.prototype.hasOwnProperty.call(obj, k),
      `${label} missing required key: ${k}`,
    );
  }
}

/**
 * Asserts obj has no own keys outside `allowedKeys`.
 * @param {object} obj
 * @param {string[]} allowedKeys
 * @param {string} [label]
 */
export function assertAllowedKeysOnly(obj, allowedKeys, label = 'payload') {
  assert.ok(obj && typeof obj === 'object', `${label} must be a non-null object`);
  const allowed = new Set(allowedKeys);
  for (const k of Object.keys(obj)) {
    assert.ok(allowed.has(k), `${label} has unexpected key: ${k}`);
  }
}
