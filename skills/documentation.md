# Skill: Documentation

Generates and maintains comprehensive documentation for the Prompt Version Control project, ensuring clear and up-to-date technical documentation.

## Capabilities

- **API Documentation**: Auto-generate from OpenAPI schemas
- **CLI Reference**: Generate from Clipanion command definitions
- **README Updates**: Sync with code changes
- **Changelog Generation**: From git history
- **Architecture Diagrams**: Generate from code structure
- **Code Comments**: Generate JSDoc from implementation

## Usage

### Basic Usage

```bash
# Generate API documentation
@agent documentation --type="api-reference" --output="docs/api/"

# Generate CLI reference
@agent documentation --type="cli-reference" --output="docs/cli/"

# Update README from recent changes
@agent documentation --type="readme" --sync

# Generate changelog from git
@agent documentation --type="changelog" --since="v1.0.0"

# Generate architecture diagrams
@agent documentation --type="architecture" --output="docs/diagrams/"
```

### Command Line Options

| Option     | Description                          | Default       |
| ---------- | ------------------------------------ | ------------- |
| `--type`   | Documentation type                   | api-reference |
| `--output` | Output directory                     | docs/         |
| `--format` | Output format (markdown, html, json) | markdown      |
| `--since`  | Git tag/commit for changelog         | last tag      |
| `--sync`   | Auto-sync with code changes          | false         |
| `--watch`  | Watch for changes and regenerate     | false         |

## Generated Documentation Standards

### API Reference Documentation

````markdown
# API Reference

## Prompts

### Create Prompt

```http
POST /api/v1/prompts
```
````

Creates a new prompt in the specified project.

#### Request

**Headers:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| Authorization | string | Yes | Bearer token |
| Content-Type | string | Yes | application/json |

**Body:**

```json
{
  "name": "customer-support-prompt",
  "description": "Prompt for customer support responses",
  "template": "You are a helpful customer support agent. Help the user with: {{issue}}",
  "variables": {
    "issue": "string"
  },
  "metadata": {
    "category": "support",
    "tone": "friendly"
  }
}
```

#### Response

**201 Created:**

```json
{
  "id": "prompt_abc123",
  "projectId": "project_xyz",
  "name": "customer-support-prompt",
  "description": "Prompt for customer support responses",
  "template": "You are a helpful customer support agent. Help the user with: {{issue}}",
  "variables": {
    "issue": "string"
  },
  "metadata": {
    "category": "support",
    "tone": "friendly"
  },
  "archived": false,
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-15T10:30:00.000Z"
}
```

**400 Bad Request:**

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": {
      "fields": {
        "name": ["Required"],
        "template": ["Required"]
      }
    }
  }
}
```

**409 Conflict:**

```json
{
  "error": {
    "code": "CONFLICT",
    "message": "Prompt name already exists"
  }
}
```

#### Code Examples

**TypeScript:**

```typescript
import { PromptClient } from '@reaatech/prompt-version-control';

const client = new PromptClient({ apiKey: 'your-api-key' });

const prompt = await client.prompts.create({
  name: 'customer-support-prompt',
  template: 'You are a helpful customer support agent. Help the user with: {{issue}}',
  variables: { issue: 'string' },
});
```

**cURL:**

```bash
curl -X POST https://api.pvc.example.com/api/v1/prompts \
  -H "Authorization: Bearer your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "customer-support-prompt",
    "template": "You are a helpful customer support agent. Help the user with: {{issue}}"
  }'
```

````

### CLI Reference Documentation

```markdown
# CLI Reference

## pvc prompt create

Create a new prompt.

### Usage

```bash
pvc prompt create [options]
````

### Options

| Option          | Short | Required | Description                         |
| --------------- | ----- | -------- | ----------------------------------- |
| `--name`        | `-n`  | Yes      | Name of the prompt                  |
| `--template`    | `-t`  | Yes      | Template file path or content       |
| `--description` | `-d`  | No       | Description of the prompt           |
| `--project`     | `-p`  | No       | Project ID (from config if omitted) |
| `--variables`   | `-v`  | No       | JSON string of variable definitions |

### Examples

**Create a simple prompt:**

```bash
pvc prompt create -n "greeting" -t "Hello {{name}}, welcome to {{app}}!"
```

**Create from file:**

```bash
pvc prompt create -n "email-template" -t ./templates/email.txt
```

**Create with variables:**

```bash
pvc prompt create \
  -n "customer-email" \
  -t "Dear {{customer_name}}, your order {{order_id}} is ready." \
  -v '{"customer_name": "string", "order_id": "string"}'
```

### Interactive Mode

If options are omitted, the CLI will prompt for them:

```bash
$ pvc prompt create
? Prompt name: greeting
? Template (file path or content): Hello {{name}}!
? Description: Simple greeting prompt
✓ Prompt created: prompt_abc123
```

````

### Architecture Documentation

```markdown
# Architecture

## System Overview

Prompt Version Control follows a layered architecture:

````

┌─────────────────────────────────────────────────────────────┐
│ Client Layer │
│ ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐ │
│ │ CLI │ │ SDK │ │ MCP │ │ External │ │
│ └─────┬─────┘ └─────┬─────┘ └─────┬─────┘ └─────┬─────┘ │
└────────┼──────────────┼──────────────┼──────────────┼────────┘
│ │ │ │
└──────────────┴──────┬───────┴──────────────┘
│
▼
┌─────────────────────────────────────────────────────────────┐
│ API Gateway │
│ ┌─────────────────────────────────────────────────────────┐│
│ │ Auth │ Rate Limit │ Validation │ Logging │ CORS ││
│ └─────────────────────────────────────────────────────────┘│
└─────────────────────────────┬───────────────────────────────┘
│
▼
┌─────────────────────────────────────────────────────────────┐
│ Application Layer │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ │
│ │ Prompt │ │ Eval │ │ Deploy │ │
│ │ Service │ │ Service │ │ Service │ │
│ └──────────────┘ └──────────────┘ └──────────────┘ │
└─────────────────────────────┬───────────────────────────────┘
│
▼
┌─────────────────────────────────────────────────────────────┐
│ Data Layer │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ │
│ │ PostgreSQL │ │ Redis │ │ S3/Local │ │
│ └──────────────┘ └──────────────┘ └──────────────┘ │
└─────────────────────────────────────────────────────────────┘

