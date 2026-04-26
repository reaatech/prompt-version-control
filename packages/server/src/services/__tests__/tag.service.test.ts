import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TagService } from '../tag.service.js';
import { prisma } from '../../db/client.js';
import { NotFoundError } from '../../errors.js';

vi.mock('../../db/client.js', () => ({
  prisma: {
    prompt: {
      findFirst: vi.fn(),
    },
    tag: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    version: {
      findFirst: vi.fn(),
    },
  },
}));

const promptInProject = (id = 'prompt_1') =>
  vi.mocked(prisma.prompt.findFirst).mockResolvedValue({
    id,
  } as Awaited<ReturnType<typeof prisma.prompt.findFirst>>);

describe('TagService', () => {
  let service: TagService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new TagService();
  });

  describe('listTags', () => {
    it('should return tags for a prompt', async () => {
      promptInProject();
      vi.mocked(prisma.tag.findMany).mockResolvedValue([
        { id: 'tag_1', name: 'production', version: { number: 2 } },
        { id: 'tag_2', name: 'staging', version: { number: 3 } },
      ] as unknown as Awaited<ReturnType<typeof prisma.tag.findMany>>);

      const result = await service.listTags('proj_1', 'prompt_1');
      expect(result).toHaveLength(2);
      expect(prisma.tag.findMany).toHaveBeenCalledWith({
        where: { promptId: 'prompt_1', projectId: 'proj_1' },
        include: { version: true },
        orderBy: { name: 'asc' },
      });
    });

    it('should throw NotFoundError when prompt is not in project', async () => {
      vi.mocked(prisma.prompt.findFirst).mockResolvedValue(null);
      await expect(service.listTags('proj_1', 'prompt_x')).rejects.toThrow(NotFoundError);
    });
  });

  describe('getTag', () => {
    it('should return a tag when found', async () => {
      vi.mocked(prisma.tag.findFirst).mockResolvedValue({
        id: 'tag_1',
        promptId: 'prompt_1',
        name: 'production',
        version: { id: 'ver_1', number: 2 },
      } as unknown as Awaited<ReturnType<typeof prisma.tag.findFirst>>);

      const result = await service.getTag('proj_1', 'prompt_1', 'production');
      expect(result.name).toBe('production');
      expect(result.version.number).toBe(2);
    });

    it('should throw NotFoundError when tag does not exist', async () => {
      vi.mocked(prisma.tag.findFirst).mockResolvedValue(null);

      await expect(service.getTag('proj_1', 'prompt_1', 'production')).rejects.toThrow(
        NotFoundError,
      );
    });
  });

  describe('moveTag', () => {
    it('should upsert a tag to a new version', async () => {
      promptInProject();
      vi.mocked(prisma.version.findFirst).mockResolvedValue({
        id: 'ver_2',
        promptId: 'prompt_1',
      } as Awaited<ReturnType<typeof prisma.version.findFirst>>);
      vi.mocked(prisma.tag.upsert).mockResolvedValue({
        id: 'tag_1',
        promptId: 'prompt_1',
        versionId: 'ver_2',
        name: 'production',
      } as Awaited<ReturnType<typeof prisma.tag.upsert>>);

      const result = await service.moveTag('proj_1', 'prompt_1', 'production', 'ver_2');
      expect(result.versionId).toBe('ver_2');
    });

    it('should throw NotFoundError when version does not exist', async () => {
      promptInProject();
      vi.mocked(prisma.version.findFirst).mockResolvedValue(null);

      await expect(service.moveTag('proj_1', 'prompt_1', 'production', 'ver_bad')).rejects.toThrow(
        NotFoundError,
      );
    });

    it('should throw NotFoundError when prompt is not in project', async () => {
      vi.mocked(prisma.prompt.findFirst).mockResolvedValue(null);
      await expect(
        service.moveTag('proj_other', 'prompt_1', 'production', 'ver_2'),
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('removeTag', () => {
    it('should delete a tag', async () => {
      vi.mocked(prisma.tag.findFirst).mockResolvedValue({
        id: 'tag_1',
      } as Awaited<ReturnType<typeof prisma.tag.findFirst>>);
      vi.mocked(prisma.tag.delete).mockResolvedValue(
        {} as Awaited<ReturnType<typeof prisma.tag.delete>>,
      );

      await service.removeTag('proj_1', 'prompt_1', 'staging');
      expect(prisma.tag.delete).toHaveBeenCalled();
    });

    it('should throw NotFoundError when tag does not exist', async () => {
      vi.mocked(prisma.tag.findFirst).mockResolvedValue(null);

      await expect(service.removeTag('proj_1', 'prompt_1', 'staging')).rejects.toThrow(
        NotFoundError,
      );
    });
  });

  describe('getProductionVersion', () => {
    it('should return the production version', async () => {
      vi.mocked(prisma.tag.findFirst).mockResolvedValue({
        version: { id: 'ver_1', number: 5, content: 'hello' },
      } as unknown as Awaited<ReturnType<typeof prisma.tag.findFirst>>);

      const result = await service.getProductionVersion('proj_1', 'prompt_1');
      expect(result.number).toBe(5);
    });

    it('should throw NotFoundError when no production tag exists', async () => {
      vi.mocked(prisma.tag.findFirst).mockResolvedValue(null);

      await expect(service.getProductionVersion('proj_1', 'prompt_1')).rejects.toThrow(
        NotFoundError,
      );
    });
  });
});
