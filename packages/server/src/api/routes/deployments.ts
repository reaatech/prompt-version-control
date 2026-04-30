import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';
import { authMiddleware } from '../../middleware/auth.js';
import { deploymentService } from '../../services/deployment.service.js';
import { getProjectId } from '../../utils/context.js';

const router = new Hono();

router.use('*', authMiddleware);

const CreateDeploymentSchema = z.object({
  promptId: z.string(),
  name: z.string().min(1),
  variants: z.array(
    z.object({
      versionId: z.string(),
      weight: z.number().int().min(0).max(100),
      isControl: z.boolean().default(false),
    }),
  ),
});

router.post('/', zValidator('json', CreateDeploymentSchema), async (c) => {
  const projectId = getProjectId(c);
  const body = c.req.valid('json');
  const deployment = await deploymentService.createDeployment(
    projectId,
    body.promptId,
    body.name,
    body.variants,
  );
  return c.json(deployment, 201);
});

router.get('/', async (c) => {
  const projectId = getProjectId(c);
  const promptId = c.req.query('promptId');
  const deployments = await deploymentService.listDeployments(projectId, promptId);
  return c.json({ data: deployments });
});

router.get('/:id/resolve', async (c) => {
  const projectId = getProjectId(c);
  const id = c.req.param('id') as string;
  const sessionId = c.req.query('sessionId');
  const versionId = await deploymentService.resolveVersion(projectId, id, sessionId ?? undefined);
  return c.json({ versionId, sessionId });
});

const UpdateDeploymentSchema = z.object({
  status: z.enum(['active', 'paused', 'archived']),
});

router.put('/:id', zValidator('json', UpdateDeploymentSchema), async (c) => {
  const projectId = getProjectId(c);
  const id = c.req.param('id') as string;
  const body = c.req.valid('json');
  const deployment = await deploymentService.updateStatus(projectId, id, body.status);
  return c.json(deployment);
});

export { router as deploymentRoutes };
