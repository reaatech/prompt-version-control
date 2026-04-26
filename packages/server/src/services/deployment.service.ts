import { prisma } from '../db/client.js';
import { redis } from '../db/redis.js';
import { AppError, NotFoundError } from '../errors.js';
import type { DeploymentStatus } from '@prisma/client';
import { createHash } from 'crypto';

export interface DeploymentVariant {
  versionId: string;
  weight: number;
  isControl: boolean;
}

export class DeploymentService {
  async createDeployment(
    projectId: string,
    promptId: string,
    name: string,
    variants: DeploymentVariant[],
  ) {
    const totalWeight = variants.reduce((sum, v) => sum + v.weight, 0);
    if (totalWeight !== 100) {
      throw new AppError(
        'INVALID_WEIGHTS',
        400,
        `Variant weights must sum to 100, got ${totalWeight}`,
      );
    }

    // Verify the prompt belongs to the caller's project.
    const prompt = await prisma.prompt.findFirst({
      where: { id: promptId, projectId },
      select: { id: true },
    });
    if (!prompt) {
      throw new NotFoundError('Prompt', promptId);
    }

    // Verify every versionId belongs to the prompt (and therefore the project).
    const versionIds = variants.map((v) => v.versionId);
    const versions = await prisma.version.findMany({
      where: { id: { in: versionIds }, promptId },
      select: { id: true },
    });
    if (versions.length !== versionIds.length) {
      throw new NotFoundError('Version', 'one or more variant versionIds');
    }

    const deployment = await prisma.deployment.create({
      data: {
        projectId,
        promptId,
        name,
        status: 'paused',
        config: { stickySessions: true },
        variants: {
          create: variants,
        },
      },
      include: { variants: true },
    });

    return deployment;
  }

  async listDeployments(projectId: string, promptId?: string) {
    return prisma.deployment.findMany({
      where: { projectId, promptId, status: { not: 'archived' } },
      include: { variants: { include: { version: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getDeployment(projectId: string, id: string) {
    const deployment = await prisma.deployment.findFirst({
      where: { id, projectId },
      include: { variants: { include: { version: true } } },
    });
    if (!deployment) {
      throw new NotFoundError('Deployment', id);
    }
    return deployment;
  }

  async resolveVersion(projectId: string, deploymentId: string, sessionId?: string) {
    const deployment = await this.getDeployment(projectId, deploymentId);
    if (deployment.status !== 'active') {
      throw new AppError('DEPLOYMENT_INACTIVE', 409, `Deployment is ${deployment.status}`);
    }

    if (sessionId && (deployment.config as Record<string, unknown>)?.stickySessions) {
      if (redis) {
        const stickyKey = `sticky:${deploymentId}:${sessionId}`;
        const cached = await redis.get(stickyKey);
        if (cached) {
          return cached;
        }

        const selected = this.selectByHash(sessionId, deployment.variants);
        await redis.setex(stickyKey, 86400, selected); // 24h TTL
        return selected;
      }

      const stickyVersion = this.selectByHash(sessionId, deployment.variants);
      if (stickyVersion) return stickyVersion;
    }

    return this.selectByWeight(deployment.variants);
  }

  async updateStatus(projectId: string, id: string, status: DeploymentStatus) {
    const deployment = await prisma.deployment.findFirst({
      where: { id, projectId },
      select: { id: true },
    });
    if (!deployment) {
      throw new NotFoundError('Deployment', id);
    }
    return prisma.deployment.update({
      where: { id },
      data: { status },
    });
  }

  private selectByWeight(variants: Array<{ versionId: string; weight: number }>) {
    if (variants.length === 0) {
      throw new AppError('DEPLOYMENT_EMPTY', 500, 'No variants configured');
    }
    const rand = Math.random() * 100;
    let cumulative = 0;
    for (const variant of variants) {
      cumulative += variant.weight;
      if (rand <= cumulative) {
        return variant.versionId;
      }
    }
    return variants[variants.length - 1]!.versionId;
  }

  private selectByHash(sessionId: string, variants: Array<{ versionId: string; weight: number }>) {
    if (variants.length === 0) {
      throw new AppError('DEPLOYMENT_EMPTY', 500, 'No variants configured');
    }
    const hash = createHash('sha256').update(sessionId).digest('hex');
    const intValue = parseInt(hash.slice(0, 8), 16);
    const bucket = intValue % 100;
    let cumulative = 0;
    for (const variant of variants) {
      cumulative += variant.weight;
      if (bucket < cumulative) {
        return variant.versionId;
      }
    }
    return variants[variants.length - 1]!.versionId;
  }
}

export const deploymentService = new DeploymentService();
