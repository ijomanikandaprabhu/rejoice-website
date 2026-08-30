import path from 'node:path';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // `server-only` is a Next.js build-time guard with no runtime behaviour.
      'server-only': path.resolve(__dirname, './tests/stubs/server-only.ts'),
    },
  },
});
