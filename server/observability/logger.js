import pino from 'pino';
import { env } from '../config/env.js';

export const logger = pino({
  level: env.LOG_LEVEL,
  base: {
    service: 'superbucin-server',
    env: env.NODE_ENV,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export function withRequestContext(req) {
  return {
    request_id: req.requestId || req.headers['x-request-id'] || undefined,
    method: req.method,
    path: req.path,
  };
}
