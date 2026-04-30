# @reaatech/prompt-version-control-shared

[![npm version](https://img.shields.io/npm/v/@reaatech/prompt-version-control-shared.svg)](https://www.npmjs.com/package/@reaatech/prompt-version-control-shared)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/reaatech/prompt-version-control/blob/main/LICENSE)
[![CI](https://img.shields.io/github/actions/workflow/status/reaatech/prompt-version-control/ci.yml?branch=main&label=CI)](https://github.com/reaatech/prompt-version-control/actions/workflows/ci.yml)

> **Status:** Pre-1.0 — APIs may change in minor versions. Pin to a specific version in production.

Canonical TypeScript types, Zod schemas, and shared utilities for Prompt Version Control. This package is the single source of truth for all protocol shapes used throughout the `@reaatech/prompt-version-control-*` ecosystem.

## Installation

```bash
npm install @reaatech/prompt-version-control-shared
# or
pnpm add @reaatech/prompt-version-control-shared
```

## Feature Overview

- **25+ Zod schemas** — runtime validation for API inputs and outputs
- **Fully inferred types** — every schema exports a matching `z.infer<typeof>` type for compile-time safety
- **Template rendering** — Handlebars-based prompt interpolation with variable tracking and missing-variable analysis
- **API key utilities** — SHA-256 hashing, HMAC with pepper, and `pvc_` prefix key generation
- **Checksumming** — SHA-256 content checksums for deduplication and diffing
- **Zero runtime dependencies beyond `zod` and `handlebars`** — lightweight and tree-shakeable

## Quick Start

```typescript
import {
  CreatePromptSchema,
  calculateChecksum,
  renderTemplate,
  generateApiKey,
  type Prompt,
} from "@reaatech/prompt-version-control-shared";

// Validate at the boundary
const raw = JSON.parse(inputJson);
const input = CreatePromptSchema.parse(raw);

// Hash prompt content
const checksum = calculateChecksum("You are a helpful assistant. Help with: {{topic}}");

// Render a template with variables
const result = renderTemplate(
  "Hello, {{name}}! Your order #{{orderId}} is ready.",
  { name: "Alice", orderId: "12345" }
);
console.log(result.rendered);            // "Hello, Alice! Your order #12345 is ready."
console.log(result.variablesUsed);       // ["name", "orderId"]
console.log(result.missingVariables);    // [] (all provided)

// Generate an API key
const apiKey = generateApiKey("my-pepper");
// Returns: { key: "pvc_abc123...", prefix: "pvc_", hash: "<hmac>" }
```

## Exports

### Zod Schemas

All schemas are exported as both a schema (for runtime validation) and an inferred type (for TypeScript). Use the schema for parsing, the type for annotating.

#### Core Schemas

| Schema | Description |
|--------|-------------|
| `IdSchema` | `z.string().cuid2()` — common ID validator |
| `PaginationSchema` | `{ limit, cursor }` — cursor-based pagination params |
| `PaginatedResponseSchema(item)` | Factory producing `{ data: T[], meta: { limit, nextCursor?, total? } }` |

#### Projects

| Schema | Description |
|--------|-------------|
| `CreateProjectSchema` | `{ name, slug, settings? }` |
| `ProjectSchema` | Full project with id, timestamps |

#### Prompts & Versions

| Schema | Description |
|--------|-------------|
| `CreatePromptSchema` | `{ name, description?, template, variables?, metadata? }` |
| `UpdatePromptSchema` | Partial of Create, omitting `name` |
| `PromptSchema` | Full prompt: id, projectId, name, template, archived, timestamps |
| `CreateVersionSchema` | `{ content, template, variables?, metadata? }` |
| `VersionSchema` | Full version: id, promptId, number, checksum, timestamps |

#### Tags

| Schema | Description |
|--------|-------------|
| `TagNameSchema` | `z.enum(['draft', 'staging', 'production'])` |
| `MoveTagSchema` | `{ versionId }` — move a tag to a specific version |
| `TagSchema` | Full tag: promptId, name, versionId, movedAt |

#### Diffing

| Schema | Description |
|--------|-------------|
| `DiffRequestSchema` | `{ fromVersion, toVersion }` |
| `DiffSectionSchema` | `{ type: 'added'|'removed'|'modified', value, lineStart?, lineEnd? }` |
| `DiffResultSchema` | `{ fromVersion, toVersion, sections: DiffSection[], semanticImpact: 'none'|'minor'|'major' }` |

#### Evaluations

| Schema | Description |
|--------|-------------|
| `EvalStatusSchema` | `z.enum(['pending', 'running', 'passed', 'failed', 'error'])` |
| `EvaluationSchema` | Full evaluation: id, versionId, status, results, timestamps |

#### Metrics

| Schema | Description |
|--------|-------------|
| `MetricTypeSchema` | `z.enum(['cost', 'latency', 'quality'])` |
| `IngestMetricSchema` | `{ versionId, type, name, value, unit, timestamp?, dimensions? }` |
| `MetricSchema` | Full metric: id, versionId, type, name, value, unit, timestamps |

#### API Keys

| Schema | Description |
|--------|-------------|
| `CreateApiKeySchema` | `{ name, permissions?, expiresAt? }` |
| `ApiKeySchema` | Full key: id, name, prefix, permissions, expiresAt, timestamps |

### App-Level Interfaces

| Interface | Description |
|-----------|-------------|
| `AppErrorDetails` | `{ code, status, message, details? }` — structured error shape |
| `AuditLogEntry` | Full audit trail record with actor, action, resource, and payload diffs |
| `PromotionResult` | `{ allowed, reason?, evaluations? }` — eval-gated promotion outcome |
| `TemplateVariable` | `{ type: 'string'|'number'|'boolean'|'enum', required?, default?, enumValues? }` |
| `RenderedPrompt` | `{ version, content, rendered, variablesUsed, missingVariables, metadata }` |

### Utility Functions

| Function | Signature | Description |
|----------|-----------|-------------|
| `calculateChecksum` | `(content: string) => string` | SHA-256 hex hash of content |
| `hashApiKey` | `(key: string, pepper?: string) => string` | HMAC-SHA-256 with optional pepper |
| `generateApiKey` | `(pepper?: string) => { key, prefix, hash }` | Generate `pvc_`-prefixed API key |
| `sleep` | `(ms: number) => Promise<void>` | Promise-based delay |
| `pick` | `<T, K>(obj: T, keys: K[]) => Pick<T, K>` | Utility object picker |

### Template Rendering

| Export | Description |
|--------|-------------|
| `renderTemplate(template, variables?)` | Handlebars interpolation with `noEscape`. Returns `{ rendered: string, variablesUsed: string[], missingVariables: string[] }` |
| `RenderTemplateResult` | Return type of `renderTemplate` |

## Usage Patterns

### Schema + Type Pairing

Every schema has a matching type. Use the schema at boundaries and the type everywhere else:

```typescript
import { VersionSchema, type Version } from "@reaatech/prompt-version-control-shared";

function handleResponse(raw: unknown): Version {
  // Parse at the boundary — throws ZodError on invalid data
  return VersionSchema.parse(raw);
}
```

### Template Rendering

```typescript
import { renderTemplate } from "@reaatech/prompt-version-control-shared";

const result = renderTemplate(
  "You are a {{role}}. Respond to: {{query}}",
  { role: "support agent" }
);

// result.rendered === "You are a support agent. Respond to: "
// result.variablesUsed === ["role"]
// result.missingVariables === ["query"]  ← not provided, highlighted for debugging
```

### API Key Generation & Verification

```typescript
import { generateApiKey, hashApiKey } from "@reaatech/prompt-version-control-shared";

const pepper = process.env.API_KEY_PEPPER;

// Generate a new key
const { key, prefix, hash } = generateApiKey(pepper);
// Store `hash` in the database, return `key` to the user once

// Verify an incoming key
const incomingHash = hashApiKey(incomingKey, pepper);
const storedKey = await db.apiKey.findUnique({ where: { hash: incomingHash } });
```

### Checksum-Based Deduplication

```typescript
import { calculateChecksum } from "@reaatech/prompt-version-control-shared";

const content = "You are a helpful assistant. Help with: {{topic}}";
const checksum = calculateChecksum(content);

// Only create a new version if content actually changed
const existing = await db.version.findFirst({ where: { promptId, checksum } });
if (existing) {
  console.log(`Content unchanged — existing version: ${existing.number}`);
  return existing;
}
```

## Related Packages

- [`@reaatech/prompt-version-control`](https://www.npmjs.com/package/@reaatech/prompt-version-control) — TypeScript SDK (depends on this package)
- [`@reaatech/prompt-version-control-server`](https://www.npmjs.com/package/@reaatech/prompt-version-control-server) — API server (validates with these schemas)
- [`@reaatech/prompt-version-control-cli`](https://www.npmjs.com/package/@reaatech/prompt-version-control-cli) — CLI tool
- [`@reaatech/prompt-version-control-mcp`](https://www.npmjs.com/package/@reaatech/prompt-version-control-mcp) — MCP server

## License

[MIT](https://github.com/reaatech/prompt-version-control/blob/main/LICENSE)
