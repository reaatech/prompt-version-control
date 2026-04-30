# syntax=docker/dockerfile:1.7

# -----------------------------------------------------------------------------
# Base: install pnpm + workspace deps. Used by both dev and prod stages.
# -----------------------------------------------------------------------------
FROM node:22-alpine AS base
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9 --activate

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/server/package.json ./packages/server/
COPY packages/cli/package.json ./packages/cli/
COPY packages/sdk/package.json ./packages/sdk/
COPY packages/mcp/package.json ./packages/mcp/
COPY packages/shared/package.json ./packages/shared/
RUN pnpm install --frozen-lockfile

# -----------------------------------------------------------------------------
# Dev: full toolchain + sources for hot-reload via tsx watch.
# Targeted by docker-compose for the local dev loop.
# -----------------------------------------------------------------------------
FROM base AS dev
COPY . .
RUN pnpm --filter @reaatech/prompt-version-control-server exec prisma generate
EXPOSE 3000
CMD ["pnpm", "--filter", "@reaatech/prompt-version-control-server", "dev"]

# -----------------------------------------------------------------------------
# Builder: compile TS for the production runtime stage.
# -----------------------------------------------------------------------------
FROM base AS builder
COPY . .
RUN pnpm --filter @reaatech/prompt-version-control-server exec prisma generate
RUN pnpm build
RUN pnpm --filter=@reaatech/prompt-version-control-server deploy --prod /app/prod/server

# -----------------------------------------------------------------------------
# Runtime: minimal image with just the compiled server.
# -----------------------------------------------------------------------------
FROM node:22-alpine AS runtime
WORKDIR /app

RUN apk add --no-cache dumb-init

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

COPY --from=builder --chown=nodejs:nodejs /app/prod/server ./
COPY --from=builder --chown=nodejs:nodejs /app/packages/server/prisma ./prisma
COPY --from=builder --chown=nodejs:nodejs /app/docs/api/openapi.yaml ./docs/api/openapi.yaml

USER nodejs

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "packages/server/dist/index.js"]
