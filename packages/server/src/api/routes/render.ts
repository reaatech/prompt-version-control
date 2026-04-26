import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { renderTemplate } from '@pvc/shared';
import { tagService } from '../../services/tag.service.js';
import { promptService } from '../../services/prompt.service.js';
import { authMiddleware } from '../../middleware/auth.js';
import { getProjectId } from '../../utils/context.js';

const router = new Hono();

router.use('*', authMiddleware);

const RenderSchema = z.object({
  variables: z.record(z.string()).optional(),
});

router.post('/prompts/:id/versions/:number/render', zValidator('json', RenderSchema), async (c) => {
  const projectId = getProjectId(c);
  const promptId = c.req.param('id')!;
  const number = Number(c.req.param('number')!);
  const body = c.req.valid('json');

  const version = await promptService.getVersionByNumber(projectId, promptId, number);

  const result = renderTemplate(version.template, body.variables ?? {});

  return c.json({
    version: version.number,
    content: version.content,
    rendered: result.rendered,
    variablesUsed: result.variablesUsed,
    missingVariables: result.missingVariables,
  });
});

router.post('/prompts/:id/render', zValidator('json', RenderSchema), async (c) => {
  const projectId = getProjectId(c);
  const promptId = c.req.param('id')!;
  const body = c.req.valid('json');

  const version = await tagService.getProductionVersion(projectId, promptId);
  const result = renderTemplate(version.template, body.variables ?? {});

  return c.json({
    version: version.number,
    content: version.content,
    rendered: result.rendered,
    variablesUsed: result.variablesUsed,
    missingVariables: result.missingVariables,
  });
});

export { router as renderRoutes };
