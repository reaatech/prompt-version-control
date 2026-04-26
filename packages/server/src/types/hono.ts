import type { ApiKey, Project } from '@prisma/client';

// Extend Hono's context variables
declare module 'hono' {
  interface ContextVariableMap {
    requestId: string;
    projectId: string;
    apiKey: ApiKey;
    project: Project;
  }
}
