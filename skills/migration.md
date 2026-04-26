# Skill: Migration

Manages database migrations and data transformations for the Prompt Version Control project, ensuring safe schema evolution and data integrity.

## Capabilities

- **Prisma Migrations**: Generate and manage database schema changes
- **Data Backfill**: Create scripts for populating new fields
- **Rollback Planning**: Generate safe rollback procedures
- **Migration Testing**: Validate migrations before deployment
- **Schema Evolution**: Track and document schema changes
- **Data Transformation**: Transform existing data to new formats

## Usage

### Basic Usage

```bash
# Generate a new migration
@agent migration --action="generate" --description="add prompt tags"

# Create backfill script
@agent migration --action="backfill" --table="versions" --field="checksum"

# Plan rollback
@agent migration --action="rollback-plan" --migration="20240115_add_tags"

# Test migration
@agent migration --action="test" --migration="20240115_add_tags"

# List pending migrations
@agent migration --action="status"
```

### Command Line Options

| Option          | Description                                                        | Default |
| --------------- | ------------------------------------------------------------------ | ------- |
| `--action`      | Migration action (generate, backfill, rollback-plan, test, status) | -       |
| `--description` | Description of schema change                                       | -       |
| `--table`       | Table name for backfill                                            | -       |
| `--field`       | Field name for backfill                                            | -       |
| `--migration`   | Migration identifier                                               | -       |
| `--dry-run`     | Show changes without applying                                      | false   |
| `--force`       | Force migration execution                                          | false   |

## Migration Types

### 1. Schema Migrations

#### Adding a Column

```prisma
// Before
model Prompt {
  id          String   @id @default(cuid())
  name        String
  template    String
  createdAt   DateTime @default(now())
}

// After
model Prompt {
  id          String   @id @default(cuid())
  name        String
  description String?  // NEW: Optional field
  template    String
  metadata    Json?    // NEW: Optional JSON field
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt // NEW: Auto-updating field
}
```

Generated migration:

```sql
-- Migration: add_description_and_metadata
-- AlterTable
ALTER TABLE "prompts"
  ADD COLUMN "description" TEXT,
  ADD COLUMN "metadata" JSONB,
  ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
```

#### Adding a New Table

```prisma
// New model
model Tag {
  id        String   @id @default(cuid())
  projectId String
  promptId  String
  versionId String
  name      String   // draft, staging, production
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  project   Project  @relation(fields: [projectId], references: [id])
  prompt    Prompt   @relation(fields: [promptId], references: [id])
  version   Version  @relation(fields: [versionId], references: [id])

  @@unique([promptId, name])
}
```

Generated migration:

```sql
-- CreateTable
CREATE TABLE "tags" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "prompt_id" TEXT,
    "version_id" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "tags"
  ADD CONSTRAINT "tags_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id");

-- CreateIndex
CREATE UNIQUE INDEX "tags_project_id_prompt_id_name_key"
  ON "tags"("project_id", "prompt_id", "name");
```

#### Adding Indexes

```prisma
model Version {
  id        String   @id @default(cuid())
  promptId  String
  number    Int
  content   String
  createdAt DateTime @default(now())

  @@unique([promptId, number])
  @@index([promptId, createdAt]) // NEW: Index for listing versions
  @@index([checksum]) // NEW: Index for deduplication
}
```

Generated migration:

```sql
-- CreateIndex
CREATE INDEX "versions_prompt_id_created_at_idx"
  ON "versions"("prompt_id", "created_at");

-- CreateIndex
CREATE INDEX "versions_checksum_idx"
  ON "versions"("checksum");
```

### 2. Data Backfill Scripts

#### Simple Field Population

```typescript
// migrations/backfills/20240115_populate_checksums.ts
import { prisma } from '../../packages/server/src/db/client';
import crypto from 'crypto';

export async function up() {
  console.log('Populating checksums for existing versions...');

  const batchSize = 1000;
  let processed = 0;

  while (true) {
    const versions = await prisma.version.findMany({
      where: { checksum: null },
      take: batchSize,
      select: { id: true, content: true },
    });

    if (versions.length === 0) break;

    const updates = versions.map((version) =>
      prisma.version.update({
        where: { id: version.id },
        data: {
          checksum: crypto.createHash('sha256').update(version.content).digest('hex'),
        },
      }),
    );

    await prisma.$transaction(updates);
    processed += versions.length;
    console.log(`Processed ${processed} versions...`);
  }

  console.log(`Completed: ${processed} versions updated`);
}

export async function down() {
  console.log('Clearing checksums...');
  await prisma.version.updateMany({
    data: { checksum: null },
  });
  console.log('Checksums cleared');
}
```

