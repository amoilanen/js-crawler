import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['spec/**/*.spec.ts', 'e2e/**/*.e2e.spec.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/index.ts'],
      thresholds: {
        lines: 90,
        branches: 85,
        functions: 90,
      },
    },
  },
});
