import type { MiddlewareHandler } from 'hono';
import { auditService } from '../services/audit.service.js';
import { getProjectId } from '../utils/context.js';
import { logger } from '../utils/logger.js';

export function auditMiddleware(
  resourceType: string,
  action: 'create' | 'update' | 'delete' | 'promote' | 'rollback',
): MiddlewareHandler {
  return async (c, next) => {
    await next();

    let projectId: string;
    try {
      projectId = getProjectId(c);
    } catch {
      return;
    }

    const apiKey = c.get('apiKey') as { id: string } | undefined;
    const requestId = c.get('requestId') as string | undefined;

    if (!apiKey) return;

    const resourceId = c.req.param('id') || 'unknown';

    try {
      await auditService.log({
        actorId: apiKey.id,
        action,
        resourceType,
        resourceId,
        projectId,
        ipAddress: c.req.header('x-forwarded-for') || 'unknown',
        requestId: requestId ?? null,
        before: null,
        after: null,
      });
    } catch (err) {
      // Audit logging must never fail the request or crash the process.
      // Log the failure so operators can detect a misconfigured audit store.
      logger.error({ err }, 'audit log failed');
    }
  };
}
