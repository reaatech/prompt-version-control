# @pvc/mcp

Prompt Version Control MCP Server.

## Overview

The `@pvc/mcp` package implements a [Model Context Protocol](https://modelcontextprotocol.io) server that exposes prompt retrieval as a tool for AI agents (e.g., Claude Desktop).

## Tools

- `prompt.get` — Fetch the production version of a prompt and render it with variables.

## Configuration

Add to your MCP client configuration:

```json
{
  "mcpServers": {
    "pvc": {
      "command": "npx",
      "args": ["@pvc/mcp"],
      "env": {
        "PVC_API_URL": "http://localhost:3000",
        "PVC_API_KEY": "your-api-key"
      }
    }
  }
}
```

## Development

```bash
pnpm dev
pnpm test
```
