# @reaatech/prompt-version-control-server

## 0.1.0

### Initial release

- Hono-based API server with Prisma + PostgreSQL persistence and Redis caching
- Prompt and version CRUD with SHA-256 checksums and automatic version numbering
- Tag-based lifecycle (`draft`, `staging`, `production`) with eval-gated promotion
- A/B deployments with weighted traffic splitting and sticky sessions
- Semantic diffing with line-level diffs and impact scoring
- Per-version metrics ingestion (cost, latency, quality)
- Structured Pino logging and a Prometheus `/metrics` endpoint
- OpenAPI 3.0 spec served at `/api/v1/docs`
