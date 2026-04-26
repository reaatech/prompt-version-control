# @pvc/shared

Shared types, schemas, and utilities for Prompt Version Control.

## Overview

The `@pvc/shared` package contains code used across all other `@pvc/*` packages:

- **Zod schemas** — Validation schemas for API inputs and outputs
- **TypeScript types** — Shared interfaces and type definitions
- **Utilities** — Checksum calculation, API key generation, template rendering

## Usage

```typescript
import { CreatePromptSchema, calculateChecksum } from '@pvc/shared';
```

## Development

```bash
pnpm dev
pnpm test
```
