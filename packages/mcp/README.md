# @reaatech/prompt-version-control-mcp

[![npm version](https://img.shields.io/npm/v/@reaatech/prompt-version-control-mcp.svg)](https://www.npmjs.com/package/@reaatech/prompt-version-control-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/reaatech/prompt-version-control/blob/main/LICENSE)
[![CI](https://img.shields.io/github/actions/workflow/status/reaatech/prompt-version-control/ci.yml?branch=main&label=CI)](https://github.com/reaatech/prompt-version-control/actions/workflows/ci.yml)

> **Status:** Pre-1.0 — APIs may change in minor versions. Pin to a specific version in production.

A [Model Context Protocol](https://modelcontextprotocol.io) server that exposes managed prompts to AI agents at runtime. Connects to a Prompt Version Control API server, fetches the production version of any prompt, and renders it with Handlebars template interpolation — all via a single MCP tool.

## Installation

```bash
npm install -g @reaatech/prompt-version-control-mcp
# or
pnpm add -g @reaatech/prompt-version-control-mcp
```

The package ships the `pvc-mcp` binary. Run it as an MCP server via stdio transport.

## Feature Overview

- **Single MCP tool** — `prompt.get` fetches and renders the production version of any prompt
- **Handlebars rendering** — template variables injected with `noEscape` for safe interpolation
- **Variable metadata** — returns which variables were used and which are missing, enabling agents to self-correct
- **Stdio transport** — standard MCP communication over stdin/stdout
- **Zero-config runtime** — configure with two environment variables (`PVC_API_URL`, `PVC_API_KEY`)

## Quick Start

### Claude Desktop

Add to your Claude Desktop configuration (`claude_desktop_config.json`):

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

### Cursor / Other MCP Clients

```json
{
  "mcpServers": {
    "pvc": {
      "command": "npx",
      "args": ["@reaatech/prompt-version-control-mcp"],
      "env": {
        "PVC_API_URL": "http://localhost:3000",
        "PVC_API_KEY": "pvc_your-api-key"
      }
    }
  }
}
```

Once configured, restart your client. The `prompt.get` tool will be available to AI agents.

## API Reference

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PVC_API_URL` | No | `http://localhost:3000` | URL of the Prompt Version Control API server |
| `PVC_API_KEY` | Yes | — | API key for authentication |

### Tools

#### `prompt.get`

Fetches the production-tagged version of a prompt from the API server and renders it with Handlebars template interpolation using the provided variables.

**Arguments:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `promptId` | `string` | Yes | Prompt ID or name |
| `variables` | `Record<string, string>` | No | Template variables to substitute |

**Returns:**

```json
{
  "version": 3,
  "content": "You are a {{role}}. Respond to: {{query}}",
  "rendered": "You are a support agent. Respond to: I can't log in",
  "variablesUsed": ["role", "query"],
  "missingVariables": [],
  "metadata": { "author": "ops-team" }
}
```

**Return Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `version` | `number` | The production version number |
| `content` | `string` | The raw template with `{{handlebars}}` placeholders |
| `rendered` | `string` | The template with all provided variables substituted |
| `variablesUsed` | `string[]` | All variables referenced in the template |
| `missingVariables` | `string[]` | Variables referenced but not provided — agents can re-invoke with these |
| `metadata` | `Record<string, unknown> \| null` | User-defined metadata from the prompt |

### MCP Server Capabilities

```json
{
  "name": "prompt-version-control",
  "version": "0.1.0",
  "capabilities": {
    "tools": {}
  }
}
```

The server exposes only the `tools` capability with a single tool. Resources, prompts, and logging capabilities are not currently exposed.

## Usage Patterns

### Variable-Aware Agent Loop

The `missingVariables` field enables agents to detect incomplete invocations and retry:

```typescript
// Agent calls prompt.get with partial variables
const result1 = await mcp.callTool("prompt.get", {
  promptId: "customer-support",
  variables: { role: "support agent" }
});

// result1.missingVariables === ["query"]
// Agent asks the user for the missing value, then retries:

const result2 = await mcp.callTool("prompt.get", {
  promptId: "customer-support",
  variables: { role: "support agent", query: "I can't log in" }
});

// result2.missingVariables === []
// result2.rendered === "You are a support agent. Respond to: I can't log in"
```

### Prompt-Driven Agent Behavior

Use `prompt.get` to pull managed system prompts at runtime, centralizing prompt changes without agent redeployment:

```typescript
// Instead of hardcoding a system prompt:
// const systemPrompt = "You are a helpful assistant..."

// Pull the managed production prompt:
const { rendered } = await mcp.callTool("prompt.get", {
  promptId: "my-assistant-system-prompt",
  variables: { user_name: "Alice" }
});

// Use `rendered` as the system prompt for the LLM call
```

## Configuration Reference

### Direct Execution

```bash
PVC_API_URL=http://localhost:3000 PVC_API_KEY=pvc_your-api-key pvc-mcp
```

### With npx

```bash
PVC_API_URL=http://localhost:3000 PVC_API_KEY=pvc_your-api-key \
  npx @reaatech/prompt-version-control-mcp
```

## Related Packages

- [`@reaatech/prompt-version-control-server`](https://www.npmjs.com/package/@reaatech/prompt-version-control-server) — API server this MCP server calls
- [`@reaatech/prompt-version-control`](https://www.npmjs.com/package/@reaatech/prompt-version-control) — TypeScript SDK (used internally by the MCP server)
- [`@reaatech/prompt-version-control-shared`](https://www.npmjs.com/package/@reaatech/prompt-version-control-shared) — Template rendering and shared types
- [`@reaatech/prompt-version-control-cli`](https://www.npmjs.com/package/@reaatech/prompt-version-control-cli) — CLI tool

## License

[MIT](https://github.com/reaatech/prompt-version-control/blob/main/LICENSE)