```

## Data Flow

### Creating a Prompt Version

1. **Client Request**: POST /api/v1/prompts/{id}/versions
2. **Authentication**: Validate API key
3. **Validation**: Check prompt exists, validate content
4. **Version Number**: Calculate next sequential number
5. **Checksum**: Generate SHA256 of content
6. **Database**: Store version record
7. **Cache Invalidation**: Clear related cache entries
8. **Response**: Return created version

### Promoting to Production

1. **Check Evaluations**: Verify required evals passed
2. **Validate Thresholds**: Check score/cost/latency requirements
3. **Update Tag**: Move production tag to new version
4. **Audit Log**: Record promotion action
5. **Cache Invalidation**: Clear production version cache
6. **Webhook**: Notify subscribers (optional)
```

### Changelog Format

```markdown
# Changelog

## [1.2.0] - 2024-01-15

### Added

- A/B testing with traffic splitting (#42)
- Metrics ingestion API (#38)
- Sticky sessions for deployments (#45)

### Changed

- Improved diff performance by 40% (#41)
- Updated Prisma to v5.8.0 (#44)

### Fixed

- Fixed cache invalidation on tag update (#43)
- Resolved race condition in version creation (#40)

### Security

- Added rate limiting per API key (#39)

## [1.1.0] - 2024-01-08

### Added

- Evaluation gate for promotions (#35)
- Webhook support for eval results (#36)
- Prometheus metrics endpoint (#37)

### Fixed

- Fixed pagination cursor encoding (#34)
```

## Documentation Templates

### API Endpoint Template

```markdown
# {{method}} {{path}}

{{description}}

## Request

### Headers

{{headers_table}}

### Parameters

{{parameters_table}}

### Body

{{body_schema}}

## Response

### {{status_code}} {{status_text}}

{{response_schema}}

### Error Responses

{{error_responses}}

## Examples

### {{language}}

{{code_example}}
```

### Service Documentation Template

```markdown
# {{service_name}}

## Overview

{{service_description}}

## Methods

{{methods_table}}

## Dependencies

{{dependencies_list}}

## Usage Example

{{usage_example}}
```

## Generation Workflow

### Automatic Generation

```bash
# Watch mode for development
@agent documentation --type="api" --watch

# Pre-commit documentation sync
@agent documentation --type="api" --sync --staged

# Full documentation build
@agent documentation --type="all" --output="docs/"
```

### Git Integration

```bash
# Generate changelog from commits
@agent documentation --type="changelog" --since="v1.0.0" --until="HEAD"

# Update README with latest changes
@agent documentation --type="readme" --sync-with-git
```

## Output Formats

### Markdown (Default)

- Human-readable
- Git-friendly
- GitHub compatible

### HTML

- Styled documentation
- Searchable
- Printable

### JSON

- Machine-readable
- API integration
- Tool consumption

## Quality Standards

Generated documentation must:

1. **Be Accurate**: Match current implementation
2. **Include Examples**: Show practical usage
3. **Document Errors**: Cover error scenarios
4. **Be Searchable**: Proper headings and structure
5. **Stay Current**: Auto-update with code changes
6. **Be Complete**: Cover all public APIs

## Integration

Documentation integrates with:

- **OpenAPI Schemas**: Auto-generated from Hono routes
- **Git History**: For changelog generation
- **Type Definitions**: For API documentation
- **CLI Commands**: For command reference
- **CI/CD Pipeline**: For automated updates

## Examples

### Example 1: Generate Complete API Documentation

```bash
@agent documentation --type="api-reference" --output="docs/api/" --format="markdown"
```

Generates:

- `docs/api/prompts.md`
- `docs/api/versions.md`
- `docs/api/tags.md`
- `docs/api/deployments.md`
- `docs/api/evaluations.md`
- `docs/api/metrics.md`

### Example 2: Generate CLI Reference

```bash
@agent documentation --type="cli-reference" --output="docs/cli/"
```

Generates:

- `docs/cli/overview.md`
- `docs/cli/commands/prompt.md`
- `docs/cli/commands/version.md`
- `docs/cli/commands/tag.md`
- `docs/cli/commands/deploy.md`

### Example 3: Generate Changelog

```bash
@agent documentation --type="changelog" --since="v1.0.0"
```

Generates:

- `CHANGELOG.md` with all changes since v1.0.0

### Example 4: Watch Mode for Development

```bash
@agent documentation --type="api" --watch --output="docs/api/"
```

Automatically regenerates documentation when:

- API routes change
- Schemas are updated
- New endpoints are added

## Error Handling

The skill provides clear error messages for:

- Missing source files
- Invalid OpenAPI schemas
- Git history access issues
- Template rendering errors
- File write permissions

## Best Practices

1. **Keep Documentation Close**: Store with code
2. **Auto-Generate When Possible**: Reduce manual updates
3. **Review Before Committing**: Ensure accuracy
4. **Use Consistent Format**: Follow templates
5. **Include Visual Diagrams**: Architecture and flow diagrams
6. **Link Related Content**: Cross-reference documentation
