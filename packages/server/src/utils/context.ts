import type { Context } from 'hono';
import { AppError } from '../errors.js';

export function getProjectId(c: Context): string {
  const projectId = c.get('projectId');
  if (!projectId) {
    throw new AppError('INTERNAL', 500, 'Auth context missing: projectId not set');
  }
  return projectId as string;
}
