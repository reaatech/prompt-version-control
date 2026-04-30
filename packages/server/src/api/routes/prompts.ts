import { zValidator } from '@hono/zod-validator';
import {
  CreatePromptSchema,
  CreateVersionSchema,
  DiffRequestSchema,
  PaginationSchema,
  UpdatePromptSchema,
} from '@reaatech/prompt-version-control-shared';
import { Hono } from 'hono';
import { auditMiddleware } from '../../middleware/audit.js';
import { authMiddleware } from '../../middleware/auth.js';
import { diffEngine } from '../../services/diff.engine.js';
import { promptService } from '../../services/prompt.service.js';
import { tagService } from '../../services/tag.service.js';
import { getProjectId } from '../../utils/context.js';
import { tagRoutes } from './tags.js';

const router = new Hono();

router.use('*', authMiddleware);

router.route('/:id/tags', tagRoutes);

router.get('/', zValidator('query', PaginationSchema), async (c) => {
  const projectId = getProjectId(c);
  const query = c.req.valid('query');
  const result = await promptService.listPrompts(projectId, query);
  return c.json(result);
});

router.post(
  '/',
  auditMiddleware('prompt', 'create'),
  zValidator('json', CreatePromptSchema),
  async (c) => {
    const projectId = getProjectId(c);
    const body = c.req.valid('json');
    const prompt = await promptService.createPrompt(projectId, body);
    return c.json(prompt, 201);
  },
);

router.get('/:id', async (c) => {
  const projectId = getProjectId(c);
  const id = c.req.param('id');
  const prompt = await promptService.getPrompt(projectId, id);
  return c.json(prompt);
});

router.put(
  '/:id',
  auditMiddleware('prompt', 'update'),
  zValidator('json', UpdatePromptSchema),
  async (c) => {
    const projectId = getProjectId(c);
    const id = c.req.param('id');
    const body = c.req.valid('json');
    const prompt = await promptService.updatePrompt(projectId, id, body);
    return c.json(prompt);
  },
);

router.delete('/:id', auditMiddleware('prompt', 'delete'), async (c) => {
  const projectId = getProjectId(c);
  const id = c.req.param('id');
  const prompt = await promptService.archivePrompt(projectId, id);
  return c.json(prompt);
});

router.get('/:id/versions', zValidator('query', PaginationSchema), async (c) => {
  const projectId = getProjectId(c);
  const id = c.req.param('id');
  const query = c.req.valid('query');
  const result = await promptService.listVersions(projectId, id, query);
  return c.json(result);
});

router.post(
  '/:id/versions',
  auditMiddleware('version', 'create'),
  zValidator('json', CreateVersionSchema),
  async (c) => {
    const projectId = getProjectId(c);
    const id = c.req.param('id');
    const body = c.req.valid('json');
    const version = await promptService.createVersion(projectId, id, body);
    return c.json(version, 201);
  },
);

router.get('/:id/production', async (c) => {
  const projectId = getProjectId(c);
  const promptId = c.req.param('id');
  const version = await tagService.getProductionVersion(projectId, promptId);
  return c.json(version);
});

router.get('/:id/versions/:vid', async (c) => {
  const projectId = getProjectId(c);
  const promptId = c.req.param('id');
  const versionId = c.req.param('vid');
  const version = await promptService.getVersion(projectId, promptId, versionId);
  return c.json(version);
});

router.get('/:id/diff', zValidator('query', DiffRequestSchema), async (c) => {
  const projectId = getProjectId(c);
  const promptId = c.req.param('id');
  const query = c.req.valid('query');
  const diff = await diffEngine.diff(projectId, promptId, query.fromVersion, query.toVersion);
  return c.json(diff);
});

export { router as promptRoutes };
