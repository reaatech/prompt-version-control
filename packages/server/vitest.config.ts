import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    passWithNoTests: true,
    env: {
      DATABASE_URL: 'postgresql://postgres@localhost:5432/pvc_test',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['src/test-utils/', '**/*.d.ts', '**/index.ts'],
    },
  },
});
