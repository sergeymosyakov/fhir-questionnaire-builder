// ── E2E: modal focus management (a11y) ───────────────────────────────────────
// Verifies the shared Modal base provides:
//   • focus moves into the dialog on open (role="dialog", aria-modal)
//   • Tab focus is trapped inside the dialog
//   • focus returns to the opener when the dialog closes
//
// data-testid registry:
//   fhir-file-input   — questionnaire file input
//   action-codes      — "Props" button on an item card (opener)
//   codesModal        — Item Properties modal
// ─────────────────────────────────────────────────────────────────────────────

import { test, expect } from '@playwright/test';
import path from 'node:path';
import { freshStart } from './helpers/builder.js';

const FIXTURE = path.resolve('sampledata/phq-9.fhir.json');

async function load(page) {
  await freshStart(page);
  await page.locator('[data-testid="fhir-file-input"]').setInputFiles(FIXTURE);
  await expect(page.locator('[data-testid="preview-panel"] [data-preview-id]').first())
    .toBeVisible({ timeout: 8_000 });
}

const focusInModal = (page) => page.evaluate(() => {
  const box = document.querySelector('[data-testid="codesModal"] .modal-box');
  return !!box && box.contains(document.activeElement);
});

test.describe('modal focus management', () => {
  test('dialog has role and aria-modal', async ({ page }) => {
    await load(page);
    const opener = page.locator('[data-node-id] [data-testid="action-codes"]').first();
    await expect(opener).toBeVisible();
    await opener.click();
    const box = page.locator('[data-testid="codesModal"] .modal-box');
    await expect(box).toBeVisible();
    await expect(box).toHaveAttribute('role', 'dialog');
    await expect(box).toHaveAttribute('aria-modal', 'true');
  });

  test('focus moves into the dialog on open', async ({ page }) => {
    await load(page);
    await page.locator('[data-node-id] [data-testid="action-codes"]').first().click();
    await expect(page.locator('[data-testid="codesModal"] .modal-box')).toBeVisible();
    expect(await focusInModal(page)).toBe(true);
  });

  test('Tab keeps focus trapped inside the dialog', async ({ page }) => {
    await load(page);
    await page.locator('[data-node-id] [data-testid="action-codes"]').first().click();
    await expect(page.locator('[data-testid="codesModal"] .modal-box')).toBeVisible();
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press('Tab');
      expect(await focusInModal(page)).toBe(true);
    }
    await page.keyboard.press('Shift+Tab');
    expect(await focusInModal(page)).toBe(true);
  });

  test('closing returns focus to the opener', async ({ page }) => {
    await load(page);
    const opener = page.locator('[data-node-id] [data-testid="action-codes"]').first();
    await opener.click();
    await expect(page.locator('[data-testid="codesModal"] .modal-box')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.locator('[data-testid="codesModal"]')).toBeHidden();
    await expect(opener).toBeFocused();
  });
});
