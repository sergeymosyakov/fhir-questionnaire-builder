import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    setupFiles: ['./tests/setup.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      reportsDirectory: './coverage',
      include: ['js/fhir/**'],
      thresholds: {
        statements: 89,
        branches:   82,
        functions:  92,
        lines:      92,
      },
    },
  },
});
