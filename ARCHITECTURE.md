# Architecture: Prompt Version Control

## System Overview

Prompt Version Control is a self-hosted service that provides Git-like versioning for AI prompts with eval-gated promotion workflows. The system is designed as a modular, scalable architecture that can be deployed alongside existing agent infrastructure.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Client Layer                                    │
├─────────────────┬─────────────────────┬─────────────────┬───────────────────┤
│      CLI        │     TypeScript SDK   │   MCP Clients   │   External APIs   │
│   (pvc)         │   (npm package)      │ (Claude Desktop)│ (Eval Harness)    │
└────────┬────────┴─────────┬───────────┴────────┬────────┴─────────┬─────────┘
         │                   │                    │                  │
         │    REST/HTTP      │    MCP Protocol    │   Webhooks       │
         ▼                   ▼                    ▼                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              API Gateway                                     │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  Authentication │ Rate Limiting │ Request Validation │ CORS │ Logging   ││
│  └─────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────┬───────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Application Layer                                  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐             │
│  │   Prompt        │  │    Version      │  │    Eval         │             │
│  │   Service       │  │    Service      │  │    Service      │             │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐             │
│  │   Deploy        │  │    Metrics      │  │    MCP          │             │
│  │   Service       │  │    Service      │  │    Server       │             │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘             │
└─────────────────────────────────────┬───────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                             Data Layer                                       │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐             │
│  │    PostgreSQL   │  │     Redis       │  │  Object Store   │             │
│  │   (Primary DB)  │  │   (Cache)       │  │  (Optional)     │             │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Core Components

### 1. API Server (Hono)

The API server is the central hub for all operations, built with Hono for its edge-ready capabilities and native OpenAPI support.

#### Architecture Principles

- **Stateless Design**: All state persisted to database
- **Horizontal Scalability**: Any instance can handle any request
- **Graceful Degradation**: Cache fallback when database is slow
- **Observability First**: Structured logging, metrics, tracing on every request

#### Middleware Stack

```typescript
// Middleware execution order
1. requestId      // Generate correlation ID
2. logger         // Request/response logging
3. cors          // CORS handling
4. helmet        // Security headers
5. rateLimiter   // Per-API-key rate limiting
6. auth          // API key validation
7. validator     // Zod request validation
8. handler       // Route handler
9. errorHandler  // Unified error responses
```

#### API Design Patterns

- **RESTful Resources**: `/api/v1/prompts/{id}/versions`
- **HATEOAS Links**: Response includes related resource URLs
- **Pagination**: Cursor-based for large collections
- **Filtering**: Query params for common filters
- **Sorting**: Explicit sort params with defaults

---

### 2. Database Layer (Prisma + PostgreSQL)

#### Schema Design

