import type { MiddlewareHandler } from 'hono';
import { createHash, randomBytes } from 'crypto';
import { RateLimitError } from '../errors.js';
import { redis } from '../db/redis.js';
import { logger } from '../utils/logger.js';

interface RateLimitOpts {
  windowMs: number;
  max: number;
}

/**
 * Derive a stable, non-sensitive identifier for rate limiting. We never put a
 * raw API key into a Map key, Redis key, or log line.
 */
function rateLimitId(c: { req: { header(name: string): string | undefined } }): string {
  const auth = c.req.header('authorization');
  if (auth?.startsWith('Bearer ')) {
    const key = auth.slice(7);
    if (key.length > 0) {
      return `key:${createHash('sha256').update(key).digest('hex').slice(0, 32)}`;
    }
  }
  const xff = c.req.header('x-forwarded-for');
  if (xff) {
    // Take only the first IP (the client) and hash it for symmetry with key path.
    const client = xff.split(',')[0]!.trim();
    return `ip:${createHash('sha256').update(client).digest('hex').slice(0, 32)}`;
  }
  return 'anonymous';
}

function inMemoryRateLimit(opts: RateLimitOpts): MiddlewareHandler {
  interface RateLimitStore {
    count: number;
    resetAt: number;
  }

  const store = new Map<string, RateLimitStore>();

  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
      if (entry.resetAt < now) {
        store.delete(key);
      }
    }
  }, 60_000);

  cleanupInterval.unref?.();

  return async (c, next) => {
    const key = rateLimitId(c);
    const now = Date.now();

    const entry = store.get(key);
    if (!entry || entry.resetAt < now) {
      store.set(key, { count: 1, resetAt: now + opts.windowMs });
    } else {
      entry.count++;
      if (entry.count > opts.max) {
        const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
        throw new RateLimitError(retryAfter);
      }
    }

    await next();
  };
}

function redisRateLimit(opts: RateLimitOpts): MiddlewareHandler {
  return async (c, next) => {
    if (!redis) return await next();

    const key = rateLimitId(c);
    const redisKey = `rate_limit:${key}`;
    const now = Date.now();
    const windowStart = now - opts.windowMs;

    const member = `${now}-${randomBytes(8).toString('hex')}`;

    const pipeline = redis.multi();
    pipeline.zremrangebyscore(redisKey, 0, windowStart);
    pipeline.zcard(redisKey);
    pipeline.zadd(redisKey, now, member);
    pipeline.pexpire(redisKey, opts.windowMs);

    const results = await pipeline.exec();
    const count = (results?.[1]?.[1] as number) ?? 0;

    if (count >= opts.max) {
      const ttl = await redis.pttl(redisKey);
      const retryAfter = Math.ceil(Math.max(ttl, 0) / 1000);
      throw new RateLimitError(retryAfter);
    }

    await next();
  };
}

export function rateLimit(opts: RateLimitOpts): MiddlewareHandler {
  if (redis) {
    return redisRateLimit(opts);
  }
  if (process.env.NODE_ENV === 'production') {
    // Redis-backed rate limiting is strongly recommended for multi-instance
    // deployments. In-memory counters are per-process and won't coordinate
    // across instances behind a load balancer.
    logger.warn('REDIS_URL not set — using in-memory rate limiting (per-process, not shared)');
  }
  return inMemoryRateLimit(opts);
}
