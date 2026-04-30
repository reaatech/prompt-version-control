import { zValidator } from '@hono/zod-validator';
import { EvalStatusSchema } from '@reaatech/prompt-version-control-shared';
import { Hono } from 'hono';
import { z } from 'zod';
import { AppError } from '../../errors.js';
import { authMiddleware } from '../../middleware/auth.js';
import { evalService } from '../../services/eval.service.js';
import { getProjectId } from '../../utils/context.js';

const router = new Hono();

// Webhook is public (HMAC-authenticated). Mount BEFORE the auth middleware.
const EvalWebhookSchema = z.object({
  harnessId: z.string().optional(),
  status: EvalStatusSchema,
  score: z.number().optional(),
  metrics: z.record(z.unknown()).optional(),
});

router.post('/webhook', async (c) => {
  const evaluationId = c.req.query('evaluationId');
  if (!evaluationId) {
    throw new AppError('MISSING_EVALUATION_ID', 400, 'evaluationId query parameter is required');
  }

  const rawBody = await c.req.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    throw new AppError('INVALID_JSON', 400, 'Invalid JSON body');
  }
  const body = EvalWebhookSchema.parse(parsed);

  const signature =
    c.req.header('x-webhook-signature') ?? c.req.header('x-hub-signature-256') ?? undefined;

  const eval_ = await evalService.receiveWebhook(evaluationId, rawBody, signature, {
    status: body.status,
    score: body.score,
    metrics: body.metrics,
  });
  return c.json(eval_);
});

router.use('*', authMiddleware);

const TriggerEvalSchema = z.object({
  versionId: z.string(),
  harnessId: z.string().default('default'),
});

router.post('/trigger', zValidator('json', TriggerEvalSchema), async (c) => {
  const projectId = getProjectId(c);
  const body = c.req.valid('json');
  const eval_ = await evalService.trigger(projectId, body.versionId, body.harnessId);
  return c.json(eval_, 201);
});

router.get('/versions/:versionId', async (c) => {
  const projectId = getProjectId(c);
  const versionId = c.req.param('versionId');
  const evals = await evalService.listByVersion(projectId, versionId);
  return c.json({ data: evals });
});

router.get('/versions/:versionId/gate', async (c) => {
  const projectId = getProjectId(c);
  const versionId = c.req.param('versionId');
  const status = await evalService.getPromotionGateStatus(projectId, versionId);
  return c.json(status);
});

export { router as evaluationRoutes };
