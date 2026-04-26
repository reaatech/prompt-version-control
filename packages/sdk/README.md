# @pvc/sdk

Prompt Version Control TypeScript SDK.

## Overview

The `@pvc/sdk` package provides a typed TypeScript client for the Prompt Version Control API with built-in retry logic and optional in-memory caching.

## Installation

```bash
npm install @pvc/sdk
```

## Usage

```typescript
import { PromptVersionControlClient } from '@pvc/sdk';

const client = new PromptVersionControlClient({
  baseUrl: 'http://localhost:3000',
  apiKey: 'your-api-key',
});

// Get a production prompt
const prompt = await client.getProduction('my-prompt');

// List prompts
const prompts = await client.listPrompts();
```

## Development

```bash
pnpm dev
pnpm test
```
