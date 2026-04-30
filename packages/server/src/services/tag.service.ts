import type { Tag } from '@prisma/client';
import type { TagName } from '@reaatech/prompt-version-control-shared';
import { prisma } from '../db/client.js';
import { NotFoundError } from '../errors.js';

async function assertPromptInProject(projectId: string, promptId: string): Promise<void> {
  const prompt = await prisma.prompt.findFirst({
    where: { id: promptId, projectId },
    select: { id: true },
  });
  if (!prompt) throw new NotFoundError('Prompt', promptId);
}

export class TagService {
  async listTags(projectId: string, promptId: string) {
    await assertPromptInProject(projectId, promptId);
    return prisma.tag.findMany({
      where: { promptId, projectId },
      include: { version: true },
      orderBy: { name: 'asc' },
    });
  }

  async getTag(
    projectId: string,
    promptId: string,
    name: TagName,
  ): Promise<Tag & { version: { number: number; id: string } }> {
    const tag = await prisma.tag.findFirst({
      where: { promptId, projectId, name },
      include: { version: { select: { id: true, number: true } } },
    });

    if (!tag) {
      throw new NotFoundError('Tag', `${promptId}/${name}`);
    }

    return tag as Tag & { version: { number: number; id: string } };
  }

  async moveTag(
    projectId: string,
    promptId: string,
    name: TagName,
    versionId: string,
  ): Promise<Tag> {
    await assertPromptInProject(projectId, promptId);

    // Verify the version exists, belongs to this prompt, and is in this project.
    const version = await prisma.version.findFirst({
      where: { id: versionId, promptId, prompt: { projectId } },
      select: { id: true },
    });
    if (!version) {
      throw new NotFoundError('Version', versionId);
    }

    const tag = await prisma.tag.upsert({
      where: {
        promptId_name: {
          promptId,
          name,
        },
      },
      update: {
        versionId,
        projectId,
      },
      create: {
        projectId,
        promptId,
        versionId,
        name,
      },
    });

    return tag;
  }

  async removeTag(projectId: string, promptId: string, name: TagName): Promise<void> {
    const tag = await prisma.tag.findFirst({
      where: { promptId, projectId, name },
      select: { id: true },
    });

    if (!tag) {
      throw new NotFoundError('Tag', `${promptId}/${name}`);
    }

    await prisma.tag.delete({
      where: { id: tag.id },
    });
  }

  async getProductionVersion(projectId: string, promptId: string) {
    const tag = await prisma.tag.findFirst({
      where: { promptId, projectId, name: 'production' },
      include: { version: true },
    });

    if (!tag) {
      throw new NotFoundError('Production version', promptId);
    }

    return tag.version;
  }
}

export const tagService = new TagService();
