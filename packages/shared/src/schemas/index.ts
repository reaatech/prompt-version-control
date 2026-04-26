import { z } from 'zod';

// Common ID schemas
export const IdSchema = z.string().cuid2();

// Pagination
export const PaginationSchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  cursor: z.string().optional(),
});

export type PaginationInput = z.infer<typeof PaginationSchema>;

export const PaginatedResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    data: z.array(itemSchema),
    meta: z.object({
      limit: z.number(),
      nextCursor: z.string().optional(),
      total: z.number().optional(),
    }),
  });

// Project schemas
export const CreateProjectSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/),
  settings: z.record(z.unknown()).optional(),
});

export const ProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  settings: z.record(z.unknown()).nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;
export type Project = z.infer<typeof ProjectSchema>;

// Prompt schemas
export const CreatePromptSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/, 'Name must be lowercase alphanumeric with hyphens'),
  description: z.string().max(500).optional(),
  template: z.string().min(1).max(100_000),
  variables: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const UpdatePromptSchema = CreatePromptSchema.partial().omit({ name: true });

export const PromptSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  template: z.string(),
  variables: z.record(z.unknown()),
  metadata: z.record(z.unknown()).nullable(),
  archived: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type CreatePromptInput = z.infer<typeof CreatePromptSchema>;
export type UpdatePromptInput = z.infer<typeof UpdatePromptSchema>;
export type Prompt = z.infer<typeof PromptSchema>;

// Version schemas
export const CreateVersionSchema = z.object({
  content: z.string().min(1).max(100_000),
  template: z.string().min(1).max(100_000),
  variables: z.record(z.unknown()).optional(),
  metadata: z
    .object({
      author: z.string().optional(),
      reason: z.string().optional(),
      sourceCommit: z.string().optional(),
    })
    .optional(),
});

export const VersionSchema = z.object({
  id: z.string(),
  promptId: z.string(),
  number: z.number().int().positive(),
  content: z.string(),
  template: z.string(),
  variables: z.record(z.unknown()),
  checksum: z.string().length(64),
  metadata: z.record(z.unknown()).nullable(),
  createdAt: z.date(),
});

export type CreateVersionInput = z.infer<typeof CreateVersionSchema>;
export type Version = z.infer<typeof VersionSchema>;

// Tag schemas
export const TagNameSchema = z.enum(['draft', 'staging', 'production']);

export const MoveTagSchema = z.object({
  versionId: z.string(),
});

export const TagSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  promptId: z.string(),
  versionId: z.string(),
  name: TagNameSchema,
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type TagName = z.infer<typeof TagNameSchema>;
export type MoveTagInput = z.infer<typeof MoveTagSchema>;
export type Tag = z.infer<typeof TagSchema>;

// Diff schemas
export const DiffRequestSchema = z.object({
  fromVersion: z.coerce.number().int().positive(),
  toVersion: z.coerce.number().int().positive(),
});

export const DiffSectionSchema = z.object({
  type: z.enum(['added', 'removed', 'modified']),
  value: z.string(),
  lineStart: z.number().optional(),
  lineEnd: z.number().optional(),
});

export const DiffResultSchema = z.object({
  fromVersion: z.number(),
  toVersion: z.number(),
  sections: z.array(DiffSectionSchema),
  semanticImpact: z.enum(['none', 'minor', 'major']),
});

export type DiffRequest = z.infer<typeof DiffRequestSchema>;
export type DiffSection = z.infer<typeof DiffSectionSchema>;
export type DiffResult = z.infer<typeof DiffResultSchema>;

// Eval schemas
export const EvalStatusSchema = z.enum(['pending', 'running', 'passed', 'failed', 'error']);

export const EvaluationSchema = z.object({
  id: z.string(),
  versionId: z.string(),
  harnessId: z.string(),
  status: EvalStatusSchema,
  score: z.number().nullable(),
  metrics: z.record(z.unknown()).nullable(),
  startedAt: z.date().nullable(),
  completedAt: z.date().nullable(),
  createdAt: z.date(),
});

export type EvalStatus = z.infer<typeof EvalStatusSchema>;
export type Evaluation = z.infer<typeof EvaluationSchema>;

// Metric schemas
export const MetricTypeSchema = z.enum(['cost', 'latency', 'quality']);

export const IngestMetricSchema = z.object({
  versionId: z.string(),
  type: MetricTypeSchema,
  name: z.string(),
  value: z.number(),
  unit: z.string(),
  timestamp: z.coerce.date().optional(),
  dimensions: z.record(z.unknown()).optional(),
});

export const MetricSchema = z.object({
  id: z.string(),
  versionId: z.string(),
  type: MetricTypeSchema,
  name: z.string(),
  value: z.number(),
  unit: z.string(),
  timestamp: z.date(),
  dimensions: z.record(z.unknown()).nullable(),
});

export type MetricType = z.infer<typeof MetricTypeSchema>;
export type IngestMetricInput = z.infer<typeof IngestMetricSchema>;
export type Metric = z.infer<typeof MetricSchema>;

// API Key schemas
export const CreateApiKeySchema = z.object({
  name: z.string().min(1).max(100),
  permissions: z.record(z.boolean()).optional(),
  expiresAt: z.coerce.date().optional(),
});

export const ApiKeySchema = z.object({
  id: z.string(),
  projectId: z.string(),
  name: z.string(),
  prefix: z.string(),
  permissions: z.record(z.boolean()),
  lastUsedAt: z.date().nullable(),
  expiresAt: z.date().nullable(),
  createdAt: z.date(),
});

export type CreateApiKeyInput = z.infer<typeof CreateApiKeySchema>;
export type ApiKey = z.infer<typeof ApiKeySchema>;
