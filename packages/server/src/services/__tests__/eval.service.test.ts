import { createHmac } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../../db/client.js';
import { NotFoundError, UnauthorizedError } from '../../errors.js';
import { EvalService } from '../eval.service.js';

vi.mock('../../db/client.js', () => ({
  prisma: {
    version: {
      findFirst: vi.fn(),
    },
    evaluation: {
      create: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

const versionInProject = (id = 'ver_1') =>
  vi.mocked(prisma.version.findFirst).mockResolvedValue({
    id,
  } as Awaited<ReturnType<typeof prisma.version.findFirst>>);

describe('EvalService', () => {
  let service: EvalService;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.EVAL_WEBHOOK_SECRET;
    service = new EvalService();
  });

  describe('trigger', () => {
    it('should create evaluation and mark running', async () => {
      versionInProject();
      vi.mocked(prisma.evaluation.create).mockResolvedValue({
        id: 'eval_1',
        status: 'pending',
      } as Awaited<ReturnType<typeof prisma.evaluation.create>>);
      vi.mocked(prisma.evaluation.update).mockResolvedValue({
        id: 'eval_1',
        status: 'running',
      } as Awaited<ReturnType<typeof prisma.evaluation.update>>);

      const result = await service.trigger('proj_1', 'ver_1', 'harness_1');
      expect(result.status).toBe('running');
      expect(prisma.evaluation.create).toHaveBeenCalled();
      expect(prisma.evaluation.update).toHaveBeenCalled();
    });

    it('should throw NotFoundError for missing version', async () => {
      vi.mocked(prisma.version.findFirst).mockResolvedValue(null);

      await expect(service.trigger('proj_1', 'ver_bad', 'harness_1')).rejects.toThrow(
        NotFoundError,
      );
    });
  });

  describe('receiveWebhook', () => {
    it('should update the evaluation identified by id', async () => {
      vi.mocked(prisma.evaluation.findUnique).mockResolvedValue({
        id: 'eval_1',
        status: 'running',
      } as Awaited<ReturnType<typeof prisma.evaluation.findUnique>>);
      vi.mocked(prisma.evaluation.update).mockResolvedValue({
        id: 'eval_1',
        status: 'passed',
        score: 0.85,
      } as Awaited<ReturnType<typeof prisma.evaluation.update>>);

      const body = JSON.stringify({ status: 'passed', score: 0.85 });
      const result = await service.receiveWebhook('eval_1', body, undefined, {
        status: 'passed',
        score: 0.85,
      });
      expect(result.status).toBe('passed');
      expect(result.score).toBe(0.85);
    });

    it('should throw NotFoundError when evaluation does not exist', async () => {
      vi.mocked(prisma.evaluation.findUnique).mockResolvedValue(null);

      await expect(
        service.receiveWebhook('missing', '{}', undefined, { status: 'passed' }),
      ).rejects.toThrow(NotFoundError);
    });

    it('should reject without a signature when secret is configured', async () => {
      process.env.EVAL_WEBHOOK_SECRET = 'topsecret';
      const fresh = new EvalService();
      await expect(
        fresh.receiveWebhook('eval_1', '{}', undefined, { status: 'passed' }),
      ).rejects.toThrow(UnauthorizedError);
    });

    it('should accept a valid HMAC signature', async () => {
      process.env.EVAL_WEBHOOK_SECRET = 'topsecret';
      const fresh = new EvalService();
      vi.mocked(prisma.evaluation.findUnique).mockResolvedValue({
        id: 'eval_1',
        status: 'running',
      } as Awaited<ReturnType<typeof prisma.evaluation.findUnique>>);
      vi.mocked(prisma.evaluation.update).mockResolvedValue({
        id: 'eval_1',
        status: 'passed',
      } as Awaited<ReturnType<typeof prisma.evaluation.update>>);

      const body = JSON.stringify({ status: 'passed' });
      const sig = createHmac('sha256', 'topsecret').update(body).digest('hex');
      const result = await fresh.receiveWebhook('eval_1', body, `sha256=${sig}`, {
        status: 'passed',
      });
      expect(result.status).toBe('passed');
    });
  });

  describe('getPromotionGateStatus', () => {
    it('should allow promotion when all evals pass with good scores', async () => {
      versionInProject();
      vi.mocked(prisma.evaluation.findMany).mockResolvedValue([
        { id: 'eval_1', status: 'passed', score: 0.9 },
        { id: 'eval_2', status: 'passed', score: 0.85 },
      ] as Awaited<ReturnType<typeof prisma.evaluation.findMany>>);

      const result = await service.getPromotionGateStatus('proj_1', 'ver_1');
      expect(result.canPromote).toBe(true);
    });

    it('should block when evaluations failed', async () => {
      versionInProject();
      vi.mocked(prisma.evaluation.findMany).mockResolvedValue([
        { id: 'eval_1', status: 'passed', score: 0.9 },
        { id: 'eval_2', status: 'failed', score: 0.5 },
      ] as Awaited<ReturnType<typeof prisma.evaluation.findMany>>);

      const result = await service.getPromotionGateStatus('proj_1', 'ver_1');
      expect(result.canPromote).toBe(false);
      expect(result.reason).toContain('failed');
    });

    it('should block when no evaluations exist', async () => {
      versionInProject();
      vi.mocked(prisma.evaluation.findMany).mockResolvedValue([]);

      const result = await service.getPromotionGateStatus('proj_1', 'ver_1');
      expect(result.canPromote).toBe(false);
      expect(result.reason).toContain('No evaluations');
    });

    it('should block when average score is below threshold', async () => {
      versionInProject();
      vi.mocked(prisma.evaluation.findMany).mockResolvedValue([
        { id: 'eval_1', status: 'passed', score: 0.7 },
      ] as Awaited<ReturnType<typeof prisma.evaluation.findMany>>);

      const result = await service.getPromotionGateStatus('proj_1', 'ver_1');
      expect(result.canPromote).toBe(false);
      expect(result.reason).toContain('0.70');
    });

    it('should block when evaluations are still pending', async () => {
      versionInProject();
      vi.mocked(prisma.evaluation.findMany).mockResolvedValue([
        { id: 'eval_1', status: 'passed', score: 0.9 },
        { id: 'eval_2', status: 'pending', score: null },
      ] as Awaited<ReturnType<typeof prisma.evaluation.findMany>>);

      const result = await service.getPromotionGateStatus('proj_1', 'ver_1');
      expect(result.canPromote).toBe(false);
      expect(result.reason).toContain('pending');
    });
  });
});
