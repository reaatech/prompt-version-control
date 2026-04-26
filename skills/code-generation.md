# Skill: Code Generation

Generates production-ready TypeScript code following project conventions for the Prompt Version Control system.

## Capabilities

- **API Endpoints**: Generate Hono route handlers with OpenAPI documentation
- **Database Layer**: Create Prisma models, migrations, and repository patterns
- **Service Layer**: Implement business logic with proper error handling
- **Validation**: Write Zod schemas for request/response validation
- **CLI Commands**: Create Clipanion-based CLI commands
- **Type Safety**: Generate TypeScript types from schemas

## Usage

### Basic Usage

```bash
# Generate a complete feature
@agent code-generation --feature="prompt versioning" --type="service"

# Generate specific component
@agent code-generation --target="api" --name="prompts" --methods="create,list,get,update,delete"

# Generate with specific patterns
@agent code-generation --pattern="repository" --entity="Version"
```

### Command Line Options

| Option      | Description                                      | Default             |
| ----------- | ------------------------------------------------ | ------------------- |
| `--feature` | Feature name to generate                         | -                   |
| `--type`    | Component type (service, api, model, cli)        | service             |
| `--name`    | Entity/resource name                             | -                   |
| `--methods` | Comma-separated HTTP methods                     | get,post,put,delete |
| `--pattern` | Design pattern (repository, service, controller) | service             |
| `--dry-run` | Show generated code without writing              | false               |
| `--force`   | Overwrite existing files                         | false               |

## Generated Code Standards

### API Endpoints (Hono)

```typescript
// Generated endpoint structure
import { Hono } from 'hono';
import { z } from 'zod';
import { createTransaction } from '../db/transaction';
import { promptRepository } from '../repositories/prompt.repository';
import { PromptSchema, CreatePromptSchema } from '../schemas/prompt.schema';
import { AppError, ValidationError } from '../errors';

const router = new Hono();

// GET /prompts - List with pagination
router.get('/', async (c) => {
  const { limit, cursor } = c.req.query();
  const prompts = await promptRepository.findAll({
    limit: Number(limit) || 20,
    cursor,
  });

  return c.json({
    data: prompts,
    meta: { limit, nextCursor: prompts[prompts.length - 1]?.id },
  });
});

// POST /prompts - Create with validation
router.post('/', async (c) => {
  const body = await c.req.json();
  const validated = CreatePromptSchema.parse(body);

  const prompt = await createTransaction(async (tx) => {
    return await tx.prompt.create({ data: validated });
  });

  return c.json(PromptSchema.parse(prompt), 201);
});
```

### Service Layer

```typescript
// Generated service structure
import { prisma } from '../db/client';
import { Prompt, Version, Tag } from '@prisma/client';
import { AppError } from '../errors';
import { logger } from '../utils/logger';

export class PromptService {
  async createPrompt(projectId: string, data: CreatePromptInput): Promise<Prompt> {
    const existing = await prisma.prompt.findFirst({
      where: { projectId, name: data.name },
    });

    if (existing) {
      throw new AppError('CONFLICT', 409, 'Prompt name already exists');
    }

    const prompt = await prisma.prompt.create({
      data: {
        ...data,
        projectId,
      },
    });

    logger.info({ promptId: prompt.id, name: prompt.name }, 'Prompt created');
    return prompt;
  }

  async createVersion(promptId: string, data: CreateVersionInput): Promise<Version> {
    const prompt = await prisma.prompt.findUnique({
      where: { id: promptId },
    });

    if (!prompt) {
      throw new AppError('NOT_FOUND', 404, 'Prompt not found');
    }

    const maxVersion = await prisma.version.findFirst({
      where: { promptId },
      orderBy: { number: 'desc' },
    });

    const version = await prisma.version.create({
      data: {
        promptId,
        number: (maxVersion?.number || 0) + 1,
        content: data.content,
        template: data.template,
        variables: data.variables,
        checksum: this.calculateChecksum(data.content),
        metadata: data.metadata,
      },
    });

    logger.info({ versionId: version.id, promptId }, 'Version created');
    return version;
  }

  private calculateChecksum(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }
}
```