```prisma
// Core entities
model Project {
  id          String    @id @default(cuid())
  name        String
  slug        String    @unique
  settings    Json?     // Project-level configuration (eval thresholds, etc.)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  prompts     Prompt[]
  apiKeys     ApiKey[]
  members     ProjectMember[]
  deployments Deployment[]
}

model Prompt {
  id          String    @id @default(cuid())
  projectId   String
  name        String
  description String?
  template    String    // Current template schema (e.g., "Hello {{name}}")
  variables   Json      // Variable schema: { "name": "string", "tone": "enum:formal|casual" }
  metadata    Json?     // Custom metadata (category, owner, etc.)
  archived    Boolean   @default(false)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  project     Project   @relation(fields: [projectId], references: [id])
  versions    Version[]
  tags        Tag[]
  deployments Deployment[]

  @@index([projectId, archived])
  @@unique([projectId, name])
}

model Version {
  id          String    @id @default(cuid())
  promptId    String
  number      Int       // Sequential version number (auto-incremented per prompt)
  content     String    // Actual prompt content (the raw text used at inference time)
  template    String    // Template snapshot at time of version creation
  variables   Json      // Variable snapshot: values or schema used for this version
  checksum    String    // SHA256 of content for deduplication
  metadata    Json?     // Author, change reason, source commit, etc.
  createdAt   DateTime  @default(now())

  prompt      Prompt    @relation(fields: [promptId], references: [id])
  evaluations Evaluation[]
  metrics     Metric[]
  tags        Tag[]
  deploymentVariants DeploymentVariant[]

  @@unique([promptId, number])
  @@index([promptId, createdAt])
}

model Tag {
  id        String   @id @default(cuid())
  projectId String   // Denormalized for fast auth checks
  promptId  String   // The prompt this tag belongs to
  versionId String   // The version this tag points to (always set in MVP)
  name      String   // draft, staging, production
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  project   Project  @relation(fields: [projectId], references: [id])
  prompt    Prompt   @relation(fields: [promptId], references: [id])
  version   Version  @relation(fields: [versionId], references: [id])

  // Only one version per prompt can hold a given tag at a time
  @@unique([promptId, name])
  @@index([projectId, name])
}

model Evaluation {
  id          String    @id @default(cuid())
  versionId   String
  harnessId   String    // External eval harness ID
  status      EvalStatus // pending, running, passed, failed, error
  score       Float?
  metrics     Json?     // Detailed metrics from eval
  startedAt   DateTime?
  completedAt DateTime?
  createdAt   DateTime  @default(now())

  version     Version   @relation(fields: [versionId], references: [id])

  @@index([versionId, status])
  @@index([harnessId])
}

model Deployment {
  id          String    @id @default(cuid())
  projectId   String
  promptId    String
  name        String
  status      DeploymentStatus // active, paused, archived
  config      Json    // Traffic split config, sticky session settings
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  project     Project   @relation(fields: [projectId], references: [id])
  prompt      Prompt    @relation(fields: [promptId], references: [id])
  variants    DeploymentVariant[]

  @@index([projectId, status])
}

model DeploymentVariant {
  id          String    @id @default(cuid())
  deploymentId String
  versionId   String
  weight      Int       // 0-100 percentage
  isControl   Boolean   @default(false)

  deployment  Deployment @relation(fields: [deploymentId], references: [id])
  version     Version    @relation(fields: [versionId], references: [id])

  @@unique([deploymentId, versionId])
}

model Metric {
  id          String    @id @default(cuid())
  versionId   String
  type        MetricType // cost, latency, quality
  name        String    // metric name
  value       Float
  unit        String    // usd, ms, score
  timestamp   DateTime  @default(now())
  dimensions  Json?     // Additional dimensions

  version     Version   @relation(fields: [versionId], references: [id])

  @@index([versionId, type, timestamp])
  @@index([timestamp])
}

model ProjectMember {
  id        String   @id @default(cuid())
  projectId String
  userId    String   // External user ID from auth provider
  email     String
  role      String   // admin, editor, viewer
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  project   Project  @relation(fields: [projectId], references: [id])

  @@unique([projectId, userId])
}

model ApiKey {
  id          String    @id @default(cuid())
  projectId   String
  name        String
  keyHash     String    // Hashed key (bcrypt/argon2)
  prefix      String    // First 8 chars for identification
  permissions Json      // Permission set
  lastUsedAt  DateTime?
  expiresAt   DateTime?
  createdAt   DateTime  @default(now())

  project     Project   @relation(fields: [projectId], references: [id])

  @@unique([keyHash])
  @@index([projectId, prefix])
}

enum EvalStatus {
  pending
  running
  passed
  failed
  error
}

enum DeploymentStatus {
  active
  paused
  archived
}

enum MetricType {
  cost
  latency
  quality
}
```

#### Query Patterns

- **Hot Path**: Get production version by prompt ID (indexed, cached)
- **Warm Path**: List versions with pagination (indexed)
- **Cold Path**: Aggregate metrics over time ranges (materialized views)

---

### 3. Version Control Engine

The version control engine provides Git-like semantics for prompt management.

#### Version Lifecycle

```
1. Create     → New version with content + metadata
2. Diff       → Compare with any previous version
3. Tag        → Mark as draft/staging/production
4. Promote    → Move tag from one version to another
5. Rollback   → Revert to previous tagged version
```

