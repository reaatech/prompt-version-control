/**
 * Cross-tenant isolation integration test. Skipped by default — opt in by
 * exporting PVC_INTEGRATION_DB=1 (and DATABASE_URL pointing at a disposable
 * Postgres). The intent is to verify, against a real database, that an API key
 * scoped to project A can never read or modify resources owned by project B.
 *
 * Run locally: PVC_INTEGRATION_DB=1 DATABASE_URL=postgres://... pnpm --filter
 * @pvc/server test tenant-isolation
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { calculateChecksum, generateApiKey } from '@pvc/shared';
import { PromptService } from '../prompt.service.js';
import { TagService } from '../tag.service.js';
import { DeploymentService } from '../deployment.service.js';
import { MetricService } from '../metric.service.js';
import { DiffEngine } from '../diff.engine.js';
import { NotFoundError } from '../../errors.js';

const enabled = process.env.PVC_INTEGRATION_DB === '1';

describe.skipIf(!enabled)('tenant isolation (integration)', () => {
  const prisma = new PrismaClient();
  const promptService = new PromptService();
  const tagService = new TagService();
  const deploymentService = new DeploymentService();
  const metricService = new MetricService();
  const diffEngine = new DiffEngine();

  let projA: string;
  let projB: string;
  let promptA: string;
  let versionA: string;

  beforeAll(async () => {
    const a = await prisma.project.create({
      data: { name: 'A', slug: `a-${Date.now()}` },
    });
    const b = await prisma.project.create({
      data: { name: 'B', slug: `b-${Date.now()}` },
    });
    projA = a.id;
    projB = b.id;

    const { hash: hashA } = generateApiKey();
    const { hash: hashB } = generateApiKey();
    await prisma.apiKey.create({
      data: { projectId: projA, name: 'a', keyHash: hashA, prefix: 'pvc_a', permissions: {} },
    });
    await prisma.apiKey.create({
      data: { projectId: projB, name: 'b', keyHash: hashB, prefix: 'pvc_b', permissions: {} },
    });

    const prompt = await promptService.createPrompt(projA, {
      name: 'support',
      template: 'You are {{role}}',
    });
    promptA = prompt.id;

    const v1 = await prisma.version.create({
      data: {
        promptId: promptA,
        number: 1,
        content: 'one',
        template: 'You are {{role}}',
        variables: {},
        checksum: calculateChecksum('one'),
      },
    });
    versionA = v1.id;
  });

  afterAll(async () => {
    await prisma.metric.deleteMany({ where: { version: { promptId: promptA } } });
    await prisma.deploymentVariant.deleteMany({ where: { deployment: { projectId: projA } } });
    await prisma.deployment.deleteMany({ where: { projectId: { in: [projA, projB] } } });
    await prisma.tag.deleteMany({ where: { projectId: { in: [projA, projB] } } });
    await prisma.evaluation.deleteMany({ where: { version: { promptId: promptA } } });
    await prisma.version.deleteMany({ where: { promptId: promptA } });
    await prisma.prompt.deleteMany({ where: { projectId: projA } });
    await prisma.apiKey.deleteMany({ where: { projectId: { in: [projA, projB] } } });
    await prisma.project.deleteMany({ where: { id: { in: [projA, projB] } } });
    await prisma.$disconnect();
  });

  it('proj B cannot read proj A prompts', async () => {
    await expect(promptService.getPrompt(projB, promptA)).rejects.toThrow(NotFoundError);
  });

  it('proj B cannot create a version on proj A prompt', async () => {
    await expect(
      promptService.createVersion(projB, promptA, { content: 'evil', template: 'evil' }),
    ).rejects.toThrow(NotFoundError);
  });

  it('proj B cannot read proj A versions', async () => {
    await expect(promptService.getVersion(projB, promptA, versionA)).rejects.toThrow(NotFoundError);
  });

  it('proj B cannot list proj A tags', async () => {
    await expect(tagService.listTags(projB, promptA)).rejects.toThrow(NotFoundError);
  });

  it('proj B cannot move tags on proj A prompts', async () => {
    await expect(tagService.moveTag(projB, promptA, 'production', versionA)).rejects.toThrow(
      NotFoundError,
    );
  });

  it('proj B cannot ingest metrics for proj A versions', async () => {
    await expect(
      metricService.ingest(projB, [
        { versionId: versionA, type: 'cost', name: 'x', value: 1, unit: 'usd' },
      ]),
    ).rejects.toThrow(NotFoundError);
  });

  it('proj B cannot diff proj A versions', async () => {
    await expect(diffEngine.diff(projB, promptA, 1, 1)).rejects.toThrow(NotFoundError);
  });

  it('proj B cannot create a deployment on proj A prompt', async () => {
    await expect(
      deploymentService.createDeployment(projB, promptA, 'evil', [
        { versionId: versionA, weight: 100, isControl: true },
      ]),
    ).rejects.toThrow(NotFoundError);
  });
});
