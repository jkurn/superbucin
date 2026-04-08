import { cleanEnv, port, str } from 'envalid';

export const env = cleanEnv(process.env, {
  NODE_ENV: str({ default: 'development' }),
  PORT: port({ default: 3000 }),
  LOG_LEVEL: str({ default: 'info' }),
  SUPABASE_URL: str({ default: '' }),
  SUPABASE_SERVICE_ROLE_KEY: str({ default: '' }),
  SUPABASE_JWT_SECRET: str({ default: '' }),
});

export function assertRequiredEnvForProduction() {
  if (env.NODE_ENV !== 'production') return;

  const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
  const missing = required.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(`Missing required env vars in production: ${missing.join(', ')}`);
  }

  if (!process.env.SUPABASE_JWT_SECRET) {
    // Keep startup resilient during env rollouts; JWT secret is recommended but non-blocking here.
    console.warn('SUPABASE_JWT_SECRET is not set; continuing startup in compatibility mode.');
  }
}