#### Diff Engine

The diff engine understands prompt template semantics:

```typescript
interface DiffResult {
  additions: DiffSection[];
  deletions: DiffSection[];
  modifications: DiffSection[];
  templateChanges: {
    variablesAdded: string[];
    variablesRemoved: string[];
    variablesModified: string[];
  };
  semanticImpact: 'none' | 'minor' | 'major';
}

// Semantic diff considers:
// - Template variable changes
// - Instruction modifications
// - Example changes
// - System prompt changes
// - Few-shot example ordering
```

#### Tag Management

Tags are mutable pointers from a prompt to a specific version. Only one version per prompt can hold a given tag at a time.

```typescript
// Tag operations
POST /prompts/{id}/tags/production  → Move production tag to version
GET  /prompts/{id}/tags             → List all tags for prompt
GET  /prompts/{id}/tags/production  → Get production version
DELETE /prompts/{id}/tags/staging   → Remove staging tag
```

**Tag Rules (MVP):**

- `draft`, `staging`, `production` are mutually exclusive per prompt (one version per tag)
- Moving a tag from version A to version B is atomic
- Tag movements are audited (who, when, from→to)
- `Prompt.archived` handles soft delete — tags are not used for archival

---

### 3b. Template Engine

Prompts use a lightweight variable-interpolation engine (Handlebars-style syntax). The server stores raw templates and variables; rendering happens at read time (MCP `prompt.get`) or client-side.

```typescript
// Template syntax
"You are a {{role}}. Help the user with: {{issue}}"

// Variable schema (stored on Prompt)
{
  "role": { "type": "string", "required": true, "default": "support agent" },
  "issue": { "type": "string", "required": true }
}

// Rendered output (MCP or SDK)
{
  "content": "You are a support agent. Help the user with: login problem",
  "variablesUsed": ["role", "issue"],
  "missingVariables": []
}
```

**Engine Requirements:**

- Node.js native (no Python/Jinja2 dependency at runtime)
- HTML-escape by default (`{{var}}`), raw override (`{{{var}}}`)
- Support for conditionals (`{{#if condition}}...{{/if}}`) and loops
- Variable validation: fail fast if required variables are missing
- Max template size: 100KB (configurable)

**Chosen Library:** `handlebars` or `mustache` (TBD during implementation — mustache is lighter, handlebars has helpers).

---

### 4. Evaluation Integration

#### Eval Harness Interface

```typescript
interface EvalHarness {
  // Trigger evaluation
  triggerEval(params: {
    versionId: string;
    testCases: TestCase[];
    config: EvalConfig;
  }): Promise<EvalSession>;

  // Poll for results
  getResults(sessionId: string): Promise<EvalResults>;

  // Webhook for async completion
  webhookHandler(req: WebhookRequest): Promise<void>;
}

interface EvalConfig {
  thresholds: {
    minScore: number;
    maxCost: number;
    maxLatency: number;
  };
  testCases: TestCase[];
  metrics: string[];
}
```

#### Promotion Gate Logic

```typescript
async function canPromoteToProduction(versionId: string): Promise<{
  allowed: boolean;
  reason?: string;
  evalResults?: EvalResults;
}> {
  // 1. Check for required evaluations
  const evals = await getRequiredEvaluations(versionId);

  if (evals.length === 0) {
    return { allowed: false, reason: 'No evaluations found' };
  }

  // 2. Check all evals passed
  const failed = evals.filter((e) => e.status === 'failed');
  if (failed.length > 0) {
    return {
      allowed: false,
      reason: `${failed.length} evaluations failed`,
      evalResults: { passed: evals, failed },
    };
  }

  // 3. Check thresholds
  const avgScore = average(evals.map((e) => e.score));
  if (avgScore < config.minProductionScore) {
    return {
      allowed: false,
      reason: `Average score ${avgScore} below threshold ${config.minProductionScore}`,
    };
  }

  return { allowed: true, evalResults: evals };
}
```

