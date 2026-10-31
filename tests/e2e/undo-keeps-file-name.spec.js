// ── E2E: undo/redo must not wipe the loaded file name ─────────────────────────
// Fixture: tests/fixtures/answer-options-editor.fhir.json
//
// ── data-testid used in this suite ───────────────────────────────────────────
//   loaded-file-name   file name shown next to the clear button
//   undo-btn           "Undo" item in the More menu (enabled state only; undo runs via Ctrl+Z)
//   add-root-group-btn toolbar button that creates a root group
// ─────────────────────────────────────────────────────────────────────────────

import { test, expect } from '@playwright/test';
import path from 'node:path';
import { loadFixtureFile } from './helpers/load-fixture.js';

const FIXTURE = path.join(process.cwd(), 'tests/fixtures/answer-options-editor.fhir.json');
const HISTORY_TIMEOUT = 3_000;

test('file name survives undo after an edit', async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/');
  await page.waitForSelector('[data-testid="add-root-group-btn"]', { timeout: 10_000 });
  await loadFixtureFile(page, FIXTURE);
  await expect(page.getByTestId('loaded-file-name')).toContainText('answer-options-editor');

  await page.getByTestId('add-root-group-btn').click();
  await expect(page.getByTestId('undo-btn')).toBeEnabled({ timeout: HISTORY_TIMEOUT });
  await page.keyboard.press('Control+z');
  await expect(page.locator('[data-node-id="2"]')).toHaveCount(0);

  await expect(page.getByTestId('loaded-file-name')).toContainText('answer-options-editor');
});
