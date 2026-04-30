import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';
import { authMiddleware } from '../../middleware/auth.js';
import { webhookService } from '../../services/webhook.service.js';
import { getProjectId } from '../../utils/context.js';

const router = new Hono();

router.use('*', authMiddleware);

// Create webhook subscription
const CreateWebhookSchema = z.object({
  url: z.string().url(),
  events: z.array(
    z.enum([
      'version.created',
      'tag.moved',
      'eval.completed',
      'promotion.requested',
      'promotion.approved',
      'promotion.rejected',
    ]),
  ),
  secret: z.string().min(16),
});

router.post('/', zValidator('json', CreateWebhookSchema), async (c) => {
  const projectId = getProjectId(c);
  const body = c.req.valid('json');
  const sub = await webhookService.createSubscription(projectId, body);
  return c.json(sub, 201);
});

// List subscriptions
router.get('/', async (c) => {
  const projectId = getProjectId(c);
  const subs = await webhookService.listSubscriptions(projectId);
  return c.json({ data: subs });
});

// Delete subscription
router.delete('/:id', async (c) => {
  const projectId = getProjectId(c);
  const id = c.req.param('id') as string;
  await webhookService.deleteSubscription(projectId, id);
  return c.body(null, 204);
});

// Test delivery
router.post('/:id/test', async (c) => {
  const projectId = getProjectId(c);
  const id = c.req.param('id') as string;
  const result = await webhookService.testDelivery(projectId, id);
  return c.json(result);
});

export { router as webhookRoutes };
