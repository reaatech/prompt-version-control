# Skill: Code Review

Performs automated code review with security and quality checks for the Prompt Version Control project, ensuring code quality and security standards.

## Capabilities

- **Security Analysis**: Detect vulnerabilities and security issues
- **Performance Review**: Identify performance anti-patterns
- **TypeScript Strict Mode**: Ensure type safety compliance
- **ESLint Enforcement**: Validate coding standards
- **Dependency Scanning**: Check for vulnerable dependencies
- **Code Quality**: Analyze complexity and maintainability
- **Best Practices**: Enforce project conventions

## Usage

### Basic Usage

```bash
# Review all staged changes
@agent code-review --staged

# Review specific files
@agent code-review --files="src/services/prompt.service.ts,src/api/routes/prompts.routes.ts"

# Review pull request
@agent code-review --pr="123" --repo="reaatech/prompt-version-control"

# Review with strict mode
@agent code-review --staged --strict=true

# Review in CI mode (fail on issues)
@agent code-review --ci --staged
```

### Command Line Options

| Option     | Description                       | Default |
| ---------- | --------------------------------- | ------- |
| `--staged` | Review staged git changes         | false   |
| `--files`  | Comma-separated file paths        | -       |
| `--pr`     | Pull request number               | -       |
| `--repo`   | GitHub repository                 | current |
| `--strict` | Fail on any issue                 | false   |
| `--ci`     | CI mode (non-interactive)         | false   |
| `--ignore` | Patterns to ignore                | -       |
| `--output` | Output format (text, json, sarif) | text    |

## Review Categories

### 1. Security Checks

#### SQL Injection Prevention

```typescript
// ❌ BAD: Raw SQL with user input
const result = await prisma.$queryRaw`SELECT * FROM prompts WHERE name = ${userInput}`;

// ✅ GOOD: Parameterized query
const result = await prisma.prompt.findMany({ where: { name: userInput } });
```

#### API Key Handling

```typescript
// ❌ BAD: Logging sensitive data
logger.info({ apiKey: req.headers.authorization }, 'Request');

// ✅ GOOD: Redacted logging
logger.info({ apiKeyPrefix: req.headers.authorization?.slice(0, 8) }, 'Request');
```

#### Input Validation

```typescript
// ❌ BAD: No validation
const { name, template } = await c.req.json();

// ✅ GOOD: Zod validation
const { name, template } = CreatePromptSchema.parse(await c.req.json());
```

#### Authentication Checks

```typescript
// ❌ BAD: Missing auth check
router.post('/prompts', async (c) => { ... });

// ✅ GOOD: Protected route
router.post('/prompts', authMiddleware, async (c) => { ... });
```

### 2. TypeScript Strict Mode

#### No Implicit Any

```typescript
// ❌ BAD: Implicit any
function process(data) {
  return data.value;
}

// ✅ GOOD: Explicit types
function process(data: { value: string }): string {
  return data.value;
}
```

#### Null Safety

```typescript
// ❌ BAD: Possible null access
const name = prompt.name.toUpperCase();

// ✅ GOOD: Null check
const name = prompt?.name?.toUpperCase() ?? 'Unknown';
```

#### Type Assertions

```typescript
// ❌ BAD: Unnecessary type assertion
const name = prompt.name as string;

// ✅ GOOD: Proper typing
const name: string = prompt.name;
```

### 3. Performance Anti-Patterns

#### N+1 Queries

```typescript
// ❌ BAD: N+1 query problem
const prompts = await prisma.prompt.findMany();
for (const prompt of prompts) {
  const versions = await prisma.version.findMany({ where: { promptId: prompt.id } });
}

// ✅ GOOD: Batch loading
const prompts = await prisma.prompt.findMany({ include: { versions: true } });
```

#### Missing Indexes

```typescript
// ❌ BAD: Query without index
await prisma.prompt.findMany({ where: { name: { contains: search } } });

// ✅ GOOD: Indexed query
// Schema: @@index([projectId, name])
await prisma.prompt.findMany({ where: { projectId, name } });
```

#### Large Payloads

```typescript
// ❌ BAD: Returning all fields
const prompts = await prisma.prompt.findMany();

// ✅ GOOD: Select only needed fields
const prompts = await prisma.prompt.findMany({
  select: { id: true, name: true, createdAt: true },
});
```

### 4. Error Handling

#### Proper Error Types

```typescript
// ❌ BAD: Generic error
throw new Error('Something went wrong');

// ✅ GOOD: Specific error
throw new AppError('NOT_FOUND', 404, 'Prompt not found');
```

#### Error Context

```typescript
// ❌ BAD: No error context
catch (error) {
  throw new AppError('DATABASE_ERROR', 500, 'Database error');
}

// ✅ GOOD: Full context
catch (error) {
  logger.error({ error, promptId }, 'Failed to create prompt');
  throw new AppError('DATABASE_ERROR', 500, 'Failed to create prompt', { promptId });
}
```

### 5. Code Quality

#### Function Complexity

```typescript
// ❌ BAD: Too complex
async function processPrompt(data: any) {
  // 100+ lines of mixed logic
}

// ✅ GOOD: Separated concerns
async function validatePrompt(data: PromptData) { ... }
async function createPrompt(data: PromptData) { ... }
async function notifyPromptCreated(prompt: Prompt) { ... }
```

#### Magic Numbers

```typescript
// ❌ BAD: Magic numbers
if (versions.length > 100) { ... }
const timeout = 5000;

// ✅ GOOD: Named constants
const MAX_VERSIONS = 100;
const API_TIMEOUT_MS = 5000;
```

