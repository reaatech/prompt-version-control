import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Hono } from 'hono';
import { rateLimit } from '../rate-limit.js';
import { errorHandler } from '../error-handler.js';

describe('rateLimit', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should allow first request', async () => {
    const app = new Hono();
    app.use('/test', rateLimit({ windowMs: 60000, max: 5 }));
    app.get('/test', (c) => c.text('ok'));
    app.onError(errorHandler);

    const res = await app.request('/test', {
      headers: { authorization: 'Bearer key-1' },
    });
    expect(res.status).toBe(200);
  });

  it('should allow requests within limit', async () => {
    const app = new Hono();
    app.use('/test', rateLimit({ windowMs: 60000, max: 3 }));
    app.get('/test', (c) => c.text('ok'));
    app.onError(errorHandler);

    for (let i = 0; i < 3; i++) {
      const res = await app.request('/test', {
        headers: { authorization: 'Bearer key-2' },
      });
      expect(res.status).toBe(200);
    }
  });

  it('should throw RateLimitError when over limit', async () => {
    const app = new Hono();
    app.use('/test', rateLimit({ windowMs: 60000, max: 2 }));
    app.get('/test', (c) => c.text('ok'));
    app.onError(errorHandler);

    await app.request('/test', { headers: { authorization: 'Bearer key-3' } });
    await app.request('/test', { headers: { authorization: 'Bearer key-3' } });

    const res = await app.request('/test', {
      headers: { authorization: 'Bearer key-3' },
    });
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error.code).toBe('RATE_LIMIT_EXCEEDED');
  });

  it('should allow requests again after window reset', async () => {
    const app = new Hono();
    app.use('/test', rateLimit({ windowMs: 60000, max: 1 }));
    app.get('/test', (c) => c.text('ok'));
    app.onError(errorHandler);

    const res1 = await app.request('/test', {
      headers: { authorization: 'Bearer key-4' },
    });
    expect(res1.status).toBe(200);

    const res2 = await app.request('/test', {
      headers: { authorization: 'Bearer key-4' },
    });
    expect(res2.status).toBe(429);

    vi.advanceTimersByTime(60001);

    const res3 = await app.request('/test', {
      headers: { authorization: 'Bearer key-4' },
    });
    expect(res3.status).toBe(200);
  });
});
