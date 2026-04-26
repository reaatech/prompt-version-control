# Skill: Test Generation

Creates comprehensive test suites using Vitest for the Prompt Version Control system, ensuring high code quality and reliability.

## Capabilities

- **Unit Tests**: Test individual functions, services, and utilities
- **Integration Tests**: Test API endpoints with database interactions
- **Database Tests**: Test with testcontainers for realistic PostgreSQL testing
- **Mock Generation**: Create mocks for external dependencies
- **Coverage Analysis**: Generate and analyze test coverage reports
- **Test Data Factories**: Generate realistic test data

## Usage

### Basic Usage

```bash
# Generate tests for a specific file
@agent test-generation --target="src/services/prompt.service.ts"

# Generate with coverage target
@agent test-generation --target="src/services/prompt.service.ts" --coverage=90

# Generate integration tests for API
@agent test-generation --target="src/api/routes/prompts.routes.ts" --type="integration"

# Generate tests for entire directory
@agent test-generation --target="src/services/" --recursive
```

### Command Line Options

| Option        | Description                              | Default |
| ------------- | ---------------------------------------- | ------- |
| `--target`    | File or directory to test                | -       |
| `--type`      | Test type (unit, integration, e2e)       | unit    |
| `--coverage`  | Target coverage percentage               | 85      |
| `--recursive` | Generate tests for directory recursively | false   |
| `--dry-run`   | Show generated tests without writing     | false   |
| `--force`     | Overwrite existing test files            | false   |

## Generated Test Standards

### Unit Test Structure

```typescript
// packages/server/src/services/__tests__/prompt.service.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PromptService } from '../prompt.service';
import { prisma } from '../../db/client';
import { AppError } from '../../errors';

vi.mock('../../db/client', () => ({
  prisma: {
    prompt: {
      findFirst: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

describe('PromptService', () => {
  let promptService: PromptService;

  beforeEach(() => {
    vi.clearAllMocks();
    promptService = new PromptService();
  });

  describe('createPrompt', () => {
    it('should create a prompt successfully', async () => {
      const mockPrompt = {
        id: 'prompt_123',
        projectId: 'project_123',
        name: 'test-prompt',
        description: 'Test description',
        template: 'Hello {{name}}',
      };

      vi.mocked(prisma.prompt.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.prompt.create).mockResolvedValue(mockPrompt);

      const result = await promptService.createPrompt('project_123', {
        name: 'test-prompt',
        description: 'Test description',
        template: 'Hello {{name}}',
      });

      expect(result).toEqual(mockPrompt);
      expect(prisma.prompt.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          projectId: 'project_123',
          name: 'test-prompt',
        }),
      });
    });

    it('should throw conflict error when prompt name exists', async () => {
      const existingPrompt = { id: 'existing_123', name: 'test-prompt' };
      vi.mocked(prisma.prompt.findFirst).mockResolvedValue(existingPrompt);

      await expect(
        promptService.createPrompt('project_123', {
          name: 'test-prompt',
          template: 'Hello',
        }),
      ).rejects.toThrow(AppError);

      await expect(
        promptService.createPrompt('project_123', {
          name: 'test-prompt',
          template: 'Hello',
        }),
      ).rejects.toThrowError('Prompt name already exists');
    });
  });

  describe('createVersion', () => {
    it('should create a new version with incremented number', async () => {
      const mockPrompt = { id: 'prompt_123', projectId: 'project_123' };
      const mockMaxVersion = { number: 3 };
      const mockVersion = {
        id: 'version_123',
        promptId: 'prompt_123',
        number: 4,
        content: 'New content',
      };

      vi.mocked(prisma.prompt.findUnique).mockResolvedValue(mockPrompt);
      vi.mocked(prisma.version.findFirst).mockResolvedValue(mockMaxVersion);
      vi.mocked(prisma.version.create).mockResolvedValue(mockVersion);

      const result = await promptService.createVersion('prompt_123', {
        content: 'New content',
        template: 'Hello {{name}}',
      });

      expect(result.number).toBe(4);
      expect(prisma.version.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          promptId: 'prompt_123',
          number: 4,
          checksum: expect.stringMatching(/^[a-f0-9]{64}$/),
        }),
      });
    });

    it('should throw not found error when prompt does not exist', async () => {
      vi.mocked(prisma.prompt.findUnique).mockResolvedValue(null);

      await expect(
        promptService.createVersion('non-existent', { content: 'test' }),
      ).rejects.toThrow(AppError);

      await expect(
        promptService.createVersion('non-existent', { content: 'test' }),
      ).rejects.toThrowError('Prompt not found');
    });
  });
});
```