#### Code Duplication

```typescript
// ❌ BAD: Duplicated logic
function createPrompt(data) {
  /* ... */
}
function createVersion(data) {
  /* similar logic */
}

// ✅ GOOD: Extracted utility
function createRecord(type: string, data: RecordData) {
  /* ... */
}
```

## Review Output Format

### Text Output (Default)

```
📋 Code Review Report

📁 packages/server/src/api/routes/prompts.routes.ts
  ⚠️  Line 45: Missing input validation
     → Add Zod schema validation before processing request body
     → Use CreatePromptSchema.parse(body)

  ✅  Line 67: Proper error handling
  ✅  Line 89: Good use of TypeScript types

📁 packages/server/src/services/prompt.service.ts
  🚨 Line 23: Potential SQL injection (HIGH PRIORITY)
     → Use parameterized queries instead of raw SQL
     → Replace $queryRaw with findMany/findUnique

  ⚠️  Line 56: Missing null check
     → Add optional chaining or null check before accessing properties

📊 Summary
  Files reviewed: 2
  Issues found: 3
    🔴 High: 1
    🟡 Medium: 1
    🟢 Low: 1
  Passed checks: 2
```

### JSON Output

```json
{
  "summary": {
    "filesReviewed": 2,
    "issuesFound": 3,
    "passedChecks": 2,
    "severityCounts": {
      "high": 1,
      "medium": 1,
      "low": 1
    }
  },
  "files": [
    {
      "path": "packages/server/src/api/routes/prompts.routes.ts",
      "issues": [
        {
          "line": 45,
          "severity": "medium",
          "category": "validation",
          "message": "Missing input validation",
          "suggestion": "Add Zod schema validation before processing request body",
          "code": "CreatePromptSchema.parse(body)"
        }
      ]
    }
  ]
}
```

### SARIF Output (for GitHub)

```json
{
  "$schema": "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json",
  "version": "2.1.0",
  "runs": [
    {
      "tool": {
        "driver": {
          "name": "pvc-code-review",
          "version": "1.0.0"
        }
      },
      "results": [
        {
          "level": "error",
          "message": {
            "text": "Potential SQL injection vulnerability"
          },
          "locations": [
            {
              "physicalLocation": {
                "artifactLocation": {
                  "uri": "packages/server/src/services/prompt.service.ts"
                },
                "region": {
                  "startLine": 23
                }
              }
            }
          ]
        }
      ]
    }
  ]
}
```

## CI/CD Integration

### GitHub Actions

```yaml
# .github/workflows/code-review.yml
name: Code Review

on:
  pull_request:
    branches: [main]

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'

      - name: Install dependencies
        run: pnpm install

      - name: Run code review
        run: pnpm agent code-review --pr="${{ github.event.pull_request.number }}" --ci

      - name: Upload SARIF results
        uses: github/codeql-action/upload-sarif@v3
        if: always()
        with:
          sarif_file: review-results.sarif
```

### Pre-commit Hook

```bash
# .husky/pre-commit
#!/bin/sh
set +e

# Run code review on staged files
pnpm agent code-review --staged --ci

if [ $? -ne 0 ]; then
  echo "❌ Code review failed. Please fix the issues before committing."
  exit 1
fi
```

## Configuration

### .codereviewrc

```json
{
  "rules": {
    "security": {
      "sqlInjection": "error",
      "xssPrevention": "error",
      "apiKeyHandling": "error",
      "inputValidation": "error"
    },
    "typescript": {
      "noImplicitAny": "error",
      "strictNullChecks": "error",
      "noUnsafeAny": "warn"
    },
    "performance": {
      "nPlus1Queries": "warn",
      "missingIndexes": "warn",
      "largePayloads": "info"
    },
    "codeQuality": {
      "functionComplexity": {
        "level": "warn",
        "maxLines": 50
      },
      "magicNumbers": "info",
      "codeDuplication": "warn"
    }
  },
  "ignore": ["**/*.test.ts", "**/*.d.ts", "**/node_modules/**", "**/dist/**"],
  "severity": {
    "high": ["security.*", "typescript.noImplicitAny"],
    "medium": ["performance.*", "codeQuality.functionComplexity"],
    "low": ["codeQuality.magicNumbers"]
  }
}
```

## Examples

### Example 1: Review Staged Changes

```bash
@agent code-review --staged
```

Reviews all files in git staging area.

### Example 2: Review with Strict Mode

```bash
@agent code-review --staged --strict=true
```

Fails on any issue found, suitable for CI.

### Example 3: Review Specific Files

```bash
@agent code-review --files="src/services/**/*.ts" --ignore="**/*.test.ts"
```

Reviews only service files, excluding tests.

### Example 4: Generate SARIF for GitHub

```bash
@agent code-review --staged --output="sarif" > review-results.sarif
```

Generates SARIF format for GitHub security tab.

## Error Handling

The skill provides clear error messages for:

- Git operation failures
- Invalid file paths
- Syntax errors in code
- Configuration issues
- Permission problems

## Integration

Code review integrates with:

- **ESLint**: Reuses existing lint rules
- **TypeScript Compiler**: Type checking
- **Prettier**: Formatting validation
- **GitHub Actions**: CI/CD integration
- **Security Scanners**: Dependency vulnerability checks

## Best Practices

1. **Review Early**: Run before committing
2. **Fix High Priority First**: Address security issues immediately
3. **Keep Changes Small**: Easier to review
4. **Use Suggestions**: Apply automated fixes when available
5. **Document Exceptions**: Note why certain issues are ignored
