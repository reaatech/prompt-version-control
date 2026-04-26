import type { MiddlewareHandler } from 'hono';
import { randomUUID } from 'crypto';

const REQUEST_ID_RE = /^[\w-]{1,128}$/;

export const requestIdMiddleware: MiddlewareHandler = async (c, next) => {
  const rawId = c.req.header('x-request-id');
  const requestId = rawId && REQUEST_ID_RE.test(rawId) ? rawId : randomUUID();
  c.set('requestId', requestId);
  c.header('x-request-id', requestId);
  await next();
};
