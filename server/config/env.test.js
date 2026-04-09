import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const envModuleUrl = pathToFileURL(
  path.resolve(process.cwd(), 'server/config/env.js')
).href;

async function importFreshEnvModule(tag) {
  return import(`${envModuleUrl}?t=${encodeURIComponent(tag)}`);
}

function withPatchedEnv(patch, fn) {
  const backup = { ...process.env };
  Object.entries(patch).forEach(([key, value]) => {
    if (typeof value === 'undefined') {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  });
  return Promise.resolve()
    .then(fn)
    .finally(() => {
      process.env = backup;
    });
}

describe('server env config', () => {
  it('applies defaults for development env object', async () => withPatchedEnv(
    {
      NODE_ENV: undefined,
      PORT: undefined,
      LOG_LEVEL: undefined,
      SUPABASE_URL: undefined,
      SUPABASE_SERVICE_ROLE_KEY: undefined,
      SUPABASE_JWT_SECRET: undefined,
    },
    async () => {
      const { env } = await importFreshEnvModule('defaults');
      assert.equal(env.NODE_ENV, 'development');
      assert.equal(env.PORT, 3000);
      assert.equal(env.LOG_LEVEL, 'info');
    }
  ));

  it('throws in production when required Supabase vars are missing', async () => withPatchedEnv(
    {
      NODE_ENV: 'production',
      SUPABASE_URL: undefined,
      SUPABASE_SERVICE_ROLE_KEY: undefined,
      SUPABASE_JWT_SECRET: undefined,
    },
    async () => {
      const { assertRequiredEnvForProduction } = await importFreshEnvModule('missing-prod-vars');
      assert.throws(
        () => assertRequiredEnvForProduction(),
        /Missing required env vars in production: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY/
      );
    }
  ));

  it('does not throw outside production even when vars are empty', async () => withPatchedEnv(
    {
      NODE_ENV: 'development',
      SUPABASE_URL: undefined,
      SUPABASE_SERVICE_ROLE_KEY: undefined,
      SUPABASE_JWT_SECRET: undefined,
    },
    async () => {
      const { assertRequiredEnvForProduction } = await importFreshEnvModule('non-prod');
      assert.doesNotThrow(() => assertRequiredEnvForProduction());
    }
  ));

  it('warns but does not throw when JWT secret is missing in production', async () => withPatchedEnv(
    {
      NODE_ENV: 'production',
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
      SUPABASE_JWT_SECRET: undefined,
    },
    async () => {
      const { assertRequiredEnvForProduction } = await importFreshEnvModule('prod-jwt-missing');
      const oldWarn = console.warn;
      const warnings = [];
      console.warn = (msg) => warnings.push(String(msg));
      try {
        assert.doesNotThrow(() => assertRequiredEnvForProduction());
      } finally {
        console.warn = oldWarn;
      }
      assert.equal(warnings.length > 0, true);
    }
  ));
});