#### Complex Data Transformation

```typescript
// migrations/backfills/20240115_migrate_template_format.ts
import { prisma } from '../../packages/server/src/db/client';

interface OldPromptFormat {
  id: string;
  content: string;
  variables: string[];
}

interface NewPromptFormat {
  id: string;
  template: string;
  variables: Record<string, string>;
}

function transformPrompt(old: OldPromptFormat): NewPromptFormat {
  // Convert from old format to new Jinja2-style template
  let template = old.content;
  const variables: Record<string, string> = {};

  old.variables.forEach((varName) => {
    // Convert {{varName}} to {{varName}} (already compatible)
    // Infer type from usage
    const regex = new RegExp(`{{\\s*${varName}\\s*}}`, 'g');
    const matches = template.match(regex);
    variables[varName] = 'string'; // Default to string
  });

  return {
    id: old.id,
    template,
    variables,
  };
}

export async function up() {
  console.log('Migrating prompt templates...');

  const prompts = await prisma.prompt.findMany({
    select: { id: true, content: true, variables: true },
  });

  for (const prompt of prompts) {
    const transformed = transformPrompt({
      id: prompt.id,
      content: prompt.content as unknown as string,
      variables: prompt.variables as unknown as string[],
    });

    await prisma.prompt.update({
      where: { id: prompt.id },
      data: {
        template: transformed.template,
        variables: transformed.variables,
      },
    });
  }

  console.log(`Migrated ${prompts.length} prompts`);
}

export async function down() {
  console.log('Rolling back template migration...');
  // Reverse transformation if needed
}
```

### 3. Rollback Plans

#### Safe Rollback Generation

````typescript
// migrations/rollback-plans/20240115_add_tags.md

# Rollback Plan: Remove Tags Table

## Risk Assessment
- **Risk Level**: LOW
- **Data Loss**: YES - All tag data will be deleted
- **Downtime**: NO - Can be done online
- **Dependencies**: None

## Pre-Rollback Checklist
- [ ] Export tag data for backup
- [ ] Notify users about tag removal
- [ ] Ensure no active deployments reference tags

## Rollback Steps

### Step 1: Backup Data
```sql
COPY (SELECT * FROM tags) TO '/backup/tags_backup.csv' WITH CSV HEADER;
````

### Step 2: Remove Foreign Keys

```sql
ALTER TABLE "tags" DROP CONSTRAINT "tags_project_id_fkey";
ALTER TABLE "tags" DROP CONSTRAINT "tags_prompt_id_fkey";
ALTER TABLE "tags" DROP CONSTRAINT "tags_version_id_fkey";
```

### Step 3: Drop Table

```sql
DROP TABLE "tags";
```

### Step 3: Verify

```sql
SELECT COUNT(*) FROM tags; -- Should return 0
```

## Rollback Script

```bash
#!/bin/bash
# migrations/rollback/20240115_add_tags.sh

set -e

echo "Starting rollback of tags migration..."

# Backup
pg_dump -t tags $DATABASE_URL > tags_backup.sql

# Drop table
psql $DATABASE_URL -c "DROP TABLE IF EXISTS tags CASCADE;"

echo "Rollback complete"
```

## Recovery Plan

If rollback fails:

1. Restore from database backup
2. Run: `psql $DATABASE_URL < backup_before_migration.sql`
3. Contact DBA if issues persist

````

## Migration Workflow

### Development Workflow

```bash
# 1. Create migration
@agent migration --action="generate" --description="add evaluation scores"

# 2. Review generated migration
cat packages/server/prisma/migrations/20240115_add_eval_scores/migration.sql

# 3. Test locally
@agent migration --action="test" --migration="20240115_add_eval_scores"

# 4. Create backfill if needed
@agent migration --action="backfill" --table="evaluations" --field="score"

# 5. Commit migration files
git add packages/server/prisma/migrations/
git commit -m "feat: add evaluation scores"
````

### Production Deployment

