# @pvc/cli

Prompt Version Control CLI.

## Overview

The `@pvc/cli` package provides the `pvc` command-line tool for managing prompts, versions, and tags from the terminal.

## Installation

```bash
npm install -g @pvc/cli
```

## Usage

```bash
# Initialize configuration
pvc init

# List prompts
pvc prompt list

# Create a prompt
pvc prompt create --name "my-prompt" --template "Hello, {{name}}!"

# Create a version
pvc version create --prompt-id <id> --content "New content"

# Set a tag
pvc tag set --prompt-id <id> --name production --version-id <id>
```

## Development

```bash
pnpm dev
pnpm test
```
