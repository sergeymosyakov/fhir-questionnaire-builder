import js from '@eslint/js';
import globals from 'globals';

export default [
  {
    ignores: ['lib/**', 'coverage/**', 'playwright-report/**', 'scripts/**', 'node_modules/**'],
  },
  js.configs.recommended,
  // Source files — browser ES modules
  {
    files: ['js/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
      },
    },
    rules: {
      // Catch real bugs — fail CI
      'no-undef': 'error',
      'no-debugger': 'error',
      // Code smell warnings — visible in CI but don't block deploy
      'no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      }],
      'eqeqeq': ['warn', 'always', { null: 'ignore' }],
    },
  },
  // Unit test files (Vitest) — browser globals, vitest imported explicitly
  {
    files: ['tests/*.test.js', 'tests/*.spec.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
      },
    },
    rules: {
      'no-undef': 'error',
      'no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      }],
    },
  },
  // E2E test files (Playwright) — Node.js runtime
  {
    files: ['tests/e2e/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      'no-undef': 'error',
      'no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      }],
    },
  },
];
