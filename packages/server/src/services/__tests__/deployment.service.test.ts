import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DeploymentService } from '../deployment.service.js';
import { prisma } from '../../db/client.js';
import { NotFoundError } from '../../errors.js';

vi.mock('../../db/client.js', () => ({
  prisma: {
    prompt: {
      findFirst: vi.fn(),
    },
    version: {
      findMany: vi.fn(),
    },
    deployment: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

describe('DeploymentService', () => {
  let service: DeploymentService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new DeploymentService();
  });

  describe('createDeployment', () => {
    it('should create deployment with valid weights', async () => {
      vi.mocked(prisma.prompt.findFirst).mockResolvedValue({
        id: 'prompt_1',
      } as Awaited<ReturnType<typeof prisma.prompt.findFirst>>);
      vi.mocked(prisma.version.findMany).mockResolvedValue([
        { id: 'ver_1' },
        { id: 'ver_2' },
      ] as Awaited<ReturnType<typeof prisma.version.findMany>>);
      vi.mocked(prisma.deployment.create).mockResolvedValue({
        id: 'dep_1',
        name: 'A/B Test',
        variants: [
          { versionId: 'ver_1', weight: 70 },
          { versionId: 'ver_2', weight: 30 },
        ],
      } as unknown as Awaited<ReturnType<typeof prisma.deployment.create>>);

      const result = await service.createDeployment('proj_1', 'prompt_1', 'A/B Test', [
        { versionId: 'ver_1', weight: 70, isControl: true },
        { versionId: 'ver_2', weight: 30, isControl: false },
      ]);

      expect(result.name).toBe('A/B Test');
    });

    it('should throw when weights do not sum to 100', async () => {
      await expect(
        service.createDeployment('proj_1', 'prompt_1', 'Bad', [
          { versionId: 'ver_1', weight: 60, isControl: true },
          { versionId: 'ver_2', weight: 30, isControl: false },
        ]),
      ).rejects.toThrow('must sum to 100');
    });

    it('should throw NotFoundError when prompt is not in project', async () => {
      vi.mocked(prisma.prompt.findFirst).mockResolvedValue(null);
      await expect(
        service.createDeployment('proj_other', 'prompt_1', 'X', [
          { versionId: 'ver_1', weight: 100, isControl: true },
        ]),
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw NotFoundError for invalid version ids', async () => {
      vi.mocked(prisma.prompt.findFirst).mockResolvedValue({
        id: 'prompt_1',
      } as Awaited<ReturnType<typeof prisma.prompt.findFirst>>);
      vi.mocked(prisma.version.findMany).mockResolvedValue([{ id: 'ver_1' }] as Awaited<
        ReturnType<typeof prisma.version.findMany>
      >);

      await expect(
        service.createDeployment('proj_1', 'prompt_1', 'Bad', [
          { versionId: 'ver_1', weight: 50, isControl: true },
          { versionId: 'ver_missing', weight: 50, isControl: false },
        ]),
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('resolveVersion', () => {
    it('should resolve to a version based on weights', async () => {
      vi.mocked(prisma.deployment.findFirst).mockResolvedValue({
        id: 'dep_1',
        status: 'active',
        config: { stickySessions: false },
        variants: [
          { versionId: 'ver_a', weight: 50 },
          { versionId: 'ver_b', weight: 50 },
        ],
      } as unknown as Awaited<ReturnType<typeof prisma.deployment.findFirst>>);

      const result = await service.resolveVersion('proj_1', 'dep_1');
      expect(['ver_a', 'ver_b']).toContain(result);
    });

    it('should use deterministic hash for sticky sessions', async () => {
      vi.mocked(prisma.deployment.findFirst).mockResolvedValue({
        id: 'dep_1',
        status: 'active',
        config: { stickySessions: true },
        variants: [
          { versionId: 'ver_a', weight: 50 },
          { versionId: 'ver_b', weight: 50 },
        ],
      } as unknown as Awaited<ReturnType<typeof prisma.deployment.findFirst>>);

      const r1 = await service.resolveVersion('proj_1', 'dep_1', 'session_123');
      const r2 = await service.resolveVersion('proj_1', 'dep_1', 'session_123');
      expect(r1).toBe(r2);
    });

    it('should throw when deployment is not active', async () => {
      vi.mocked(prisma.deployment.findFirst).mockResolvedValue({
        id: 'dep_1',
        status: 'paused',
        config: {},
        variants: [],
      } as unknown as Awaited<ReturnType<typeof prisma.deployment.findFirst>>);

      await expect(service.resolveVersion('proj_1', 'dep_1')).rejects.toThrow('paused');
    });
  });
});
