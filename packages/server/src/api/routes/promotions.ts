import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';
import { prisma } from '../../db/client.js';
import { AppError, NotFoundError } from '../../errors.js';
import { auditMiddleware } from '../../middleware/audit.js';
import { authMiddleware } from '../../middleware/auth.js';
import { evalService } from '../../services/eval.service.js';
import { tagService } from '../../services/tag.service.js';
import { getProjectId } from '../../utils/context.js';

const router = new Hono();

router.use('*', authMiddleware);

router.post('/prompts/:id/promote', auditMiddleware('prompt', 'promote'), async (c) => {
  const projectId = getProjectId(c);
  const promptId = c.req.param('id') as string;

  let stagingTag: Awaited<ReturnType<typeof tagService.getTag>> | null;
  try {
    stagingTag = await tagService.getTag(projectId, promptId, 'staging');
  } catch (err) {
    if (err instanceof NotFoundError) {
      stagingTag = null;
    } else {
      throw err;
    }
  }
  if (!stagingTag) {
    throw new AppError('NO_STAGING', 400, 'No staging version found for this prompt');
  }

  const gate = await evalService.getPromotionGateStatus(projectId, stagingTag.versionId);
  if (!gate.canPromote) {
    throw new AppError('PROMOTION_BLOCKED', 409, gate.reason || 'Promotion blocked by eval gate');
  }

  await tagService.moveTag(projectId, promptId, 'production', stagingTag.versionId);

  return c.json({
    promoted: true,
    fromVersion: stagingTag.version.number,
    reason: 'Eval gate passed',
  });
});

const OverrideSchema = z.object({
  versionId: z.string(),
  reason: z.string().min(1),
});

router.post(
  '/prompts/:id/promote/override',
  auditMiddleware('prompt', 'promote'),
  zValidator('json', OverrideSchema),
  async (c) => {
    const projectId = getProjectId(c);
    const promptId = c.req.param('id') as string;
    const body = c.req.valid('json');

    await tagService.moveTag(projectId, promptId, 'production', body.versionId);

    return c.json({
      promoted: true,
      versionId: body.versionId,
      reason: body.reason,
      overridden: true,
    });
  },
);

router.post('/prompts/:id/rollback', auditMiddleware('prompt', 'rollback'), async (c) => {
  const projectId = getProjectId(c);
  const promptId = c.req.param('id') as string;

  let prodTag: Awaited<ReturnType<typeof tagService.getTag>> | null;
  try {
    prodTag = await tagService.getTag(projectId, promptId, 'production');
  } catch (err) {
    if (err instanceof NotFoundError) {
      prodTag = null;
    } else {
      throw err;
    }
  }
  if (!prodTag) {
    throw new AppError('NO_PRODUCTION', 400, 'No production version found');
  }

  const previousVersion = await prisma.version.findFirst({
    where: {
      promptId,
      number: { lt: prodTag.version.number },
      prompt: { projectId },
    },
    orderBy: { number: 'desc' },
  });

  if (!previousVersion) {
    throw new AppError('NO_PREVIOUS', 400, 'No previous version to rollback to');
  }

  await tagService.moveTag(projectId, promptId, 'production', previousVersion.id);

  return c.json({
    rolledBack: true,
    fromVersion: prodTag.version.number,
    toVersion: previousVersion.number,
  });
});

export { router as promotionRoutes };
