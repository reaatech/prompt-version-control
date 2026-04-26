import type { MiddlewareHandler } from 'hono';
import { httpRequestDuration } from '../services/prometheus.service.js';

export const metricsMiddleware: MiddlewareHandler = async (c, next) => {
  const start = performance.now();
  await next();
  const duration = (performance.now() - start) / 1000;

  const route = c.req.routePath ?? 'unknown';
  httpRequestDuration.observe(
    {
      method: c.req.method,
      route,
      status: String(c.res.status),
    },
    duration,
  );
};
