import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PromptService } from '../prompt.service.js';
import { prisma } from '../../db/client.js';
import { ConflictError, NotFoundError } from '../../errors.js';

vi.mock('../../db/client.js', () => ({
  prisma: {
    prompt: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
    },
    version: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

describe('PromptService', () => {
  let service: PromptService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new PromptService();
  });

  describe('createPrompt', () => {
    it('should create a prompt successfully', async () => {
      vi.mocked(prisma.prompt.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.prompt.create).mockResolvedValue({
        id: 'prompt_123',
        projectId: 'proj_123',
        name: 'test-prompt',
        description: 'Test',
        template: 'Hello {{name}}',
        variables: {},
        metadata: null,
        archived: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.createPrompt('proj_123', {
        name: 'test-prompt',
        template: 'Hello {{name}}',
      });

      expect(result.name).toBe('test-prompt');
      expect(prisma.prompt.create).toHaveBeenCalled();
    });

    it('should throw conflict when name exists', async () => {
      vi.mocked(prisma.prompt.findFirst).mockResolvedValue({
        id: 'existing',
        name: 'test-prompt',
      } as Awaited<ReturnType<typeof prisma.prompt.findFirst>>);

      await expect(
        service.createPrompt('proj_123', {
          name: 'test-prompt',
          template: 'Hello',
        }),
      ).rejects.toThrow(ConflictError);
    });
  });

  describe('createVersion', () => {
    it('should create version with incremented number', async () => {
      vi.mocked(prisma.prompt.findFirst).mockResolvedValue({
        id: 'prompt_123',
        projectId: 'proj_123',
      } as Awaited<ReturnType<typeof prisma.prompt.findFirst>>);
      vi.mocked(prisma.version.findFirst).mockResolvedValue({
        number: 3,
      } as Awaited<ReturnType<typeof prisma.version.findFirst>>);
      vi.mocked(prisma.version.create).mockResolvedValue({
        id: 'ver_123',
        promptId: 'prompt_123',
        number: 4,
        content: 'New content',
        template: 'Hello {{name}}',
        variables: {},
        checksum: 'a'.repeat(64),
        metadata: null,
        createdAt: new Date(),
      } as Awaited<ReturnType<typeof prisma.version.create>>);

      const result = await service.createVersion('proj_123', 'prompt_123', {
        content: 'New content',
        template: 'Hello {{name}}',
      });

      expect(result.number).toBe(4);
    });

    it('should throw not found when prompt does not exist', async () => {
      vi.mocked(prisma.prompt.findFirst).mockResolvedValue(null);

      await expect(
        service.createVersion('proj_123', 'non-existent', {
          content: 'test',
          template: 'test',
        }),
      ).rejects.toThrow(NotFoundError);
    });

    it('should retry on unique-violation race', async () => {
      vi.mocked(prisma.prompt.findFirst).mockResolvedValue({
        id: 'prompt_123',
        projectId: 'proj_123',
      } as Awaited<ReturnType<typeof prisma.prompt.findFirst>>);
      vi.mocked(prisma.version.findFirst)
        .mockResolvedValueOnce({ number: 5 } as Awaited<
          ReturnType<typeof prisma.version.findFirst>
        >)
        .mockResolvedValueOnce({ number: 6 } as Awaited<
          ReturnType<typeof prisma.version.findFirst>
        >);
      vi.mocked(prisma.version.create)
        .mockRejectedValueOnce(Object.assign(new Error('unique'), { code: 'P2002' }))
        .mockResolvedValueOnce({
          id: 'ver_7',
          number: 7,
        } as Awaited<ReturnType<typeof prisma.version.create>>);

      const result = await service.createVersion('proj_123', 'prompt_123', {
        content: 'x',
        template: 'x',
      });
      expect(result.number).toBe(7);
      expect(prisma.version.create).toHaveBeenCalledTimes(2);
    });
  });
});
