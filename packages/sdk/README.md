# @reaatech/prompt-version-control

[![npm version](https://img.shields.io/npm/v/@reaatech/prompt-version-control.svg)](https://www.npmjs.com/package/@reaatech/prompt-version-control)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/reaatech/prompt-version-control/blob/main/LICENSE)
[![CI](https://img.shields.io/github/actions/workflow/status/reaatech/prompt-version-control/ci.yml?branch=main&label=CI)](https://github.com/reaatech/prompt-version-control/actions/workflows/ci.yml)

> **Status:** Pre-1.0 — APIs may change in minor versions. Pin to a specific version in production.

TypeScript client SDK for the Prompt Version Control API. Provides a typed, authenticated client with built-in retry logic, configurable timeouts, and optional in-memory caching.

## Installation

```bash
npm install @reaatech/prompt-version-control
# or
pnpm add @reaatech/prompt-version-control
```

## Feature Overview

- **Typed API client** — full TypeScript types for all responses
- **Automatic retry** — exponential backoff with jitter on 5xx errors and network failures
- **Configurable timeouts** — `AbortController`-based request timeout (default 30s)
- **In-memory cache** — optional LRU cache with TTL and max-entries eviction
- **Zero-config defaults** — `baseUrl` defaults to `http://localhost:3000`
- **4xx passthrough** — client errors are thrown immediately without retry

## Quick Start

```typescript
import { PromptVersionControlClient } from "@reaatech/prompt-version-control";

const client = new PromptVersionControlClient({
  baseUrl: "http://localhost:3000",
  apiKey: "pvc_your-api-key",
});

// Get a prompt by ID
const prompt = await client.getPrompt("prompt-abc123");
console.log(prompt.name, prompt.template);

// List all prompts
const { data } = await client.listPrompts();

// Get the production version of a prompt
const prod = await client.getProduction("prompt-abc123");
console.log(prod.number, prod.content);
```

## API Reference

### `PromptVersionControlClient` (class)

Also exported as `PVCClient` (shorthand alias).

```typescript
import { PromptVersionControlClient } from "@reaatech/prompt-version-control";
// or
import { PVCClient } from "@reaatech/prompt-version-control";

const client = new PVCClient({ apiKey: "pvc_...", baseUrl: "..." });
```

#### Constructor

```typescript
new PromptVersionControlClient(options: PVCClientOptions)
```

### `PVCClientOptions`

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `apiKey` | `string` | (required) | API key for Bearer authentication |
| `baseUrl` | `string` | `"http://localhost:3000"` | API server base URL |
| `retries` | `number` | `3` | Max retry attempts on 5xx / network errors |
| `retryDelay` | `number` | `1000` | Base delay in ms for exponential backoff |
| `timeoutMs` | `number` | `30000` | Per-request timeout in ms |
| `cache` | `boolean` | `false` | Enable in-memory response caching |
| `cacheTtl` | `number` | `60000` | Cache TTL in ms |
| `cacheMaxEntries` | `number` | `1000` | Max entries before FIFO eviction |

### Instance Methods

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `getPrompt` | `id: string` | `Promise<{ id, name, template }>` | Retrieve a prompt by ID |
| `listPrompts` | — | `Promise<{ data: Array<{ id, name }> }>` | List all prompts |
| `getProduction` | `promptId: string` | `Promise<{ id, number, content, template, variables, metadata }>` | Get the production-tagged version of a prompt |

## Usage Patterns

### Retry with Backoff

```typescript
const client = new PromptVersionControlClient({
  apiKey: "pvc_...",
  retries: 5,         // up to 5 retries
  retryDelay: 500,    // 500ms base → 500, 1000, 2000, 4000, 8000ms
});

// Transient network errors and 5xx are automatically retried
// 4xx errors are thrown immediately
const prompt = await client.getPrompt("prompt-id");
```

### Caching

```typescript
const client = new PromptVersionControlClient({
  apiKey: "pvc_...",
  cache: true,
  cacheTtl: 120_000,       // cache entries for 2 minutes
  cacheMaxEntries: 500,    // evict oldest when > 500 entries
});

// First call hits the API
const prod1 = await client.getProduction("my-prompt");

// Subsequent calls within TTL return cached result
const prod2 = await client.getProduction("my-prompt");
```

### Custom Timeout

```typescript
const client = new PromptVersionControlClient({
  apiKey: "pvc_...",
  timeoutMs: 5000,  // fail fast — 5 second timeout
});
```

### Using the Alias

```typescript
import { PVCClient } from "@reaatech/prompt-version-control";

const client = new PVCClient({ apiKey: "pvc_..." });
const prompt = await client.getPrompt("prompt-id");
```

## Error Handling

The SDK uses raw `fetch` under the hood. On failure:

- **5xx and network errors** — retried with exponential backoff + jitter, up to `retries` attempts
- **4xx errors** — thrown immediately as `Error` with the response status and body
- **Timeout** — thrown as `Error` with message `"Request timed out"`

```typescript
try {
  const prompt = await client.getPrompt("nonexistent-id");
} catch (err) {
  // err.message will contain the HTTP status and response body
  console.error(err.message);
}
```

## Related Packages

- [`@reaatech/prompt-version-control-shared`](https://www.npmjs.com/package/@reaatech/prompt-version-control-shared) — Shared types and utilities
- [`@reaatech/prompt-version-control-server`](https://www.npmjs.com/package/@reaatech/prompt-version-control-server) — API server this client talks to
- [`@reaatech/prompt-version-control-cli`](https://www.npmjs.com/package/@reaatech/prompt-version-control-cli) — CLI tool (uses this SDK)
- [`@reaatech/prompt-version-control-mcp`](https://www.npmjs.com/package/@reaatech/prompt-version-control-mcp) — MCP server (uses this SDK)

## License

[MIT](https://github.com/reaatech/prompt-version-control/blob/main/LICENSE)
