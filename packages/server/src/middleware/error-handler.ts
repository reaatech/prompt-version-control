import type { ErrorHandler } from 'hono';
import { ZodError } from 'zod';
import { AppError, ValidationError } from '../errors.js';
import { logger } from '../utils/logger.js';

export const errorHandler: ErrorHandler = (err, c) => {
  const requestId = c.get('requestId') as string | undefined;

  if (err instanceof ZodError) {
    const fields: Record<string, string[]> = {};
    for (const issue of err.issues) {
      const path = issue.path.join('.');
      fields[path] = fields[path] ?? [];
      fields[path].push(issue.message);
    }
    const appErr = new ValidationError(fields);
    logger.warn({ requestId, code: appErr.code, fields }, 'validation error');
    return c.json(
      {
        error: { code: appErr.code, message: appErr.message, details: appErr.details },
        requestId,
        timestamp: new Date().toISOString(),
      },
      appErr.status as Parameters<typeof c.json>[1],
    );
  }

  if (err instanceof AppError) {
    logger.warn(
      { requestId, code: err.code, status: err.status, details: err.details },
      err.message,
    );
    return c.json(
      {
        error: { code: err.code, message: err.message, details: err.details },
        requestId,
        timestamp: new Date().toISOString(),
      },
      err.status as Parameters<typeof c.json>[1],
    );
  }

  logger.error({ requestId, err }, 'unhandled error');
  return c.json(
    {
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
      requestId,
      timestamp: new Date().toISOString(),
    },
    500,
  );
};
