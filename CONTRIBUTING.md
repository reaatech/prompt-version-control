# Contributing to Prompt Version Control

Thank you for your interest in contributing to Prompt Version Control! This document provides guidelines and instructions for contributing to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Pull Request Process](#pull-request-process)
- [Coding Standards](#coding-standards)
- [Testing](#testing)
- [Documentation](#documentation)
- [Agent-Assisted Development](#agent-assisted-development)

## Code of Conduct

- Be respectful and inclusive in all interactions
- Focus on constructive feedback and helpful discussions
- Welcome newcomers and help them get started
- Keep discussions professional and on-topic

## Getting Started

### Prerequisites

- Node.js 22+
- pnpm 9+
- PostgreSQL 16+
- Redis 7+
- Git

### Setup

```bash
# Fork the repository
git clone https://github.com/reaatech/prompt-version-control.git
cd prompt-version-control

# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Start development environment
pnpm dev

# Run tests
pnpm test
```

### Development Environment

We recommend using Docker Compose for local development:

```bash
# Start all services
docker compose up -d

# View logs
docker compose logs -f

# Stop services
docker compose down
```

## Development Workflow

### Branch Naming

- `feature/description` - New features
- `fix/description` - Bug fixes
- `docs/description` - Documentation changes
- `refactor/description` - Code refactoring
- `test/description` - Test additions/changes
- `perf/description` - Performance improvements

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): subject

body

footer
```

**Types:**

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Formatting (no code change)
- `refactor`: Code restructuring
- `perf`: Performance improvement
- `test`: Adding tests
- `chore`: Maintenance

**Example:**

```
feat(api): add prompt versioning endpoint

Implemented new endpoint for creating prompt versions with metadata.
Added checksum calculation and version numbering.

Closes #123
```

## Pull Request Process

1. **Create a branch** from `main`
2. **Make your changes** following our coding standards
3. **Write tests** for new functionality
4. **Update documentation** if needed
5. **Run all checks** locally before pushing
6. **Push your branch** and create a Pull Request
7. **Address review feedback** and iterate
8. **Squash commits** if needed before merging

### PR Checklist

- [ ] Code follows project style guide
- [ ] Tests are added/updated and passing
- [ ] Documentation is updated
- [ ] No new ESLint warnings
- [ ] TypeScript compiles without errors
- [ ] Commit messages follow conventions
- [ ] PR description explains the "why"

### Review Process

- All PRs require at least one approval
- Automated checks must pass
- Address all review comments
- Mark conversations as resolved when addressed

## Coding Standards

### TypeScript

- Use strict mode (`"strict": true` in tsconfig)
- No `any` types - use proper typing
- Prefer `const` over `let`
- Use meaningful variable names
- Keep functions small and focused

```typescript
// ✅ Good
interface CreateUserRequest {
  name: string;
  email: string;
}

async function createUser(data: CreateUserRequest): Promise<User> {
  // Implementation
}

// ❌ Bad
async function create(data: any): Promise<any> {
  // Implementation
}
```

### Error Handling

Use our custom error classes:

```typescript
import { AppError } from './errors';

// Validation error
throw new AppError('VALIDATION_ERROR', 400, 'Invalid input', { field: 'name' });

// Not found
throw new AppError('NOT_FOUND', 404, 'Prompt not found');

// Conflict
throw new AppError('CONFLICT', 409, 'Prompt name already exists');
```

### API Design

Follow RESTful conventions:

```typescript
// Good API design
POST   /api/v1/prompts           // Create prompt
GET    /api/v1/prompts           // List prompts
GET    /api/v1/prompts/:id       // Get prompt
PUT    /api/v1/prompts/:id       // Update prompt
DELETE /api/v1/prompts/:id       // Archive prompt

// Response format
{
  "data": { /* resource */ },
  "meta": { /* pagination, etc */ },
  "links": { /* related URLs */ }
}
```

### Database

- Always use Prisma for database access
- Include proper indexes for queries
- Use transactions for multi-step operations
- Never use raw SQL unless absolutely necessary

```typescript
// Good: Using Prisma with proper error handling
const prompt = await prisma.prompt.create({
  data: {
    name: data.name,
    template: data.template,
    projectId: projectId,
  },
});

// Bad: Raw SQL (avoid unless necessary)
const prompt = await prisma.$queryRaw`
  INSERT INTO prompts (name, template) VALUES (${data.name}, ${data.template})
`;
```

## Testing

### Running Tests

```bash
# All tests
pnpm test

# With coverage
pnpm test:coverage

# Specific file
pnpm test packages/server/src/services/__tests__/prompt.service.test.ts

# Watch mode
pnpm test:watch
```

### Writing Tests

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PromptService } from '../prompt.service';

describe('PromptService', () => {
  let service: PromptService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new PromptService();
  });

  describe('createPrompt', () => {
    it('should create a prompt successfully', async () => {
      // Arrange
      const mockData = { name: 'test', template: 'Hello {{name}}' };

      // Act
      const result = await service.createPrompt('project-123', mockData);

      // Assert
      expect(result).toMatchObject({
        id: expect.stringMatching(/^prompt_/),
        name: 'test',
      });
    });
  });
});
```

### Test Coverage

We maintain a minimum of **85% code coverage**:

- Lines: 85%
- Branches: 80%
- Functions: 85%
- Statements: 85%

## Documentation

### Code Comments

- Use JSDoc for public APIs
- Explain "why" not "what"
- Keep comments up-to-date

```typescript
/**
 * Creates a new prompt version with automatic version numbering.
 *
 * @param promptId - The ID of the prompt to version
 * @param data - The version content and metadata
 * @returns The created version with assigned version number
 * @throws {NotFoundError} If the prompt doesn't exist
 */
async function createVersion(promptId: string, data: CreateVersionData): Promise<Version> {
  // Implementation
}
```

### API Documentation

API documentation is auto-generated from OpenAPI schemas. Update the schemas when changing APIs:

```typescript
// packages/server/src/api/routes/prompts.routes.ts
/**
 * @openapi
 * /api/v1/prompts:
 *   post:
 *     summary: Create a new prompt
 *     tags: [Prompts]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreatePromptRequest'
 *     responses:
 *       201:
 *         description: Prompt created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Prompt'
 */
router.post('/', async (c) => {
  // Implementation
});
```

## Agent-Assisted Development

This project supports AI agent-assisted development through our agent skills system.

### Available Agent Skills

```bash
# Generate code for new features
@agent code-generation --feature="prompt-analytics" --type="service"

# Generate tests
@agent test-generation --target="src/services/prompt.service.ts" --coverage=90

# Run code review
@agent code-review --staged

# Update documentation
@agent documentation --type="api-reference" --output="docs/api/"

# Generate migrations
@agent migration --action="generate" --description="add prompt tags"

# Configure deployment
@agent deployment --action="generate" --target="kubernetes" --environment="production"
```

### Using Agent Skills

1. **Before using**: Ensure you understand what the skill will generate
2. **Review output**: Always review and test generated code
3. **Commit separately**: Consider committing agent-generated code separately
4. **Provide feedback**: Report issues or improvements to agent skills

### Best Practices

- Use agent skills for boilerplate and scaffolding
- Add custom logic and business rules manually
- Ensure generated code passes all checks
- Update tests to cover generated functionality

## Getting Help

- **GitHub Issues**: [reaatech/prompt-version-control/issues](https://github.com/reaatech/prompt-version-control/issues)
- **Discussions**: [GitHub Discussions](https://github.com/reaatech/prompt-version-control/discussions)
- **Documentation**: [docs/](./docs/)

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](./LICENSE).
