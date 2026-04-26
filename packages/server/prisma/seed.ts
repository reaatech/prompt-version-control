import { PrismaClient } from '@prisma/client';
import { calculateChecksum, generateApiKey } from '@pvc/shared';

const prisma = new PrismaClient();

async function main() {
  // Create a project
  const project = await prisma.project.create({
    data: {
      name: 'Demo Project',
      slug: 'demo',
    },
  });

  // Create an API key
  const { key, prefix, hash } = generateApiKey();
  await prisma.apiKey.create({
    data: {
      projectId: project.id,
      name: 'Default Key',
      keyHash: hash,
      prefix,
      permissions: { admin: true },
    },
  });

  console.log(`Created project: ${project.id}`);
  console.log(
    `API Key prefix: ${prefix} (save the full key securely — it will not be shown again)`,
  );

  // Create a sample prompt
  const prompt = await prisma.prompt.create({
    data: {
      projectId: project.id,
      name: 'customer-support',
      description: 'Customer support response prompt',
      template: 'You are a {{role}}. Help the user with: {{issue}}',
      variables: {
        role: { type: 'string', required: true, default: 'support agent' },
        issue: { type: 'string', required: true },
      },
    },
  });

  // Create versions
  const v1 = await prisma.version.create({
    data: {
      promptId: prompt.id,
      number: 1,
      content: 'You are a support agent. Help the user with: {{issue}}',
      template: 'You are a {{role}}. Help the user with: {{issue}}',
      variables: {},
      checksum: calculateChecksum('You are a support agent. Help the user with: {{issue}}'),
      metadata: { author: 'seed' },
    },
  });

  const v2 = await prisma.version.create({
    data: {
      promptId: prompt.id,
      number: 2,
      content: 'You are a senior support agent. Help the user with: {{issue}}',
      template: 'You are a {{role}}. Help the user with: {{issue}}',
      variables: {},
      checksum: calculateChecksum('You are a senior support agent. Help the user with: {{issue}}'),
      metadata: { author: 'seed', reason: 'Improved tone' },
    },
  });

  // Tag v2 as production, v1 as staging
  await prisma.tag.create({
    data: {
      projectId: project.id,
      promptId: prompt.id,
      versionId: v2.id,
      name: 'production',
    },
  });

  await prisma.tag.create({
    data: {
      projectId: project.id,
      promptId: prompt.id,
      versionId: v1.id,
      name: 'staging',
    },
  });

  console.log(`Created prompt: ${prompt.name} (${prompt.id})`);
  console.log(`  v1 -> staging`);
  console.log(`  v2 -> production`);
}

main()
  .catch((e: unknown) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
