import { describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';
import { requestIdMiddleware } from '../request-id.js';

vi.mock('crypto', () => ({
  randomUUID: vi.fn(() => 'mocked-uuid'),
}));

describe('requestIdMiddleware', () => {
  it('should use existing x-request-id header if present', async () => {
    const app = new Hono();
    app.use('/test', requestIdMiddleware);
    app.get('/test', (c) => c.text(c.get('requestId')));

    const res = await app.request('/test', {
      headers: { 'x-request-id': 'existing-id' },
    });
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('existing-id');
    expect(res.headers.get('x-request-id')).toBe('existing-id');
  });

  it('should generate UUID if x-request-id header is missing', async () => {
    const app = new Hono();
    app.use('/test', requestIdMiddleware);
    app.get('/test', (c) => c.text(c.get('requestId')));

    const res = await app.request('/test');
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('mocked-uuid');
    expect(res.headers.get('x-request-id')).toBe('mocked-uuid');
  });

  it('should set x-request-id header on response', async () => {
    const app = new Hono();
    app.use('/test', requestIdMiddleware);
    app.get('/test', (c) => c.text('ok'));

    const res = await app.request('/test', {
      headers: { 'x-request-id': 'resp-id' },
    });
    expect(res.headers.get('x-request-id')).toBe('resp-id');
  });
});
