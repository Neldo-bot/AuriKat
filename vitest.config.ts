import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@aurikat/core-engine': path.resolve(__dirname, 'packages/core-engine/src/index.ts'),
      '@aurikat/clinical-envelope': path.resolve(__dirname, 'packages/clinical-envelope/src/index.ts'),
      '@aurikat/clinical-scoring': path.resolve(__dirname, 'packages/clinical-scoring/src/index.ts'),
    },
  },
  test: {
    environment: 'node',
    include: ['packages/**/*.test.ts'],
    globals: false,
  },
});
