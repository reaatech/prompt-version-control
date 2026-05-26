import type { Prisma, Prompt, Version } from '@prisma/client';
import type {
  CreatePromptInput,
  CreateVersionInput,
  UpdatePromptInput,
} from '@reaatech/prompt-version-control-shared';
import { calculateChecksum } from '@reaatech/prompt-version-control-shared';
import { prisma } from '../db/client.js';
import { ConflictError, NotFoundError } from '../errors.js';
import { paginateResult } from '../utils/pagination.js';
import { promptVersionsCreated } from './prometheus.service.js';

export class PromptService {
  async createPrompt(projectId: string, data: CreatePromptInput): Promise<Prompt> {
    const existing = await prisma.prompt.findFirst({
      where: { projectId, name: data.name },
    });

    if (existing) {
      throw new ConflictError('Prompt name already exists in this project');
    }

    const prompt = await prisma.prompt.create({
      data: {
        ...data,
        projectId,
        variables: data.variables ?? {},
        metadata: data.metadata,
      } as Prisma.PromptUncheckedCreateInput,
    });

    return prompt;
  }

  async getPrompt(projectId: string, id: string): Promise<Prompt> {
    const prompt = await prisma.prompt.findFirst({
      where: { id, projectId },
    });

    if (!prompt) {
      throw new NotFoundError('Prompt', id);
    }

    return prompt;
  }

  async listPrompts(projectId: string, opts: { limit: number; cursor?: string }) {
    const prompts = await prisma.prompt.findMany({
      where: { projectId, archived: false },
      take: opts.limit + 1,
      cursor: opts.cursor ? { id: opts.cursor } : undefined,
      orderBy: { createdAt: 'desc' },
    });

    return paginateResult(prompts, opts.limit);
  }

  async updatePrompt(projectId: string, id: string, data: UpdatePromptInput): Promise<Prompt> {
    await this.getPrompt(projectId, id);

    return prisma.prompt.update({
      where: { id },
      data: data as Prisma.PromptUpdateInput,
    });
  }

  async archivePrompt(projectId: string, id: string): Promise<Prompt> {
    await this.getPrompt(projectId, id);

    const prompt = await prisma.prompt.update({
      where: { id },
      data: { archived: true },
    });

    return prompt;
  }

  /**
   * Create a new version. Wrapped in a transaction with a unique-violation
   * retry loop so concurrent creates against the same prompt don't both win
   * the same version number.
   */
  async createVersion(
    projectId: string,
    promptId: string,
    data: CreateVersionInput,
  ): Promise<Version> {
    const prompt = await prisma.prompt.findFirst({
      where: { id: promptId, projectId },
      select: { id: true, projectId: true },
    });
    if (!prompt) {
      throw new NotFoundError('Prompt', promptId);
    }

    const checksum = calculateChecksum(data.content);

    const MAX_ATTEMPTS = 5;
    let lastError: unknown;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const maxVersion = await prisma.version.findFirst({
        where: { promptId },
        orderBy: { number: 'desc' },
        select: { number: true },
      });
      const nextNumber = (maxVersion?.number ?? 0) + 1;

      try {
        const version = await prisma.version.create({
          data: {
            promptId,
            number: nextNumber,
            content: data.content,
            template: data.template,
            variables: data.variables ?? {},
            checksum,
            metadata: data.metadata,
          } as Prisma.VersionUncheckedCreateInput,
        });
        promptVersionsCreated.inc({ project: prompt.projectId });
        return version;
      } catch (err) {
        // P2002 = Prisma unique constraint violation. Another concurrent create
        // claimed our number — recompute and retry.
        if ((err as { code?: string }).code === 'P2002') {
          lastError = err;
          continue;
        }
        throw err;
      }
    }
    throw lastError ?? new Error('Failed to allocate version number');
  }

  async getVersion(projectId: string, promptId: string, versionId: string): Promise<Version> {
    const version = await prisma.version.findFirst({
      where: { id: versionId, promptId, prompt: { projectId } },
    });

    if (!version) {
      throw new NotFoundError('Version', versionId);
    }

    return version;
  }

  async getVersionByNumber(projectId: string, promptId: string, number: number): Promise<Version> {
    const version = await prisma.version.findFirst({
      where: { promptId, number, prompt: { projectId } },
    });

    if (!version) {
      throw new NotFoundError('Version', String(number));
    }

    return version;
  }

  async listVersions(
    projectId: string,
    promptId: string,
    opts: { limit: number; cursor?: string },
  ) {
    // Confirm caller owns the prompt before paging through its versions.
    const prompt = await prisma.prompt.findFirst({
      where: { id: promptId, projectId },
      select: { id: true },
    });
    if (!prompt) {
      throw new NotFoundError('Prompt', promptId);
    }

    const versions = await prisma.version.findMany({
      where: { promptId },
      take: opts.limit + 1,
      cursor: opts.cursor ? { id: opts.cursor } : undefined,
      orderBy: { number: 'desc' },
    });

    return paginateResult(versions, opts.limit);
  }
}

export const promptService = new PromptService();