---

### 5. A/B Testing Engine

#### Traffic Splitting Algorithm

```typescript
class TrafficSplitter {
  private consistentHash: ConsistentHash;

  constructor(variants: DeploymentVariant[]) {
    // Build hash ring with weighted nodes
    variants.forEach((v) => {
      for (let i = 0; i < v.weight; i++) {
        this.consistentHash.addNode(`${v.versionId}-${i}`);
      }
    });
  }

  selectVersion(sessionId: string): string {
    // Consistent hashing ensures same session → same version
    const node = this.consistentHash.getNode(sessionId);
    return node.split('-')[0]; // Extract versionId
  }
}
```

#### Deployment Resolution

```typescript
async function resolveDeployment(
  deploymentId: string,
  context: {
    sessionId?: string;
    userId?: string;
    metadata?: Record<string, string>;
  },
): Promise<Version> {
  const deployment = await getDeployment(deploymentId);

  // 1. Check for sticky session
  if (context.sessionId) {
    const cached = await getStickyVersion(deploymentId, context.sessionId);
    if (cached) return cached;
  }

  // 2. Select version based on traffic weights
  const splitter = new TrafficSplitter(deployment.variants);
  const versionId = splitter.selectVersion(context.sessionId || randomId());

  // 3. Cache for sticky sessions
  if (context.sessionId) {
    await setStickyVersion(deploymentId, context.sessionId, versionId);
  }

  return getVersion(versionId);
}
```

---

### 6. Metrics Collection

#### Metric Types

| Type        | Description                 | Aggregation        |
| ----------- | --------------------------- | ------------------ |
| **Cost**    | Token usage × model pricing | Sum, Average       |
| **Latency** | Response time               | P50, P95, P99      |
| **Quality** | Eval scores, user feedback  | Mean, Distribution |

#### Ingestion API

```typescript
POST /api/v1/metrics/ingest
{
  "versionId": "ver_abc123",
  "metrics": [
    {
      "type": "cost",
      "name": "token_cost",
      "value": 0.0023,
      "unit": "usd",
      "timestamp": "2024-01-15T10:30:00Z",
      "dimensions": {
        "model": "gpt-4",
        "input_tokens": 1500,
        "output_tokens": 300
      }
    },
    {
      "type": "latency",
      "name": "response_time",
      "value": 1234,
      "unit": "ms",
      "timestamp": "2024-01-15T10:30:00Z"
    }
  ]
}
```

#### Time-Series Aggregation

```sql
-- Materialized view for fast metric queries
CREATE MATERIALIZED VIEW metric_aggregates AS
SELECT
  version_id,
  type,
  name,
  date_trunc('hour', timestamp) as hour,
  AVG(value) as avg_value,
  PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY value) as p50,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY value) as p95,
  PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY value) as p99,
  COUNT(*) as sample_count
FROM metrics
GROUP BY version_id, type, name, date_trunc('hour', timestamp);
```

---

### 6b. Event & Webhook System

The system emits events for state changes so external systems (eval harnesses, Slack, monitoring) can react.

```typescript
interface Event {
  id: string;
  type:
    | 'version.created'
    | 'tag.moved'
    | 'eval.completed'
    | 'promotion.requested'
    | 'promotion.approved';
  projectId: string;
  payload: Record<string, unknown>;
  createdAt: Date;
}

// Webhook delivery
interface WebhookSubscription {
  id: string;
  projectId: string;
  url: string;
  events: string[]; // filter by event type
  secret: string; // HMAC-SHA256 signature
  active: boolean;
}
```

**Event Types:**
| Event | Description | Payload |
|-------|-------------|---------|
| `version.created` | New version saved | `{ promptId, versionId, number }` |
| `tag.moved` | Tag moved to new version | `{ promptId, tag, fromVersionId, toVersionId }` |
| `eval.completed` | Eval harness finished | `{ versionId, harnessId, status, score }` |
| `promotion.approved` | Staging → production allowed | `{ promptId, versionId, approvedBy }` |
| `promotion.rejected` | Promotion blocked by eval gate | `{ promptId, versionId, reason }` |

