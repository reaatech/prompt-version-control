# Agent Skills: Prompt Version Control

This document describes the AI agent skills available for developing and maintaining the Prompt Version Control project. These skills enable AI assistants to effectively contribute to code generation, testing, documentation, and project management tasks.

## Project Overview

- **Name**: prompt-version-control
- **Description**: Git-like versioning for prompts with eval-gated promotion
- **License**: MIT
- **GitHub**: [reaatech/prompt-version-control](https://github.com/reaatech/prompt-version-control)
- **Tech Stack**: TypeScript, pnpm, Hono, Prisma, PostgreSQL, Redis

## Available Agent Skills

### 1. Code Generation (`skills/code-generation.md`)

Generates production-ready TypeScript code following project conventions.

**Capabilities:**

- Generate API endpoints with Hono
- Create Prisma models and migrations
- Implement service layer business logic
- Write Zod validation schemas
- Create CLI commands with Clipanion

**Usage:**

```
@agent code-generation --feature="prompt versioning" --type="service"
```

### 2. Test Generation (`skills/test-generation.md`)

Creates comprehensive test suites using Vitest.

**Capabilities:**

- Unit tests for services and utilities
- Integration tests for API endpoints
- Database tests with test containers
- Mock generation for external dependencies
- Test coverage analysis

**Usage:**

```
@agent test-generation --target="src/services/prompt.service.ts" --coverage=85
```

### 3. Documentation (`skills/documentation.md`)

Generates and maintains project documentation.

**Capabilities:**

- API documentation from OpenAPI schemas
- CLI reference from command definitions
- README updates from code changes
- Changelog generation from git history
- Architecture diagram generation

**Usage:**

```
@agent documentation --type="api-reference" --output="docs/api/"
```

### 4. Code Review (`skills/code-review.md`)

Performs automated code review with security and quality checks.

**Capabilities:**

- Security vulnerability detection
- Performance anti-pattern identification
- TypeScript strict mode compliance
- ESLint rule enforcement
- Dependency vulnerability scanning

**Usage:**

```
@agent code-review --pr="123" --strict=true
```

### 5. Migration (`skills/migration.md`)

Manages database migrations and data transformations.

**Capabilities:**

- Prisma migration generation
- Data backfill scripts
- Rollback planning
- Migration testing
- Schema evolution tracking

**Usage:**

```
@agent migration --action="generate" --description="add prompt tags"
```

### 6. Deployment (`skills/deployment.md`)

Handles deployment configuration and infrastructure as code.

**Capabilities:**

- Docker image building
- Kubernetes manifest generation
- Helm chart updates
- Environment configuration
- CI/CD pipeline modifications

**Usage:**

```
@agent deployment --target="kubernetes" --environment="production"
```

### 7. Operations (`skills/operations.md`)

Production troubleshooting, log analysis, and runbook execution.

**Capabilities:**

- Analyze structured logs (Pino JSON)
- Query metrics and traces
- Debug failed evaluations or promotions
- Generate incident response runbooks
- Database health checks and query analysis

**Usage:**

```
@agent operations --action="diagnose" --target="promotion-failure" --prompt-id="abc123"
@agent operations --action="logs" --service="server" --since="1h"
@agent operations --action="runbook" --incident="eval-harness-down"
```

## Skill Execution Framework

### Context Management

Each skill operates with access to:

- Full project file system
- Git history and branches
- Environment variables
- External API documentation
- Package registry information
- Running service logs (when available)

### Output Standards

All skill outputs follow:

- **Code**: Prettier formatted, ESLint compliant
- **Tests**: Vitest syntax, 85%+ coverage target
- **Docs**: Markdown with consistent heading structure
- **Config**: YAML with comments for complex sections

### Error Handling

Skills implement:

- Graceful degradation on missing context
- Clear error messages with remediation steps
- Rollback capabilities for destructive operations
- Audit logging for all changes

## Integration with Development Workflow

> **Note:** The `@agent` / `pnpm agent` interface is the target CLI for this project (see `packages/cli/`). Until the agent runtime is fully implemented, skills are invoked directly by AI assistants reading the skill definitions in `skills/*.md`.

### Pre-commit

```bash
# Run code generation skill
pnpm agent code-generation --staged

# Run test generation for changed files
pnpm agent test-generation --changed

# Run code review
pnpm agent code-review --staged
```

### CI/CD

```yaml
# .github/workflows/agent.yml
jobs:
  agent-review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run Agent Code Review
        run: pnpm agent code-review --ci
```

### Local Development

```bash
# Generate boilerplate for new feature
pnpm agent code-generation --feature="metrics-ingestion"

# Generate tests for new service
pnpm agent test-generation --target="src/services/metrics.service.ts"

# Update documentation
pnpm agent documentation --type="api" --watch
```

## Skill Configuration

### Skill-Specific Settings

Each skill can be configured in `.agentskillsrc`:

```json
{
  "code-generation": {
    "style": "functional",
    "patterns": ["repository", "service", "controller"],
    "exclude": ["**/*.test.ts", "**/node_modules/**"]
  },
  "test-generation": {
    "framework": "vitest",
    "coverage": {
      "threshold": 85,
      "include": ["src/**/*.ts"],
      "exclude": ["src/**/*.d.ts"]
    }
  },
  "documentation": {
    "format": "markdown",
    "autoGenerate": true,
    "includeDiagrams": true
  }
}
```

## Contributing New Skills

To add a new agent skill:

1. Create `skills/<skill-name>.md` with skill definition
2. Implement skill handler in `packages/cli/src/skills/<skill-name>.ts`
3. Add tests in `packages/cli/src/skills/__tests__/<skill-name>.test.ts`
4. Register skill in `packages/cli/src/skills/index.ts`
5. Update this AGENTS.md documentation

### Skill Template

```typescript
// skills/example-skill.ts
import { Skill, SkillContext } from './types';

export const exampleSkill: Skill = {
  name: 'example-skill',
  description: 'Description of what this skill does',

  async execute(ctx: SkillContext, args: Record<string, unknown>) {
    // Skill implementation
    return {
      success: true,
      changes: [],
      message: 'Skill completed successfully',
    };
  },
};
```

## Best Practices

1. **Atomic Operations**: Each skill should perform one well-defined task
2. **Idempotency**: Skills should be safe to run multiple times
3. **Rollback Support**: Destructive operations must have rollback plans
4. **Audit Trail**: All changes should be logged and traceable
5. **Human Review**: Critical changes require human approval

## Support

For questions or issues with agent skills:

- GitHub Issues: [reaatech/prompt-version-control/issues](https://github.com/reaatech/prompt-version-control/issues)
- Documentation: [docs/](./docs/)
- Skill Definitions: [skills/](./skills/)
