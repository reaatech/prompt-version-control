import type { Prisma } from '@prisma/client';
import type { IngestMetricInput, MetricType } from '@reaatech/prompt-version-control-shared';
import { prisma } from '../db/client.js';
import { NotFoundError } from '../errors.js';

export class MetricService {
  async ingest(projectId: string, metrics: IngestMetricInput[]) {
    const versionIds = [...new Set(metrics.map((m) => m.versionId))];

    // Confirm every versionId belongs to the caller's project. Cross-tenant
    // attempts surface as NotFound to avoid leaking which IDs exist.
    const versions = await prisma.version.findMany({
      where: { id: { in: versionIds }, prompt: { projectId } },
      select: { id: true },
    });
    const validIds = new Set(versions.map((v) => v.id));

    const invalid = versionIds.filter((id) => !validIds.has(id));
    if (invalid.length > 0) {
      // biome-ignore lint/style/noNonNullAssertion: safe — guarded by length check
      throw new NotFoundError('Version', invalid[0]!);
    }

    await prisma.metric.createMany({
      data: metrics.map((m) => ({
        versionId: m.versionId,
        type: m.type as MetricType,
        name: m.name,
        value: m.value,
        unit: m.unit,
        timestamp: m.timestamp ?? new Date(),
        dimensions: (m.dimensions ?? {}) as Prisma.InputJsonValue,
      })),
    });

    return { ingested: metrics.length };
  }

  async getVersionMetrics(projectId: string, versionId: string, opts: { hours?: number }) {
    const version = await prisma.version.findFirst({
      where: { id: versionId, prompt: { projectId } },
      select: { id: true },
    });
    if (!version) {
      throw new NotFoundError('Version', versionId);
    }

    const since = new Date(Date.now() - (opts.hours ?? 24) * 60 * 60 * 1000);
    return prisma.metric.findMany({
      where: { versionId, timestamp: { gte: since } },
      orderBy: { timestamp: 'desc' },
    });
  }

  async getPromptMetrics(projectId: string, promptId: string, opts: { hours?: number }) {
    const prompt = await prisma.prompt.findFirst({
      where: { id: promptId, projectId },
      select: { id: true },
    });
    if (!prompt) {
      throw new NotFoundError('Prompt', promptId);
    }

    const since = new Date(Date.now() - (opts.hours ?? 24) * 60 * 60 * 1000);
    return prisma.metric.findMany({
      where: {
        version: { promptId },
        timestamp: { gte: since },
      },
      orderBy: { timestamp: 'desc' },
    });
  }
}

export const metricService = new MetricService();