**Delivery Guarantees:** At-least-once with idempotency keys. Failed deliveries are retried with exponential backoff (up to 24h).

---

### 7. MCP Server

The MCP (Model Context Protocol) server exposes prompt management capabilities to AI agents.

#### Tool Definitions

```typescript
const tools: Tool[] = [
  {
    name: 'prompt.get',
    description: 'Retrieve the production version of a prompt for use in generation',
    inputSchema: {
      type: 'object',
      properties: {
        promptId: {
          type: 'string',
          description: 'The unique identifier of the prompt',
        },
        variables: {
          type: 'object',
          description: 'Variables to interpolate into the template',
          additionalProperties: { type: 'string' },
        },
        projectId: {
          type: 'string',
          description: 'Optional project override',
        },
      },
      required: ['promptId'],
    },
    handler: async (args) => {
      const version = await getProductionVersion(args.promptId, args.projectId);
      const rendered = renderTemplate(version.template, args.variables);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                version: version.number,
                content: version.content,
                rendered,
                metadata: version.metadata,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  },
  {
    name: 'prompt.diff',
    description: 'Compare two versions of a prompt to understand changes',
    inputSchema: {
      type: 'object',
      properties: {
        promptId: { type: 'string' },
        fromVersion: {
          type: 'string',
          description: "Source version (number or tag like 'production')",
        },
        toVersion: {
          type: 'string',
          description: "Target version (number or tag like 'staging')",
        },
      },
      required: ['promptId', 'fromVersion', 'toVersion'],
    },
    handler: async (args) => {
      const diff = await generateDiff(args.promptId, args.fromVersion, args.toVersion);
      return {
        content: [
          {
            type: 'text',
            text: formatDiff(diff),
          },
        ],
      };
    },
  },
  {
    name: 'prompt.metrics',
    description: 'Get performance metrics for a prompt version',
    inputSchema: {
      type: 'object',
      properties: {
        promptId: { type: 'string' },
        version: {
          type: 'string',
          description: 'Version number or tag (defaults to production)',
        },
        timeRange: {
          type: 'string',
          enum: ['1h', '24h', '7d', '30d'],
          default: '24h',
        },
        metricTypes: {
          type: 'array',
          items: { type: 'string', enum: ['cost', 'latency', 'quality'] },
          default: ['cost', 'latency', 'quality'],
        },
      },
      required: ['promptId'],
    },
    handler: async (args) => {
      const metrics = await getMetrics(
        args.promptId,
        args.version || 'production',
        args.timeRange,
        args.metricTypes,
      );
      return {
        content: [
          {
            type: 'text',
            text: formatMetrics(metrics),
          },
        ],
      };
    },
  },
];
```

#### MCP Server Configuration

```typescript
const server = new Server(
  {
    name: 'prompt-version-control',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: true,
    },
  },
);

// Register tools
tools.forEach((tool) => server.tool(tool.name, tool.inputSchema, tool.handler));

// Start server
const transport = new StdioServerTransport();
await server.connect(transport);
```

---

### 8. Caching Strategy

#### Multi-Layer Cache

```
┌─────────────────────────────────────────────────────────────┐
│                     Request Layer                            │
│  ┌─────────────────────────────────────────────────────────┐│
│  │              In-Memory Cache (L1)                        ││
│  │  • Hot data: production versions, active deployments    ││
│  │  • TTL: 1 minute                                         ││
│  │  • Size: 10MB per instance                               ││
│  └─────────────────────────────────────────────────────────┘│
│                           │                                  │
│                           ▼                                  │
│  ┌─────────────────────────────────────────────────────────┐│
│  │              Redis Cache (L2)                            ││
│  │  • Warm data: all versions, tags, metrics               ││
│  │  • TTL: 10 minutes                                       ││
│  │  • Shared across instances                               ││
│  └─────────────────────────────────────────────────────────┘│
│                           │                                  │
│                           ▼                                  │
│  ┌─────────────────────────────────────────────────────────┐│
│  │              PostgreSQL (Source of Truth)               ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

#### Cache Invalidation

```typescript
// Cache keys follow a consistent pattern
const cacheKeys = {
  productionVersion: (promptId: string) => `pv:${promptId}:prod`,
  version: (versionId: string) => `v:${versionId}`,
  tag: (promptId: string, tagName: string) => `t:${promptId}:${tagName}`,
  metrics: (versionId: string, range: string) => `m:${versionId}:${range}`,
};

