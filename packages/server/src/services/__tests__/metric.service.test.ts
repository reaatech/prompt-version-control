import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MetricService } from '../metric.service.js';
import { prisma } from '../../db/client.js';
import { NotFoundError } from '../../errors.js';

vi.mock('../../db/client.js', () => ({
  prisma: {
    prompt: {
      findFirst: vi.fn(),
    },
    version: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    metric: {
      createMany: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

describe('MetricService', () => {
  let service: MetricService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new MetricService();
  });

  describe('ingest', () => {
    it('should create metrics for valid versions in this project', async () => {
      vi.mocked(prisma.version.findMany).mockResolvedValue([
        { id: 'ver_1' },
        { id: 'ver_2' },
      ] as Awaited<ReturnType<typeof prisma.version.findMany>>);
      vi.mocked(prisma.metric.createMany).mockResolvedValue({ count: 2 } as Awaited<
        ReturnType<typeof prisma.metric.createMany>
      >);

      const result = await service.ingest('proj_1', [
        { versionId: 'ver_1', type: 'cost', name: 'token_cost', value: 0.002, unit: 'usd' },
        { versionId: 'ver_2', type: 'latency', name: 'response_time', value: 120, unit: 'ms' },
      ]);

      expect(result.ingested).toBe(2);
      expect(prisma.metric.createMany).toHaveBeenCalled();
    });

    it('should throw NotFoundError when a version does not belong to the project', async () => {
      vi.mocked(prisma.version.findMany).mockResolvedValue([{ id: 'ver_1' }] as Awaited<
        ReturnType<typeof prisma.version.findMany>
      >);

      await expect(
        service.ingest('proj_1', [
          { versionId: 'ver_1', type: 'cost', name: 'token_cost', value: 0.002, unit: 'usd' },
          { versionId: 'ver_bad', type: 'cost', name: 'token_cost', value: 0.002, unit: 'usd' },
        ]),
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('getVersionMetrics', () => {
    it('should return metrics for a version', async () => {
      vi.mocked(prisma.version.findFirst).mockResolvedValue({
        id: 'ver_1',
      } as Awaited<ReturnType<typeof prisma.version.findFirst>>);
      vi.mocked(prisma.metric.findMany).mockResolvedValue([
        { id: 'm1', versionId: 'ver_1', value: 100 },
      ] as Awaited<ReturnType<typeof prisma.metric.findMany>>);

      const result = await service.getVersionMetrics('proj_1', 'ver_1', { hours: 24 });
      expect(result).toHaveLength(1);
      expect(prisma.metric.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ versionId: 'ver_1' }),
        }),
      );
    });

    it('should reject when version is not in project', async () => {
      vi.mocked(prisma.version.findFirst).mockResolvedValue(null);
      await expect(service.getVersionMetrics('proj_other', 'ver_1', { hours: 24 })).rejects.toThrow(
        NotFoundError,
      );
    });
  });

  describe('getPromptMetrics', () => {
    it('should return metrics for all versions of a prompt', async () => {
      vi.mocked(prisma.prompt.findFirst).mockResolvedValue({
        id: 'prompt_1',
      } as Awaited<ReturnType<typeof prisma.prompt.findFirst>>);
      vi.mocked(prisma.metric.findMany).mockResolvedValue([
        { id: 'm1', value: 100 },
        { id: 'm2', value: 200 },
      ] as Awaited<ReturnType<typeof prisma.metric.findMany>>);

      const result = await service.getPromptMetrics('proj_1', 'prompt_1', { hours: 24 });
      expect(result).toHaveLength(2);
    });
  });
});
