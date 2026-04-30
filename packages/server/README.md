# @reaatech/prompt-version-control-server

[![npm version](https://img.shields.io/npm/v/@reaatech/prompt-version-control-server.svg)](https://www.npmjs.com/package/@reaatech/prompt-version-control-server)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/reaatech/prompt-version-control/blob/main/LICENSE)
[![CI](https://img.shields.io/github/actions/workflow/status/reaatech/prompt-version-control/ci.yml?branch=main&label=CI)](https://github.com/reaatech/prompt-version-control/actions/workflows/ci.yml)

> **Status:** Pre-1.0 — APIs may change in minor versions. Pin to a specific version in production.

Prompt Version Control API server providing Git-like versioning for AI prompts with eval-gated promotion, A/B deployment, metrics collection, and webhook integrations. Built on [Hono 4](https://hono.dev) with [Prisma](https://prisma.io) and PostgreSQL.

## Installation

```bash
npm install @reaatech/prompt-version-control-server
# or
pnpm add @reaatech/prompt-version-control-server
```

## Feature Overview

- **Prompt CRUD** — create, read, update, and archive prompts with automatic version numbering
- **Version management** — store and track prompt versions with SHA-256 checksums for deduplication
- **Tag-based lifecycle** — resolve versions by `draft`, `staging`, and `production` tags
- **Evaluation gates** — block staging→production promotion on eval harness results
- **A/B deployments** — serve multiple versions with weighted traffic splitting and sticky sessions
- **Semantic diffing** — compare versions with line-level diffs and semantic impact scoring
- **Metrics ingestion** — track per-version cost, latency, and quality metrics
- **Promotion workflows** — promote/rollback production with audit trails
- **Webhook subscriptions** — notify external systems on version creation, tag changes, and evaluations
- **Structured logging** — Pino-based JSON logging with automatic pretty-printing in development
- **Prometheus metrics** — built-in `/metrics` endpoint for monitoring
- **API key auth** — scoped API keys with HMAC verification and audit logging
- **Swagger UI** — OpenAPI 3.0 spec served at `/api/v1/docs`

## Quick Start

### Development

```bash
# Set up environment
cp .env.example .env

# Install dependencies
pnpm install

# Generate Prisma client
pnpm --filter @reaatech/prompt-version-control-server db:generate

# Run migrations
pnpm --filter @reaatech/prompt-version-control-server db:migrate

# Seed the database
pnpm --filter @reaatech/prompt-version-control-server db:seed

# Start development server with hot reload
pnpm --filter @reaatech/prompt-version-control-server dev
```

### Programmatic

```typescript
import { app } from "@reaatech/prompt-version-control-server";
import { serve } from "@hono/node-server";

serve({ fetch: app.fetch, port: 3000 }, (info) => {
  console.log(`Server running on http://localhost:${info.port}`);
});
```

## API Reference

### Infrastructure Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check — returns `{ status: "ok", timestamp }` |
| `GET` | `/ready` | Readiness check — returns `{ status: "ready" }` |
| `GET` | `/metrics` | Prometheus text-format metrics |
| `GET` | `/api/v1/docs` | Swagger UI |
| `GET` | `/api/v1/docs/openapi.yaml` | Raw OpenAPI 3.0 spec |

All API routes are prefixed with `/api/v1` and require `Authorization: Bearer <api-key>` unless noted.

### Prompts

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/prompts` | List prompts (paginated: `?limit=20&cursor=...`) |
| `POST` | `/api/v1/prompts` | Create prompt |
| `GET` | `/api/v1/prompts/:id` | Get prompt by ID |
| `PUT` | `/api/v1/prompts/:id` | Update prompt |
| `DELETE` | `/api/v1/prompts/:id` | Archive prompt |
| `GET` | `/api/v1/prompts/:id/versions` | List versions for prompt (paginated) |
| `POST` | `/api/v1/prompts/:id/versions` | Create version (auto-increments `number`) |
| `GET` | `/api/v1/prompts/:id/versions/:vid` | Get specific version |
| `GET` | `/api/v1/prompts/:id/production` | Get production-tagged version |
| `GET` | `/api/v1/prompts/:id/diff` | Diff two versions (`?fromVersion=X&toVersion=Y`) |

### Tags

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/prompts/:id/tags` | List tags for prompt |
| `POST` | `/api/v1/prompts/:id/tags/:name` | Set tag to a version (`{ versionId }` in body) |
| `GET` | `/api/v1/prompts/:id/tags/:name` | Get tag details |
| `DELETE` | `/api/v1/prompts/:id/tags/:name` | Remove tag |

Tag names: `draft`, `staging`, `production`. Only one version can hold a given tag at a time.

### Promotions

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/prompts/:id/promote` | Promote staging → production (gated by eval) |
| `POST` | `/api/v1/prompts/:id/promote/override` | Force-promote a specific version (`{ versionId }` in body) |
| `POST` | `/api/v1/prompts/:id/rollback` | Rollback production to previous version |

The `promote` endpoint checks the evaluation gate: if the staging version has failed evaluations, the promotion is blocked.

### Evaluations

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/evaluations/webhook` | Receive eval harness webhook (public, HMAC-authenticated) |
| `POST` | `/api/v1/evaluations/trigger` | Trigger evaluation (`{ versionId }` in body) |
| `GET` | `/api/v1/evaluations/versions/:versionId` | List evaluations for a version |
| `GET` | `/api/v1/evaluations/versions/:versionId/gate` | Get promotion gate status |

### Metrics

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/metrics/ingest` | Ingest metrics (array of metric objects in body) |
| `GET` | `/api/v1/metrics/versions/:versionId` | Get metrics for version (`?hours=24` optional) |
| `GET` | `/api/v1/metrics/prompts/:promptId` | Get metrics for prompt (`?hours=24` optional) |

Metric types: `cost`, `latency`, `quality`.

### Deployments

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/deployments` | Create deployment with weighted variants |
| `GET` | `/api/v1/deployments` | List deployments (`?promptId=` filter optional) |
| `GET` | `/api/v1/deployments/:id/resolve` | Resolve version for session (`?sessionId=`) |
| `PUT` | `/api/v1/deployments/:id` | Update deployment status (`active`/`paused`/`archived`) |

### Render

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/prompts/:id/versions/:number/render` | Render specific version with variables |
| `POST` | `/api/v1/prompts/:id/render` | Render production version with variables |

Both accept `{ variables: Record<string, unknown> }` in the body and return the rendered output with variable usage metadata.

### Webhooks

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/webhooks` | Create webhook subscription |
| `GET` | `/api/v1/webhooks` | List subscriptions |
| `DELETE` | `/api/v1/webhooks/:id` | Delete subscription |
| `POST` | `/api/v1/webhooks/:id/test` | Test delivery |

### Middleware Stack

All API routes pass through:

| Middleware | Description |
|------------|-------------|
| `requestIdMiddleware` | Assigns `requestId` to every request context |
| `compress()` | gzip/deflate response compression |
| `cors()` | Configurable via `CORS_ALLOWED_ORIGINS` env var |
| `rateLimit()` | 100 requests per 60-second window per IP |
| `metricsMiddleware` | Prometheus metrics collection |
| `auth` | Bearer API key verification via HMAC |

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `REDIS_URL` | Yes | — | Redis connection string |
| `NODE_ENV` | No | `development` | Environment (`development` enables pretty logging) |
| `PORT` | No | `3000` | Server listen port |
| `LOG_LEVEL` | No | `info` | Pino log level |
| `JWT_SECRET` | No | — | HMAC pepper for API key hashing |
| `API_KEY_PEPPER` | No | — | Additional pepper for API key HMAC |
| `EVAL_WEBHOOK_SECRET` | No | — | HMAC secret for eval webhook verification |
| `CORS_ALLOWED_ORIGINS` | No | `*` | CORS allowed origins |

## Usage Patterns

### Create a Prompt with Versions

```bash
# Create a prompt
curl -X POST http://localhost:3000/api/v1/prompts \
  -H "Authorization: Bearer pvc_your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "customer-support",
    "template": "You are a helpful support agent. Help with: {{issue}}"
  }'

# Create a version
curl -X POST http://localhost:3000/api/v1/prompts/<promptId>/versions \
  -H "Authorization: Bearer pvc_your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "You are a senior support agent. Help with: {{issue}}"
  }'

# Tag as production
curl -X POST http://localhost:3000/api/v1/prompts/<promptId>/tags/production \
  -H "Authorization: Bearer pvc_your-api-key" \
  -H "Content-Type: application/json" \
  -d '{ "versionId": "<versionId>" }'
```

### Render a Prompt with Variables

```bash
curl -X POST http://localhost:3000/api/v1/prompts/<promptId>/render \
  -H "Authorization: Bearer pvc_your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "variables": { "issue": "I cannot log in to my account" }
  }'
```

### A/B Deployment

```bash
curl -X POST http://localhost:3000/api/v1/deployments \
  -H "Authorization: Bearer pvc_your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "promptId": "<promptId>",
    "variants": [
      { "versionId": "<versionA>", "weight": 90 },
      { "versionId": "<versionB>", "weight": 10 }
    ]
  }'

# Resolve for a session
curl "http://localhost:3000/api/v1/deployments/<deploymentId>/resolve?sessionId=user-123" \
  -H "Authorization: Bearer pvc_your-api-key"
```

## Related Packages

- [`@reaatech/prompt-version-control-shared`](https://www.npmjs.com/package/@reaatech/prompt-version-control-shared) — Shared types and schemas
- [`@reaatech/prompt-version-control`](https://www.npmjs.com/package/@reaatech/prompt-version-control) — TypeScript SDK
- [`@reaatech/prompt-version-control-cli`](https://www.npmjs.com/package/@reaatech/prompt-version-control-cli) — CLI tool
- [`@reaatech/prompt-version-control-mcp`](https://www.npmjs.com/package/@reaatech/prompt-version-control-mcp) — MCP server for AI agents

## License

[MIT](https://github.com/reaatech/prompt-version-control/blob/main/LICENSE)