// Invalidation on write
async function invalidateVersionCache(versionId: string) {
  const version = await getVersion(versionId);
  await redis.del([
    cacheKeys.version(versionId),
    cacheKeys.productionVersion(version.promptId),
    cacheKeys.tag(version.promptId, 'production'),
  ]);
}
```

---

### 9. Security Model

#### Authentication

```typescript
// API Key authentication
interface ApiKeyAuth {
  // Key format: pvc_<projectPrefix>_<randomBase58>
  // Example: pvc_proj_abc123_Hx9k2mN4pQ7r

  validate(key: string): Promise<{
    valid: boolean;
    project?: Project;
    permissions?: PermissionSet;
    error?: string;
  }>;
}

// Permission model
interface PermissionSet {
  prompts: {
    read: boolean;
    write: boolean;
    delete: boolean;
  };
  versions: {
    read: boolean;
    write: boolean;
    delete: boolean;
  };
  deployments: {
    read: boolean;
    write: boolean;
    delete: boolean;
  };
  metrics: {
    read: boolean;
    write: boolean;
  };
  admin: boolean; // Full access
}
```

#### Rate Limiting

```typescript
const rateLimits = {
  // Per API key
  default: {
    window: '1m',
    max: 100,
  },
  // Burst allowance
  burst: {
    window: '1s',
    max: 10,
  },
  // Expensive operations
  diff: {
    window: '1m',
    max: 20,
  },
  metrics: {
    window: '1m',
    max: 30,
  },
};
```

#### Audit Logging

Every mutation is logged with:

- Actor (API key ID)
- Action (create, update, delete)
- Resource (type + ID)
- Timestamp
- IP address
- Request ID
- Before/after state (for updates)

---

### 10. Deployment Architecture

#### Single Node (Development)

```yaml
# docker-compose.yml
services:
  pvc-server:
    image: prompt-version-control:latest
    ports:
      - '3000:3000'
    environment:
      DATABASE_URL: postgresql://postgres:password@db:5432/pvc
      REDIS_URL: redis://redis:6379
    depends_on:
      - db
      - redis

  db:
    image: postgres:16-alpine
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine

volumes:
  postgres_data:
```

#### Kubernetes (Production)

```yaml
# Deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: pvc-server
spec:
  replicas: 3
  selector:
    matchLabels:
      app: pvc-server
  template:
    spec:
      containers:
        - name: server
          image: prompt-version-control:latest
          ports:
            - containerPort: 3000
          env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: pvc-secrets
                  key: database-url
            - name: REDIS_URL
              valueFrom:
                secretKeyRef:
                  name: pvc-secrets
                  key: redis-url
          resources:
            requests:
              memory: '256Mi'
              cpu: '250m'
            limits:
              memory: '512Mi'
              cpu: '500m'
          livenessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 30
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /ready
              port: 3000
            initialDelaySeconds: 5
            periodSeconds: 5

---
# Service
apiVersion: v1
kind: Service
metadata:
  name: pvc-server
spec:
  selector:
    app: pvc-server
  ports:
    - port: 80
      targetPort: 3000
  type: ClusterIP

---
# Ingress
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: pvc-ingress
  annotations:
    nginx.ingress.kubernetes.io/rate-limit: '100'
    nginx.ingress.kubernetes.io/rate-limit-window: '1m'
spec:
  rules:
    - host: pvc.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: pvc-server
                port:
                  number: 80
