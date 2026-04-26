# @pvc/server

Prompt Version Control API server.

## Overview

The `@pvc/server` package provides the core REST API for prompt versioning, evaluation-gated promotions, A/B deployments, and metrics collection. Built on [Hono](https://hono.dev) with [Prisma](https://prisma.io) and PostgreSQL.

## Features

- Prompt CRUD with automatic version numbering
- Tag-based version resolution (`production`, `staging`, etc.)
- Evaluation harness integration with promotion gates
- A/B deployments with weighted variants and sticky sessions
- Structured logging (Pino) and Prometheus metrics
- API key authentication with audit logging

## Development

```bash
# Generate Prisma client
pnpm db:generate

# Run database migrations
pnpm db:migrate

# Seed the database
pnpm db:seed

# Start development server with hot reload
pnpm dev

# Run tests
pnpm test

# Run tests with coverage
pnpm test:coverage
```

## Environment Variables

See the root `.env.example` for all required and optional environment variables.
