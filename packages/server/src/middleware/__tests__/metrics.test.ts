import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { httpRequestDuration } from '../../services/prometheus.service.js';
import { metricsMiddleware } from '../metrics.js';

describe('metricsMiddleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should observe metrics with correct labels after request', async () => {
    const observeSpy = vi.spyOn(httpRequestDuration, 'observe').mockImplementation(() => undefined);
    vi.spyOn(performance, 'now').mockReturnValueOnce(1000).mockReturnValueOnce(1500);

    const app = new Hono();
    app.use('/test', metricsMiddleware);
    app.get('/test', (c) => c.text('ok'));

    const res = await app.request('/test');
    expect(res.status).toBe(200);

    expect(observeSpy).toHaveBeenCalledTimes(1);
    expect(observeSpy).toHaveBeenCalledWith(
      {
        method: 'GET',
        route: '/test',
        status: '200',
      },
      0.5,
    );
  });
});