### Integration Test Structure

```typescript
// packages/server/src/api/__tests__/prompts.integration.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Hono } from 'hono';
import { testClient } from 'hono/testing';
import { createTestDatabase, cleanupTestDatabase } from '../../test-utils/database';
import { promptRoutes } from '../routes/prompts.routes';
import { authMiddleware } from '../middleware/auth';

describe('Prompts API Integration', () => {
  let app: Hono;
  let testDb: any;
  let authToken: string;

  beforeAll(async () => {
    testDb = await createTestDatabase();
    authToken = testDb.apiKey;

    app = new Hono();
    app.use('*', authMiddleware);
    app.route('/prompts', promptRoutes);
  });

  afterAll(async () => {
    await cleanupTestDatabase(testDb);
  });

  describe('POST /prompts', () => {
    it('should create a prompt and return 201', async () => {
      const payload = {
        name: 'integration-test-prompt',
        template: 'Hello {{name}}',
        description: 'Integration test',
      };

      const res = await testClient(app).prompts.$post(payload, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body).toMatchObject({
        id: expect.stringMatching(/^prompt_/),
        name: 'integration-test-prompt',
        template: 'Hello {{name}}',
      });
    });

    it('should return 400 for invalid input', async () => {
      const payload = { name: '' }; // Missing required fields

      const res = await testClient(app).prompts.$post(payload, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect(res.status).toBe(400);
    });

    it('should return 409 for duplicate name', async () => {
      const payload = {
        name: 'duplicate-prompt',
        template: 'Test',
      };

      // Create first prompt
      await testClient(app).prompts.$post(payload, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      // Try to create duplicate
      const res = await testClient(app).prompts.$post(payload, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect(res.status).toBe(409);
    });
  });

  describe('GET /prompts', () => {
    it('should list prompts with pagination', async () => {
      // Create test data
      for (let i = 0; i < 5; i++) {
        await testClient(app).prompts.$post(
          {
            name: `test-prompt-${i}`,
            template: `Template ${i}`,
          },
          {
            headers: { Authorization: `Bearer ${authToken}` },
          },
        );
      }

      const res = await testClient(app).prompts.$get(
        { limit: '3' },
        { headers: { Authorization: `Bearer ${authToken}` } },
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data).toHaveLength(3);
      expect(body.meta).toHaveProperty('nextCursor');
    });
  });

  describe('GET /prompts/:id', () => {
    it('should return 404 for non-existent prompt', async () => {
      const res = await testClient(app).prompts[':id'].$get(
        { id: 'non-existent' },
        { headers: { Authorization: `Bearer ${authToken}` } },
      );

      expect(res.status).toBe(404);
    });
  });
});
```

### Database Test Utilities

```typescript
// packages/server/src/test-utils/database.ts
import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';
import { randomUUID } from 'crypto';

let testPrisma: PrismaClient | null = null;

export async function createTestDatabase() {
  const testDbName = `test_${randomUUID().replace(/-/g, '_')}`;

  // Create test database
  execSync(`CREATE DATABASE ${testDbName}`);

  const testUrl = `postgresql://postgres:password@localhost:5432/${testDbName}`;

  testPrisma = new PrismaClient({
    datasources: {
      db: { url: testUrl },
    },
  });

  // Run migrations
  await testPrisma.$connect();
  execSync(`DATABASE_URL="${testUrl}" npx prisma migrate deploy`);

  // Create test API key
  const apiKey = await testPrisma.apiKey.create({
    data: {
      projectId: 'test-project',
      name: 'test-key',
      keyHash: 'hashed-test-key',
      prefix: 'test_',
      permissions: { admin: true },
    },
  });

  return {
    prisma: testPrisma,
    apiKey: apiKey.keyHash,
    dbName: testDbName,
  };
}

