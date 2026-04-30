# @reaatech/prompt-version-control-cli

[![npm version](https://img.shields.io/npm/v/@reaatech/prompt-version-control-cli.svg)](https://www.npmjs.com/package/@reaatech/prompt-version-control-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/reaatech/prompt-version-control/blob/main/LICENSE)
[![CI](https://img.shields.io/github/actions/workflow/status/reaatech/prompt-version-control/ci.yml?branch=main&label=CI)](https://github.com/reaatech/prompt-version-control/actions/workflows/ci.yml)

> **Status:** Pre-1.0 — APIs may change in minor versions. Pin to a specific version in production.

The `pvc` command-line tool for managing prompts, versions, and tags from the terminal. Built on [Clipanion 4](https://mael.dev/clipanion) with typed options, rich help output, and persistent configuration via `~/.pvcrc`.

## Installation

```bash
npm install -g @reaatech/prompt-version-control-cli
# or
pnpm add -g @reaatech/prompt-version-control-cli
```

## Feature Overview

- **Zero-touch setup** — `pvc init` writes a config file and you're ready
- **Prompt CRUD** — create, list, and retrieve prompts by ID or name
- **Version management** — create versions with automatic numbering
- **Tag lifecycle** — set `draft`, `staging`, and `production` tags by version number or ID
- **Persistent configuration** — `~/.pvcrc` stores API URL and key (mode 0600)
- **Rich CLI output** — colorized tables, error formatting, and `--help` on every command
- **Composable with CI/CD** — exit codes for scripting and automation

## Quick Start

```bash
# Configure the CLI (writes ~/.pvcrc with restricted permissions)
pvc init --api-url http://localhost:3000 --api-key "pvc_your-api-key"

# Create a new prompt
pvc prompt create -n customer-support -t "You are a helpful support agent. Help with: {{issue}}"

# List all prompts
pvc prompt list

# Get a prompt by name or ID
pvc prompt get customer-support

# Create a new version (auto-increments the version number)
pvc version create -p customer-support -c "You are a senior support agent. Help with: {{issue}}"

# Tag version 2 as production
pvc tag set -p customer-support -v 2 -t production
```

## Commands

### `pvc init`

Initialize the CLI configuration. Writes `~/.pvcrc` with restricted file permissions (mode 0600).

| Option | Description |
|--------|-------------|
| `--api-url` | API server URL (default: `http://localhost:3000`) |
| `--api-key` | API key for authentication (required) |

### `pvc prompt list`

List all prompts in the project.

```
$ pvc prompt list
┌──────────────────────┬─────────────────────┬──────────────────────┐
│ ID                   │ Name                │ Template             │
├──────────────────────┼─────────────────────┼──────────────────────┤
│ prompt_abc123        │ customer-support    │ You are a helpful…   │
│ prompt_def456        │ sales-assistant     │ You are a sales…     │
└──────────────────────┴─────────────────────┴──────────────────────┘
```

### `pvc prompt create`

Create a new prompt.

| Option | Short | Description |
|--------|-------|-------------|
| `--name` | `-n` | Prompt name (required) |
| `--template` | `-t` | Prompt template with `{{handlebars}}` variables (required) |
| `--description` | `-d` | Optional description |

### `pvc prompt get <ref>`

Retrieve a prompt by ID or name. The positional argument `<ref>` is resolved against both ID and name fields.

```
$ pvc prompt get customer-support
ID:        prompt_abc123
Name:      customer-support
Template:  You are a helpful support agent. Help with: {{issue}}
Created:   2026-04-15T10:30:00.000Z
```

### `pvc version create`

Create a new version for a prompt. The version number is auto-incremented.

| Option | Short | Description |
|--------|-------|-------------|
| `--prompt` | `-p` | Prompt ID or name (required) |
| `--content` | `-c` | Version content (required) |
| `--template` | `-t` | Template string (defaults to `--content` if omitted) |

### `pvc tag set`

Move a tag to a specific version. Accepts the version as either a number (e.g., `2`) or a full version ID.

| Option | Short | Description |
|--------|-------|-------------|
| `--prompt` | `-p` | Prompt ID or name (required) |
| `--version` | `-v` | Version number or ID (required) |
| `--tag` | `-t` | Tag name: `draft`, `staging`, or `production` (required) |

## Configuration

The CLI persists its configuration in `~/.pvcrc` as JSON:

```json
{
  "apiUrl": "http://localhost:3000",
  "apiKey": "pvc_your-api-key",
  "defaultProject": "my-project"
}
```

The file is created with mode `0600` (owner read/write only) to protect the API key.

## Usage Patterns

### CI/CD Integration

```bash
# In your CI pipeline, configure from environment variables
pvc init --api-url "$PVC_API_URL" --api-key "$PVC_API_KEY"

# Promote staging to production after tests pass
LATEST_VERSION=$(pvc prompt get my-assistant | jq -r '.currentVersion')
pvc tag set -p my-assistant -v "$LATEST_VERSION" -t production
```

### Automation with Exit Codes

All commands exit with code `0` on success and non-zero on failure. Combine with shell scripting:

```bash
if ! pvc prompt get my-prompt > /dev/null 2>&1; then
  pvc prompt create -n my-prompt -t "Default: {{input}}"
fi
```

## Related Packages

- [`@reaatech/prompt-version-control-server`](https://www.npmjs.com/package/@reaatech/prompt-version-control-server) — API server this CLI talks to
- [`@reaatech/prompt-version-control`](https://www.npmjs.com/package/@reaatech/prompt-version-control) — TypeScript SDK (used internally by the CLI)
- [`@reaatech/prompt-version-control-shared`](https://www.npmjs.com/package/@reaatech/prompt-version-control-shared) — Shared types and schemas
- [`@reaatech/prompt-version-control-mcp`](https://www.npmjs.com/package/@reaatech/prompt-version-control-mcp) — MCP server for AI agents

## License

[MIT](https://github.com/reaatech/prompt-version-control/blob/main/LICENSE)
