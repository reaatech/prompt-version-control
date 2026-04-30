import type { Server } from 'node:http';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { compress } from 'hono/compress';
import { cors } from 'hono/cors';
import { deploymentRoutes } from './api/routes/deployments.js';
import { docsRoutes } from './api/routes/docs.js';
import { evaluationRoutes } from './api/routes/evaluations.js';
import { metricRoutes } from './api/routes/metrics.js';
import { promotionRoutes } from './api/routes/promotions.js';
import { promptRoutes } from './api/routes/prompts.js';
import { renderRoutes } from './api/routes/render.js';
import { webhookRoutes } from './api/routes/webhooks.js';
import { errorHandler } from './middleware/error-handler.js';
import { metricsMiddleware } from './middleware/metrics.js';
import { rateLimit } from './middleware/rate-limit.js';
import { requestIdMiddleware } from './middleware/request-id.js';
import { getMetrics } from './services/prometheus.service.js';
import { logger } from './utils/logger.js';

const app = new Hono();

// Build a strict CORS origin allow-list. Defaults to "no cross-origin" — set
// CORS_ALLOWED_ORIGINS to a comma-separated list (or "*" to allow any).
const corsOriginEnv = process.env.CORS_ALLOWED_ORIGINS?.trim();
const corsOrigin: string[] | string | ((origin: string) => string | null | undefined) = (() => {
  if (!corsOriginEnv) return [] as string[];
  if (corsOriginEnv === '*') return '*';
  const allowed = corsOriginEnv
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return (origin: string) => (allowed.includes(origin) ? origin : null);
})();

app.use(requestIdMiddleware);
app.use(compress());
app.use(cors({ origin: corsOrigin }));
app.use(rateLimit({ windowMs: 60_000, max: 100 }));
app.use(metricsMiddleware);

app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));
app.get('/ready', (c) => c.json({ status: 'ready' }));
app.get('/metrics', async (c) => {
  const metrics = await getMetrics();
  return c.text(metrics);
});

app.route('/api/v1/prompts', promptRoutes);
app.route('/api/v1/evaluations', evaluationRoutes);
app.route('/api/v1/metrics', metricRoutes);
app.route('/api/v1/deployments', deploymentRoutes);
app.route('/api/v1/webhooks', webhookRoutes);
app.route('/api/v1', renderRoutes);
app.route('/api/v1', promotionRoutes);
app.route('/api/v1/docs', docsRoutes);

app.onError(errorHandler);

app.notFound((c) => {
  return c.json(
    {
      error: { code: 'NOT_FOUND', message: `Route ${c.req.url} not found` },
      requestId: c.get('requestId'),
      timestamp: new Date().toISOString(),
    },
    404,
  );
});

if (!process.env.PUBLIC_API_URL && process.env.NODE_ENV !== 'development') {
  logger.warn('PUBLIC_API_URL is not set — eval harness callbacks will use localhost');
}

if (!process.env.API_KEY_PEPPER && process.env.NODE_ENV !== 'development') {
  logger.warn('API_KEY_PEPPER is not set — API keys will be hashed with unsalted SHA-256');
}

const port = Number(process.env.PORT) || 3000;

logger.info(`Server starting on port ${port}`);

const server = serve({
  fetch: app.fetch,
  port,
}) as Server;

const shutdown = (signal: string) => {
  logger.info({ signal }, 'shutting down gracefully');
  server.close(() => {
    logger.info('server closed');
    process.exit(0);
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export { app };