### Zod Schemas

```typescript
// Generated schema structure
import { z } from 'zod';

export const CreatePromptSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(100, 'Name too long')
    .regex(/^[a-z0-9-]+$/, 'Invalid format'),
  description: z.string().max(500).optional(),
  template: z.string().min(1, 'Template is required'),
  variables: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const PromptSchema = z.object({
  id: z.string().cuid(),
  projectId: z.string().cuid(),
  name: z.string(),
  description: z.string().nullable(),
  template: z.string(),
  variables: z.record(z.unknown()),
  metadata: z.record(z.unknown()).nullable(),
  archived: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
```

### CLI Commands (Clipanion)

```typescript
// Generated CLI command structure
import { Command, Option } from 'clipanion';
import { z } from 'zod';

export class PromptCreateCommand extends Command {
  static paths = [['prompt', 'create']];

  name = Option.Required('-n,--name', { description: 'Prompt name' });
  description = Option.String('-d,--description', { description: 'Description' });
  template = Option.Required('-t,--template', { description: 'Template file' });
  project = Option.String('-p,--project', { description: 'Project ID' });

  async execute() {
    const config = await loadConfig();
    const client = createAPIClient(config.apiUrl, config.apiKey);

    const prompt = await client.prompts.create(
      {
        name: this.name,
        description: this.description,
        template: await readFile(this.template),
      },
      this.project,
    );

    this.context.stdout.write(`Created prompt: ${prompt.id}\n`);
    this.context.stdout.write(JSON.stringify(prompt, null, 2));
  }
}
```

## File Templates

### API Route Template

```
packages/server/src/api/routes/{entity}.routes.ts
packages/server/src/api/handlers/{entity}.handlers.ts
packages/server/src/schemas/{entity}.schema.ts
```

### Service Template

```
packages/server/src/services/{entity}.service.ts
packages/server/src/repositories/{entity}.repository.ts
```

### CLI Template

```
packages/cli/src/commands/{entity}/{action}.ts
```

## Quality Checks

Generated code must pass:

1. **TypeScript Strict Mode**: No `any` types, proper null handling
2. **ESLint Rules**: All project rules enforced
3. **Prettier**: Consistent formatting
4. **Security**: No SQL injection, proper input validation
5. **Error Handling**: Proper error types and messages
6. **Logging**: Structured logging for all operations

## Examples

### Example 1: Generate Prompt Management API

```bash
@agent code-generation --feature="prompt-management" --type="api" --name="prompts"
```

Generates:

- `packages/server/src/api/routes/prompts.routes.ts`
- `packages/server/src/api/handlers/prompts.handlers.ts`
- `packages/server/src/schemas/prompts.schema.ts`
- `packages/server/src/services/prompts.service.ts`
- `packages/server/src/repositories/prompts.repository.ts`

### Example 2: Generate Version Tagging Feature

```bash
@agent code-generation --feature="version-tagging" --type="service" --pattern="repository"
```

Generates:

- `packages/server/src/services/tag.service.ts`
- `packages/server/src/repositories/tag.repository.ts`
- `packages/server/src/schemas/tag.schema.ts`

### Example 3: Generate CLI Commands

```bash
@agent code-generation --feature="prompt-cli" --type="cli" --name="prompt"
```

Generates:

- `packages/cli/src/commands/prompt/create.ts`
- `packages/cli/src/commands/prompt/list.ts`
- `packages/cli/src/commands/prompt/get.ts`
- `packages/cli/src/commands/prompt/update.ts`
- `packages/cli/src/commands/prompt/delete.ts`

## Error Handling

The skill provides clear error messages for:

- Invalid feature names or types
- Missing required parameters
- File conflicts (with `--force` option to override)
- Syntax errors in generated code
- Missing dependencies

## Integration

Generated code integrates with:

- Existing Prisma schema
- Project authentication middleware
- Logging infrastructure
- Error handling utilities
- Configuration management
