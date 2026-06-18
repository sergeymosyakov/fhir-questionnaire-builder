// ── E2E: SDC Definition-based Extraction ─────────────────────────────────────
// Tests: Save menu has extract item, modal opens, extraction runs.
//
// Tested elements:
//   export-def-extract-item — menu item in Save ▾
//   defExtract              — modal testid

import { test, expect } from '@playwright/test';
import path from 'node:path';
import { freshStart } from './helpers/builder.js';
import { openDropdownItem } from './helpers/dropdown.js';

const FIXTURE = path.resolve('tests/fixtures/def-extract.fhir.json');

async function loadFixture(page) {
  await freshStart(page);
  await page.locator('[data-testid="fhir-file-input"]').setInputFiles(FIXTURE);
  // Wait for at least one node to appear in the builder tree
  await page.waitForSelector('[data-testid="tree-container"] [data-node-id]', { timeout: 15_000 });
}

test.describe('SDC Definition Extract', () => {
  test('Definition Extract item is visible in Save menu', async ({ page }) => {
    await loadFixture(page);
    await expect(async () => {
      if (!(await page.getByTestId('export-def-extract-item').isVisible())) {
        await page.getByTestId('export-btn').click();
      }
      await expect(page.getByTestId('export-def-extract-item')).toBeVisible();
    }).toPass();
    await page.keyboard.press('Escape');
  });

  test('clicking Definition Extract opens modal', async ({ page }) => {
    await loadFixture(page);
    await openDropdownItem(page, 'export-btn', 'export-def-extract-item');
    await expect(page.locator('[data-testid="defExtract"]').first()).toBeVisible();
  });

  test('modal shows resources or warning', async ({ page }) => {
    await loadFixture(page);
    await openDropdownItem(page, 'export-btn', 'export-def-extract-item');
    const modal = page.locator('[data-testid="defExtract"]').first();
    await expect(modal).toBeVisible();
    const bodyText = await modal.locator('.modal-body').textContent();
    expect(bodyText.length).toBeGreaterThan(0);
  });

  test('modal closes on × button', async ({ page }) => {
    await loadFixture(page);
    await openDropdownItem(page, 'export-btn', 'export-def-extract-item');
    const modal = page.locator('[data-testid="defExtract"]').first();
    await expect(modal).toBeVisible();
    await modal.locator('.modal-close').click();
    await expect(modal).not.toBeVisible();
  });
});
