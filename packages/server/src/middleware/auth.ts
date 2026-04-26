import type { MiddlewareHandler } from 'hono';
import { hashApiKey } from '@pvc/shared';
import { prisma } from '../db/client.js';
import { UnauthorizedError } from '../errors.js';

const LAST_USED_THROTTLE_MS = 60_000;
const lastUsedCache = new Map<string, number>();

export const authMiddleware: MiddlewareHandler = async (c, next) => {
  const header = c.req.header('authorization');
  if (!header?.startsWith('Bearer ')) {
    throw new UnauthorizedError('Missing or invalid authorization header');
  }

  const key = header.slice(7);
  if (key.length === 0) {
    throw new UnauthorizedError('Invalid API key');
  }

  const keyHash = hashApiKey(key);

  const apiKey = await prisma.apiKey.findUnique({
    where: { keyHash },
    include: { project: true },
  });

  if (!apiKey) {
    throw new UnauthorizedError('Invalid API key');
  }

  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
    throw new UnauthorizedError('API key expired');
  }

  c.set('apiKey', apiKey);
  c.set('project', apiKey.project);
  c.set('projectId', apiKey.projectId);

  // Throttle lastUsedAt updates so high-QPS workloads don't write on every
  // request. Note: this cache is per-process — in a multi-instance deployment
  // each instance writes independently, which is acceptable for a usage
  // timestamp that does not need strict consistency.
  const now = Date.now();
  const last = lastUsedCache.get(apiKey.id) ?? 0;
  if (now - last >= LAST_USED_THROTTLE_MS) {
    lastUsedCache.set(apiKey.id, now);
    try {
      await prisma.apiKey.update({
        where: { id: apiKey.id },
        data: { lastUsedAt: new Date(now) },
      });
    } catch {
      // Best-effort — never fail the request because the bookkeeping write failed.
    }
  }

  await next();
};