export async function cleanupTestDatabase(testDb: { dbName: string; prisma: PrismaClient }) {
  await testDb.prisma.$disconnect();
  execSync(`DROP DATABASE ${testDb.dbName}`);
}
```

### Test Data Factories

```typescript
// packages/server/src/test-utils/factories.ts
// Requires: pnpm add -D @faker-js/faker
import { faker } from '@faker-js/faker';
import { Prisma } from '@prisma/client';

export const promptFactory = {
  create: (overrides: Partial<Prisma.PromptCreateInput> = {}) => ({
    name: faker.lorem.slug(),
    description: faker.lorem.sentence(),
    template: `Hello {{name}}, welcome to ${faker.lorem.word()}`,
    variables: { name: 'string' },
    metadata: { author: 'test' },
    archived: false,
    ...overrides,
  }),

  batch: (count: number, overrides = {}) =>
    Array.from({ length: count }, () => promptFactory.create(overrides)),
};

export const versionFactory = {
  create: (overrides: Partial<Prisma.VersionCreateInput> = {}) => ({
    number: faker.number.int({ min: 1, max: 100 }),
    content: faker.lorem.paragraphs(),
    template: 'Hello {{name}}',
    variables: { name: faker.person.firstName() },
    checksum: faker.string.alphanumeric(64),
    metadata: { author: 'tester' },
    ...overrides,
  }),
};

export const tagFactory = {
  create: (overrides = {}) => ({
    name: faker.helpers.arrayElement(['draft', 'staging', 'production']),
    description: faker.lorem.sentence(),
    ...overrides,
  }),
};
```

### Mock Generation

```typescript
// packages/server/src/__mocks__/@prisma/client.ts
import { vi } from 'vitest';

export const PrismaClient = vi.fn().mockImplementation(() => ({
  prompt: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  version: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  tag: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  evaluation: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
  deployment: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
  $connect: vi.fn(),
  $disconnect: vi.fn(),
}));
```

## Coverage Configuration

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/__tests__/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'src/test-utils/', '**/*.d.ts', '**/index.ts'],
      thresholds: {
        global: {
          statements: 85,
          branches: 80,
          functions: 85,
          lines: 85,
        },
      },
    },
  },
});
```

## Examples

### Example 1: Generate Unit Tests for Service

```bash
@agent test-generation --target="packages/server/src/services/prompt.service.ts" --coverage=90
```

Generates:

- `packages/server/src/services/__tests__/prompt.service.test.ts`
- Mock setup for dependencies
- Tests for all public methods
- Edge case coverage

### Example 2: Generate Integration Tests for API

```bash
@agent test-generation --target="packages/server/src/api/routes/prompts.routes.ts" --type="integration"
```

Generates:

- `packages/server/src/api/__tests__/prompts.integration.test.ts`
- Database setup/teardown
- Authentication testing
- Error scenario coverage

### Example 3: Generate Tests for Directory

```bash
@agent test-generation --target="packages/server/src/repositories/" --recursive
```

Generates tests for all repository files in the directory.

## Quality Standards

Generated tests must:

1. **Follow AAA Pattern**: Arrange, Act, Assert structure
2. **Be Isolated**: Each test is independent
3. **Use Descriptive Names**: Clear test descriptions
4. **Test Edge Cases**: Null, empty, invalid inputs
5. **Mock External Dependencies**: Database, APIs, file system
6. **Include Negative Tests**: Error scenarios
7. **Maintain 85%+ Coverage**: Line, branch, function coverage

## Test Categories

### Unit Tests

- Test individual functions/classes in isolation
- Mock all external dependencies
- Fast execution (< 100ms per test)

### Integration Tests

- Test component interactions
- Use test database
- Test API endpoints end-to-end

### Performance Tests

- Test response times
- Test under load
- Identify bottlenecks

## Error Handling

The skill provides clear error messages for:

- Invalid target files
- Missing dependencies
- Syntax errors in generated tests
- Coverage threshold not met
- Test execution failures

## Integration

Generated tests integrate with:

- Vitest test runner
- Project's ESLint configuration
- TypeScript strict mode
- Existing mock utilities
- CI/CD pipeline
