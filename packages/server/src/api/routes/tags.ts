import { zValidator } from '@hono/zod-validator';
import { MoveTagSchema, TagNameSchema } from '@reaatech/prompt-version-control-shared';
import { Hono } from 'hono';
import { authMiddleware } from '../../middleware/auth.js';
import { tagService } from '../../services/tag.service.js';
import { getProjectId } from '../../utils/context.js';

const router = new Hono();

router.use('*', authMiddleware);

router.get('/', async (c) => {
  const projectId = getProjectId(c);
  const promptId = c.req.param('id') as string;
  const tags = await tagService.listTags(projectId, promptId);
  return c.json({ data: tags });
});

router.post('/:name', zValidator('json', MoveTagSchema), async (c) => {
  const projectId = getProjectId(c);
  const promptId = c.req.param('id') as string;
  const name = c.req.param('name') as string;
  const body = c.req.valid('json');

  const parsedName = TagNameSchema.parse(name);
  const tag = await tagService.moveTag(projectId, promptId, parsedName, body.versionId);
  return c.json(tag, 200);
});

router.get('/:name', async (c) => {
  const projectId = getProjectId(c);
  const promptId = c.req.param('id') as string;
  const name = c.req.param('name') as string;
  const parsedName = TagNameSchema.parse(name);
  const tag = await tagService.getTag(projectId, promptId, parsedName);
  return c.json(tag);
});

router.delete('/:name', async (c) => {
  const projectId = getProjectId(c);
  const promptId = c.req.param('id') as string;
  const name = c.req.param('name') as string;
  const parsedName = TagNameSchema.parse(name);
  await tagService.removeTag(projectId, promptId, parsedName);
  return c.body(null, 204);
});

export { router as tagRoutes };