```

---

### 11. Observability

#### Metrics (Prometheus)

```typescript
const metrics = {
  // Request metrics
  httpRequestDuration: new Histogram({
    name: 'pvc_http_request_duration_seconds',
    help: 'HTTP request duration in seconds',
    labelNames: ['method', 'route', 'status'],
    buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1],
  }),

  // Business metrics
  promptVersionsCreated: new Counter({
    name: 'pvc_prompt_versions_created_total',
    help: 'Total number of prompt versions created',
    labelNames: ['project'],
  }),

  evaluationsCompleted: new Counter({
    name: 'pvc_evaluations_completed_total',
    help: 'Total evaluations completed',
    labelNames: ['status'],
  }),

  deploymentsActive: new Gauge({
    name: 'pvc_deployments_active',
    help: 'Number of active deployments',
  }),
};
```

#### Structured Logging

```typescript
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => ({ level: label }),
  },
  redact: {
    paths: ['*.apiKey', '*.password', '*.secret', '*.keyHash'],
    censor: '[REDACTED]',
  },
});

// Every request logged with:
logger.info(
  {
    requestId: ctx.get('requestId'),
    method: ctx.req.method,
    path: ctx.req.url,
    statusCode: ctx.res.status,
    duration: ctx.get('duration'),
    apiKeyPrefix: ctx.get('apiKeyPrefix'),
    projectId: ctx.get('projectId'),
  },
  'request completed',
);
```

#### Distributed Tracing

```typescript
import { NodeSDK } from '@opentelemetry/sdk-node';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';

const sdk = new NodeSDK({
  traceExporter: new JaegerExporter({
    endpoint: process.env.JAEGER_ENDPOINT || 'http://localhost:14268/api/traces',
  }),
  instrumentations: [new HttpInstrumentation()],
  serviceName: 'prompt-version-control',
});

// Each request gets a trace:
// - Authentication
// - Database query
// - Cache lookup
// - Business logic
// - Response serialization
```

---

### 12. Error Handling

#### Error Hierarchy

```typescript
class AppError extends Error {
  constructor(
    public code: string,
    public status: number,
    message: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

// Specific error types
class ValidationError extends AppError {
  constructor(details: Record<string, string[]>) {
    super('VALIDATION_ERROR', 400, 'Request validation failed', { fields: details });
  }
}

class NotFoundError extends AppError {
  constructor(resource: string, id: string) {
    super('NOT_FOUND', 404, `${resource} with id ${id} not found`);
  }
}

class ConflictError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('CONFLICT', 409, message, details);
  }
}

