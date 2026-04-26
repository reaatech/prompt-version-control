import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { IngestMetricSchema } from '@pvc/shared';
import { metricService } from '../../services/metric.service.js';
import { authMiddleware } from '../../middleware/auth.js';
import { getProjectId } from '../../utils/context.js';

const router = new Hono();

router.use('*', authMiddleware);

const IngestMetricsSchema = z.object({
  metrics: z.array(IngestMetricSchema),
});

router.post('/ingest', zValidator('json', IngestMetricsSchema), async (c) => {
  const projectId = getProjectId(c);
  const body = c.req.valid('json');
  const result = await metricService.ingest(projectId, body.metrics);
  return c.json(result, 201);
});

router.get('/versions/:versionId', async (c) => {
  const projectId = getProjectId(c);
  const versionId = c.req.param('versionId');
  const hours = c.req.query('hours');
  const metrics = await metricService.getVersionMetrics(projectId, versionId, {
    hours: hours ? Number(hours) : undefined,
  });
  return c.json({ data: metrics });
});

router.get('/prompts/:promptId', async (c) => {
  const projectId = getProjectId(c);
  const promptId = c.req.param('promptId');
  const hours = c.req.query('hours');
  const metrics = await metricService.getPromptMetrics(projectId, promptId, {
    hours: hours ? Number(hours) : undefined,
  });
  return c.json({ data: metrics });
});

export { router as metricRoutes };
