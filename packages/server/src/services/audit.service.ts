import { prisma } from '../db/client.js';
import { logger } from '../utils/logger.js';
import type { AuditLog, Prisma } from '@prisma/client';

export class AuditService {
  async log(entry: Omit<AuditLog, 'id' | 'createdAt'>): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          actorId: entry.actorId,
          action: entry.action,
          resourceType: entry.resourceType,
          resourceId: entry.resourceId,
          projectId: entry.projectId,
          before: entry.before as Prisma.InputJsonValue,
          after: entry.after as Prisma.InputJsonValue,
          ipAddress: entry.ipAddress,
          requestId: entry.requestId,
        },
      });
    } catch (err) {
      logger.error({ err, entry }, 'failed to write audit log');
    }
  }
}

export const auditService = new AuditService();