class RateLimitError extends AppError {
  constructor(retryAfter: number) {
    super('RATE_LIMIT_EXCEEDED', 429, 'Rate limit exceeded', { retryAfter });
  }
}
```

#### Error Response Format

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": {
      "fields": {
        "name": ["Required"],
        "template": ["Must be valid template syntax (unclosed variable brace)"]
      }
    }
  },
  "requestId": "req_abc123",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

---

### 13. Data Migration Strategy

#### Schema Migrations

- All migrations managed by Prisma
- Migration files versioned in git
- Automatic migration on startup (dev)
- Manual migration approval (production)

#### Data Backfill

```typescript
// Example: Backfill checksum for existing versions
async function backfillChecksums() {
  const versions = await db.version.findMany({
    where: { checksum: null },
    take: 1000,
  });

  for (const version of versions) {
    const checksum = crypto.createHash('sha256').update(version.content).digest('hex');

    await db.version.update({
      where: { id: version.id },
      data: { checksum },
    });
  }
}
```

---

### 14. Backup & Disaster Recovery

#### Database Backups

- **Automated**: Daily `pg_dump` to object storage (S3-compatible) with 30-day retention
- **Point-in-Time**: WAL archiving to S3 for PITR (requires PostgreSQL `archive_mode = on`)
- **Cross-Region**: Replicate backups to secondary region for DR

#### Recovery Procedures

| Scenario                 | RTO     | RPO      | Procedure                                           |
| ------------------------ | ------- | -------- | --------------------------------------------------- |
| Accidental data deletion | 1 hour  | 0        | Restore from latest snapshot, replay WAL            |
| Database corruption      | 2 hours | < 5 min  | Failover to read replica, promote to primary        |
| Region outage            | 4 hours | < 15 min | Restore from cross-region backup to standby cluster |
| Complete cluster loss    | 8 hours | < 1 hour | Restore latest dump, re-run migrations, warm caches |

#### Cache Recovery

- Redis is a cache layer only — no persistence required
- On restart, cache warms via lazy-loading from PostgreSQL
- Critical paths (production version lookups) have in-memory L1 fallback

---

## API Reference Summary

### Prompts

| Method | Endpoint               | Description    |
| ------ | ---------------------- | -------------- |
| POST   | `/api/v1/prompts`      | Create prompt  |
| GET    | `/api/v1/prompts`      | List prompts   |
| GET    | `/api/v1/prompts/{id}` | Get prompt     |
| PUT    | `/api/v1/prompts/{id}` | Update prompt  |
| DELETE | `/api/v1/prompts/{id}` | Archive prompt |

### Versions

| Method | Endpoint                              | Description    |
| ------ | ------------------------------------- | -------------- |
| POST   | `/api/v1/prompts/{id}/versions`       | Create version |
| GET    | `/api/v1/prompts/{id}/versions`       | List versions  |
| GET    | `/api/v1/prompts/{id}/versions/{vid}` | Get version    |
| GET    | `/api/v1/prompts/{id}/diff`           | Diff versions  |

### Tags

| Method | Endpoint                           | Description            |
| ------ | ---------------------------------- | ---------------------- |
| POST   | `/api/v1/prompts/{id}/tags/{name}` | Move tag to version    |
| GET    | `/api/v1/prompts/{id}/tags`        | List tags              |
| GET    | `/api/v1/prompts/{id}/tags/{name}` | Resolve tag to version |
| DELETE | `/api/v1/prompts/{id}/tags/{name}` | Remove tag             |

### Deployments

| Method | Endpoint                           | Description       |
| ------ | ---------------------------------- | ----------------- |
| POST   | `/api/v1/deployments`              | Create deployment |
| GET    | `/api/v1/deployments`              | List deployments  |
| GET    | `/api/v1/deployments/{id}/resolve` | Resolve version   |
| PUT    | `/api/v1/deployments/{id}`         | Update deployment |

### Metrics

| Method | Endpoint                        | Description         |
| ------ | ------------------------------- | ------------------- |
| POST   | `/api/v1/metrics/ingest`        | Ingest metrics      |
| GET    | `/api/v1/prompts/{id}/metrics`  | Get metrics         |
| GET    | `/api/v1/versions/{id}/metrics` | Get version metrics |

### Evaluations

| Method | Endpoint                            | Description  |
| ------ | ----------------------------------- | ------------ |
| POST   | `/api/v1/evaluations/trigger`       | Trigger eval |
| POST   | `/api/v1/evaluations/webhook`       | Eval webhook |
| GET    | `/api/v1/versions/{id}/evaluations` | Get evals    |

### Webhooks

| Method | Endpoint                     | Description         |
| ------ | ---------------------------- | ------------------- |
| POST   | `/api/v1/webhooks`           | Create subscription |
| GET    | `/api/v1/webhooks`           | List subscriptions  |
| DELETE | `/api/v1/webhooks/{id}`      | Remove subscription |
| POST   | `/api/v1/webhooks/{id}/test` | Test delivery       |

---

## Conclusion

This architecture provides a robust, scalable foundation for prompt version control with:

1. **Git-like Semantics**: Familiar versioning model for developers
2. **Quality Gates**: Eval-driven promotion ensures reliability
3. **Production Ready**: Observability, security, and performance built-in
4. **Extensible**: Plugin architecture for eval harnesses and metrics
5. **Self-Hosted**: Full control over data and infrastructure

The modular design allows teams to adopt features incrementally while maintaining a coherent system architecture.
