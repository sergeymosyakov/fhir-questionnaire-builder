import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  expect: { timeout: 8_000 },

  // Start the static server before tests; reuse an already-running one locally.
  webServer: {
    command: 'npx serve . --listen 3000',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 15_000,
  },

  use: {
    baseURL: 'http://localhost:3000',
    // data-testid is the default for getByTestId(), explicit here for clarity.
    testIdAttribute: 'data-testid',
  },

  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
});
