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
        statements: 83,
        branches:   75,
        functions:  86,
        lines:      85,
      },
    },
  },
});
