# Prompt Version Control

> Git-like versioning for AI prompts with eval-gated promotion

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)
[![pnpm](https://img.shields.io/badge/pnpm-9.x-orange)](https://pnpm.io/)

## Overview

Every team stores prompts as strings in code or config, edits them ad-hoc, and has no idea which version performed better. **Prompt Version Control** solves this by providing Git-like versioning for AI prompts with eval-gated promotion workflows.

### Key Features

- **Version management** — store and track prompt versions with full metadata
- **Lifecycle control** — tag prompts as draft/staging/production
- **Quality gates** — gate staging→production promotion on eval results
- **A/B testing** — serve multiple versions with configurable traffic splitting
- **Metrics tracking** — monitor per-version cost, latency, and quality
- **MCP integration** — agents pull managed prompts at runtime

## Quick Start

### Prerequisites

- Node.js 22+
- PostgreSQL 16+
- Redis 7+
- pnpm 9+

### Installation

```bash
# Clone the repository
git clone https://github.com/reaatech/prompt-version-control.git
cd prompt-version-control

# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env

# Start development environment
pnpm dev
```

### Using the CLI

```bash
# Configure the CLI (writes ~/.pvcrc with mode 0600)
pvc init --api-url http://localhost:3000 --api-key "$PVC_API_KEY"

# Create a new prompt
pvc prompt create -n customer-support -t "You are a helpful support agent. Help with: {{issue}}"

# Create a new version (uses --content as template if --template is omitted)
pvc version create -p customer-support -c "You are a senior support agent. Help with: {{issue}}"

# Tag version 2 as production (accepts a version number or a version id)
pvc tag set -p customer-support -v 2 -t production

# Get the prompt (id or name)
pvc prompt get customer-support
```

### Using the API

```bash
# Create a prompt
curl -X POST http://localhost:3000/api/v1/prompts \
  -H "Authorization: Bearer your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "customer-support",
    "template": "You are a helpful support agent. Help with: {{issue}}"
  }'

# Get production version
curl http://localhost:3000/api/v1/prompts/<promptId>/production \
  -H "Authorization: Bearer your-api-key"
```

### Using with MCP

The MCP server ships as a separate binary `pvc-mcp` from `@pvc/mcp`. Add to your Claude Desktop configuration:

```json
{
  "mcpServers": {
    "prompt-version-control": {
      "command": "pvc-mcp",
      "env": {
        "PVC_API_URL": "http://localhost:3000",
        "PVC_API_KEY": "your-api-key"
      }
    }
  }
}
```

The server currently exposes:

- `prompt.get` — retrieve the production version of a prompt with optional variable substitution

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

- [Development Plan](./DEV_PLAN.md) — phased development roadmap
- [Architecture](./ARCHITECTURE.md) — detailed system design and technical specs
- [Security policy](./SECURITY.md) — how to report vulnerabilities
- [API reference](./docs/api/openapi.yaml) — OpenAPI 3.0 spec (Swagger UI at `/api/v1/docs`)

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
└── .github/              # CI/CD workflows
```

## Tech Stack

- **Runtime**: Node.js 22+ (LTS)
- **Language**: TypeScript 5.x (strict mode)
- **Package manager**: pnpm 9.x
- **Database**: PostgreSQL 16+ with Prisma ORM
- **API framework**: Hono 4.x
- **CLI framework**: Clipanion 4.x
- **MCP server**: @modelcontextprotocol/sdk
- **Testing**: Vitest 2.x
- **Validation**: Zod 3.x
- **Logging**: Pino 9.x
- **Metrics**: Prometheus client

## Development

### Running Tests

```bash
# Run all tests
pnpm test

# Run with coverage
pnpm test:coverage

# Run a specific test file
pnpm --filter @pvc/server test packages/server/src/services/__tests__/prompt.service.test.ts
```

### Code Quality

```bash
# Lint
pnpm lint
pnpm format

# Type check
pnpm typecheck
```

## Deployment

### Docker

```bash
# Build the production image (run from repo root)
docker build -f deployments/docker/Dockerfile -t prompt-version-control:latest .

# Run the dev stack (postgres + redis + server with hot reload)
docker compose -f deployments/docker/docker-compose.yml up -d
```

### Kubernetes

```bash
# Deploy with Helm (provide secrets at install time — never commit them)
helm install pvc ./deployments/helm/pvc \
  --namespace prompt-version-control \
  --create-namespace \
  --set postgresql.auth.password="$POSTGRES_PASSWORD" \
  --set redis.auth.password="$REDIS_PASSWORD" \
  --set secrets.JWT_SECRET="$JWT_SECRET" \
  --set secrets.API_KEY_PEPPER="$API_KEY_PEPPER" \
  --set secrets.EVAL_WEBHOOK_SECRET="$EVAL_WEBHOOK_SECRET" \
  --set secrets.DATABASE_URL="$DATABASE_URL" \
  --set secrets.REDIS_PASSWORD="$REDIS_PASSWORD"
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

See [CONTRIBUTING.md](./CONTRIBUTING.md) for details.

## License

MIT License — see [LICENSE](./LICENSE) for details.

## Support

- **GitHub Issues**: [reaatech/prompt-version-control/issues](https://github.com/reaatech/prompt-version-control/issues)
- **Security**: see [SECURITY.md](./SECURITY.md)
- **Documentation**: [docs/](./docs/)

---

Built by [Reaa](https://github.com/reaatech)
