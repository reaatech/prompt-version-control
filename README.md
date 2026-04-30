# prompt-version-control

[![CI](https://github.com/reaatech/prompt-version-control/actions/workflows/ci.yml/badge.svg)](https://github.com/reaatech/prompt-version-control/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue)](https://www.typescriptlang.org/)

> Git-like versioning for AI prompts with eval-gated promotion.

This monorepo provides an API server, TypeScript SDK, CLI tool, and MCP server for version-controlling AI prompts — track changes, gate promotions on evaluation results, serve A/B deployments, and let agents pull managed prompts at runtime.

## Features

- **Version management** — store and track prompt versions with SHA-256 checksums and automatic numbering
- **Tag-based lifecycle** — resolve prompts by `draft`, `staging`, and `production` tags
- **Evaluation gates** — block staging→production promotion on eval harness results
- **A/B deployments** — serve multiple versions with weighted traffic splitting and sticky sessions
- **Semantic diffing** — compare versions with line-level diffs and semantic impact scoring
- **Metrics tracking** — monitor per-version cost, latency, and quality metrics
- **MCP integration** — AI agents pull managed prompts at runtime via the Model Context Protocol
- **Structured logging** — Pino-based JSON logging with pretty-printing in development
- **Prometheus metrics** — built-in `/metrics` endpoint for monitoring

## Installation

### Using the packages

Packages are published under the `@reaatech` scope and can be installed individually:

```bash
# API server (Hono + Prisma)
pnpm add @reaatech/prompt-version-control-server

# TypeScript SDK
pnpm add @reaatech/prompt-version-control

# CLI tool
pnpm add -g @reaatech/prompt-version-control-cli

# MCP server for AI agents
pnpm add -g @reaatech/prompt-version-control-mcp

# Shared types and utilities
pnpm add @reaatech/prompt-version-control-shared
```

### Contributing

```bash
# Clone the repository
git clone https://github.com/reaatech/prompt-version-control.git
cd prompt-version-control

# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env

# Generate Prisma client and run migrations
pnpm --filter @reaatech/prompt-version-control-server db:generate
pnpm --filter @reaatech/prompt-version-control-server db:migrate

# Start development server with hot reload
pnpm dev

# Run the test suite
pnpm test

# Run linting
pnpm lint
```

## Quick Start

### Using the CLI

```bash
# Configure the CLI (writes ~/.pvcrc with mode 0600)
pvc init --api-url http://localhost:3000 --api-key "pvc_your-api-key"

# Create a new prompt
pvc prompt create -n customer-support -t "You are a helpful support agent. Help with: {{issue}}"

# Create a new version
pvc version create -p customer-support -c "You are a senior support agent. Help with: {{issue}}"

# Tag version 2 as production
pvc tag set -p customer-support -v 2 -t production

# Get the prompt
pvc prompt get customer-support
```

### Using the SDK

```typescript
import { PromptVersionControlClient } from "@reaatech/prompt-version-control";

const client = new PromptVersionControlClient({
  baseUrl: "http://localhost:3000",
  apiKey: "pvc_your-api-key",
  cache: true,
});

const prod = await client.getProduction("customer-support");
console.log(prod.content);
```

### Using with MCP (Claude Desktop)

```json
{
  "mcpServers": {
    "prompt-version-control": {
      "command": "pvc-mcp",
      "env": {
        "PVC_API_URL": "http://localhost:3000",
        "PVC_API_KEY": "pvc_your-api-key"
      }
    }
  }
}
```

## Packages

| Package | Description |
| ------- | ----------- |
| [`@reaatech/prompt-version-control-server`](./packages/server) | API server with prompt CRUD, versioning, eval-gated promotion, A/B deployments |
| [`@reaatech/prompt-version-control`](./packages/sdk) | TypeScript SDK with retry logic and caching |
| [`@reaatech/prompt-version-control-cli`](./packages/cli) | `pvc` CLI tool for managing prompts from the terminal |
| [`@reaatech/prompt-version-control-mcp`](./packages/mcp) | MCP server exposing prompt retrieval to AI agents |
| [`@reaatech/prompt-version-control-shared`](./packages/shared) | Canonical types, Zod schemas, and utilities |

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Client Layer                            │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐ │
│  │    CLI    │  │    SDK    │  │    MCP    │  │   APIs    │ │
│  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘ │
└────────┼──────────────┼──────────────┼──────────────┼────────┘
         └──────────────┴──────┬───────┴──────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                     API Server (Hono)                        │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  Auth │ Rate Limit │ Validation │ Logging │ OpenAPI    ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────┬───────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Data Layer                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  PostgreSQL  │  │    Redis     │  │   Metrics    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

## Documentation

- [Architecture](./ARCHITECTURE.md) — detailed system design and technical specs
- [Development Plan](./DEV_PLAN.md) — phased development roadmap
- [Security policy](./SECURITY.md) — how to report vulnerabilities
- [Contributing](./CONTRIBUTING.md) — contribution workflow
- [API reference](./docs/api/openapi.yaml) — OpenAPI 3.0 spec (Swagger UI at `/api/v1/docs`)

## Tech Stack

- **Runtime**: Node.js 22+ (LTS)
- **Language**: TypeScript 5.x (strict mode)
- **Package manager**: pnpm 9.x
- **Database**: PostgreSQL 16+ with Prisma ORM
- **Cache**: Redis 7+
- **API framework**: Hono 4.x
- **CLI framework**: Clipanion 4.x
- **MCP server**: @modelcontextprotocol/sdk
- **Testing**: Vitest 2.x
- **Validation**: Zod 3.x
- **Logging**: Pino 9.x
- **Metrics**: Prometheus client
- **Templating**: Handlebars

## Project Structure

```
prompt-version-control/
├── packages/
│   ├── server/           # Main API server (Hono)
│   ├── cli/              # CLI tool (Clipanion)
│   ├── sdk/              # TypeScript SDK
│   ├── mcp/              # MCP server (@modelcontextprotocol/sdk)
│   └── shared/           # Shared types & utilities
├── deployments/
│   ├── docker/           # Docker configuration
│   ├── kubernetes/       # K8s manifests
│   └── helm/             # Helm charts
├── docs/
│   └── api/              # OpenAPI spec
├── skills/               # AI agent skill definitions
└── .github/              # CI/CD workflows
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

See [CONTRIBUTING.md](./CONTRIBUTING.md) for details.

## License

[MIT](LICENSE)

---

Built by [Reaa](https://github.com/reaatech)