```bash
# 1. Create backup (automatic in most setups)
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql

# 2. Run migration
@agent migration --action="deploy" --migration="20240115_add_eval_scores"

# 3. Verify migration
@agent migration --action="status"

# 4. Monitor for issues
# Check application logs and database performance
```

## Migration Templates

### Schema Migration Template

```sql
-- Migration: {{description}}
-- Date: {{date}}
-- Author: {{author}}

-- Description of what this migration does

-- Step 1: {{step1_description}}
{{step1_sql}}

-- Step 2: {{step2_description}}
{{step2_sql}}

-- Verification
-- SELECT COUNT(*) FROM {{table}}; -- Expected: {{expected_count}}
```

### Backfill Script Template

```typescript
// migrations/backfills/{{date}}_{{description}}.ts
import { prisma } from '../../packages/server/src/db/client';

export async function up() {
  console.log('Starting backfill: {{description}}...');

  const batchSize = 1000;
  let processed = 0;

  while (true) {
    const records = await prisma.{{table}}.findMany({
      where: { {{field}}: null },
      take: batchSize,
    });

    if (records.length === 0) break;

    // Process batch
    const updates = records.map((record) =>
      prisma.{{table}}.update({
        where: { id: record.id },
        data: { {{field}}: /* calculate value */ },
      })
    );

    await prisma.$transaction(updates);
    processed += records.length;
    console.log(`Processed ${processed} records...`);
  }

  console.log(`Completed: ${processed} records updated`);
}

export async function down() {
  console.log('Rolling back backfill...');
  await prisma.{{table}}.updateMany({
    data: { {{field}}: null },
  });
}
```

## Configuration

### .migrationrc

```json
{
  "database": {
    "url": "DATABASE_URL",
    "poolSize": 10,
    "timeout": 30000
  },
  "migrations": {
    "directory": "packages/server/prisma/migrations",
    "backfillDirectory": "migrations/backfills",
    "rollbackDirectory": "migrations/rollback-plans"
  },
  "backup": {
    "enabled": true,
    "directory": "./backups",
    "retention": 7
  },
  "validation": {
    "checkConstraints": true,
    "verifyIndexes": true,
    "testRollback": true
  }
}
```

## Examples

### Example 1: Add New Column with Default

```bash
@agent migration --action="generate" --description="add archived status to prompts"
```

Generates:

- Migration file to add `archived` column with default `false`
- Backfill script (not needed for default value)
- Rollback plan

### Example 2: Create New Table with Relationships

```bash
@agent migration --action="generate" --description="add deployments for A/B testing"
```

Generates:

- Migration to create `deployments` table
- Migration to create `deployment_variants` table
- Foreign key constraints
- Indexes for performance

### Example 3: Backfill Existing Data

```bash
@agent migration --action="backfill" --table="versions" --field="checksum"
```

Generates:

- Backfill script to calculate SHA256 checksums
- Progress logging
- Rollback capability

### Example 4: Test Migration Before Deploy

```bash
@agent migration --action="test" --migration="20240115_add_deployments" --dry-run
```

Output:

- SQL that will be executed
- Estimated execution time
- Potential issues
- Rollback verification

## Best Practices

### 1. Migration Safety

- **Always backup before production migrations**
- **Test migrations on staging first**
- **Use transactions for multi-step migrations**
- **Keep migrations small and focused**
- **Never modify existing migrations**

### 2. Performance Considerations

- **Add indexes concurrently** (PostgreSQL):
  ```sql
  CREATE INDEX CONCURRENTLY idx_name ON table(column);
  ```
- **Batch large updates** to avoid lock contention
- **Monitor long-running migrations**
- **Consider lock timeouts**

### 3. Data Integrity

- **Validate data before and after migration**
- **Use foreign key constraints**
- **Add unique constraints where appropriate**
- **Test rollback procedures**

### 4. Documentation

- **Document migration purpose**
- **Include rollback instructions**
- **Note any data transformations**
- **Record migration timing**

## Error Handling

The skill provides clear error messages for:

- Migration syntax errors
- Constraint violations
- Data type mismatches
- Rollback failures
- Connection issues

## Integration

Migrations integrate with:

- **Prisma CLI**: Schema management
- **PostgreSQL**: Database operations
- **CI/CD Pipeline**: Automated testing
- **Monitoring**: Migration performance tracking
- **Backup Systems**: Data protection
