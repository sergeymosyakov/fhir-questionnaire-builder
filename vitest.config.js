import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    coverage: {
      provider: 'v8',
      include: ['js/fhir/**'],
      thresholds: {
        statements: 60,
        branches:   70,
        functions:  75,
        lines:      60,
      },
    },
  },
});
