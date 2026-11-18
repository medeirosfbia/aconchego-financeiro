import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  esbuild: {
    jsx: 'automatic',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/tests/setup.ts'],
    include: ['src/tests/**/*.test.{ts,tsx}'],
    globals: false,
  },
});
