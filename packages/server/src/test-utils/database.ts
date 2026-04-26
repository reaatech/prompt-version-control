import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';
import { randomUUID } from 'crypto';

export async function createTestDatabase() {
  const testDbName = `test_${randomUUID().replace(/-/g, '_')}`;

  // Create test database
  execSync(`createdb ${testDbName}`, { env: { ...process.env, PGUSER: 'postgres' } });

  const testUrl = `postgresql://postgres@localhost:5432/${testDbName}`;

  const prisma = new PrismaClient({
    datasources: {
      db: { url: testUrl },
    },
  });

  // Run migrations
  execSync(`npx prisma migrate deploy`, {
    env: { ...process.env, DATABASE_URL: testUrl },
    cwd: process.cwd(),
  });

  // Create test project and API key
  const project = await prisma.project.create({
    data: { name: 'Test Project', slug: `test-${Date.now()}` },
  });

  const apiKey = await prisma.apiKey.create({
    data: {
      projectId: project.id,
      name: 'test-key',
      keyHash: 'hashed-test-key',
      prefix: 'test_',
      permissions: { admin: true },
    },
  });

  return {
    prisma,
    project,
    apiKey,
    dbName: testDbName,
    url: testUrl,
    cleanup: async () => {
      await prisma.$disconnect();
      execSync(`dropdb ${testDbName}`, { env: { ...process.env, PGUSER: 'postgres' } });
    },
  };
}
