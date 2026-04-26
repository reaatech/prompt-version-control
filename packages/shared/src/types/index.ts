// Re-export schemas as types for convenience
export * from '../schemas/index.js';

// App-level types
export interface AppErrorDetails {
  code: string;
  status: number;
  message: string;
  details?: Record<string, unknown>;
}

export interface AuditLogEntry {
  id: string;
  actorId: string;
  action: 'create' | 'update' | 'delete' | 'promote' | 'rollback';
  resourceType: string;
  resourceId: string;
  projectId: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  ipAddress?: string;
  requestId?: string;
  createdAt: Date;
}

export interface PromotionResult {
  allowed: boolean;
  reason?: string;
  evaluations?: Array<{
    id: string;
    versionId: string;
    harnessId: string;
    status: string;
    score: number | null;
    metrics: Record<string, unknown> | null;
    startedAt: Date | null;
    completedAt: Date | null;
    createdAt: Date;
  }>;
}

export interface TemplateVariable {
  type: 'string' | 'number' | 'boolean' | 'enum';
  required?: boolean;
  default?: unknown;
  enumValues?: string[];
}

export interface RenderedPrompt {
  version: number;
  content: string;
  rendered: string;
  variablesUsed: string[];
  missingVariables: string[];
  metadata: Record<string, unknown> | null;
}
