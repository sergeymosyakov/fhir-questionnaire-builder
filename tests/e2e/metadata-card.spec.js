// ── E2E: Questionnaire metadata card ─────────────────────────────────────────
// Card visibility, status badge, and reset-on-clear behaviour.
//
// Run: npx playwright test tests/e2e/metadata-card.spec.js
//
// ── data-testid registry ──────────────────────────────────────────────────────
//   quest-meta-card        compact card above Variables (left panel)
//   quest-meta-status      status badge inside the card
//   properties-btn         "Edit" button that opens the metadata modal
//   add-root-group-btn     add root group button
//   clear-form-btn         clear/reset button
//   clear-confirm-clear-btn confirm clear button
//   metadataModalCancel    (id) Cancel button
//   meta-id                (data-testid) id input inside modal body
//   meta-url               (data-testid) url input
//   meta-title             (data-testid) title input
// ─────────────────────────────────────────────────────────────────────────────

import { test, expect } from '@playwright/test';
import { freshStart, loadFixture, openModal } from './helpers/metadata.js';

// ── Card visibility ───────────────────────────────────────────────────────────

test.describe('metadata card — visibility', () => {
  test('card is hidden on fresh load (no questionnaire)', async ({ page }) => {
    await freshStart(page);
    await expect(page.getByTestId('quest-meta-card')).not.toBeVisible();
  });

  test('card appears after adding a root group', async ({ page }) => {
    await freshStart(page);
    await page.getByTestId('add-root-group-btn').click();
    await expect(page.getByTestId('quest-meta-card')).toBeVisible();
  });

  test('card appears after loading a questionnaire from file', async ({ page }) => {
    await loadFixture(page);
    await expect(page.getByTestId('quest-meta-card')).toBeVisible();
  });
});

// ── Status badge ──────────────────────────────────────────────────────────────

test.describe('metadata card — status badge', () => {
  test('shows "active" after loading a questionnaire with status active', async ({ page }) => {
    await loadFixture(page);
    await expect(page.getByTestId('quest-meta-status')).toHaveText('active');
  });

  test('shows "draft" after adding a new group (default status)', async ({ page }) => {
    await freshStart(page);
    await page.getByTestId('add-root-group-btn').click();
    await expect(page.getByTestId('quest-meta-status')).toHaveText('draft');
  });
});

// ── Reset on form clear ───────────────────────────────────────────────────────

test.describe('metadata card — reset on clear', () => {
  test('questMeta is cleared after using the × clear button', async ({ page }) => {
    await loadFixture(page);
    await expect(page.getByTestId('quest-meta-status')).toHaveText('active');

    await page.getByTestId('clear-form-btn').click();
    await page.waitForSelector('.clear-confirm-backdrop');
    await page.getByTestId('clear-confirm-clear-btn').click();

    await page.getByTestId('add-root-group-btn').click();
    await expect(page.getByTestId('quest-meta-card')).toBeVisible();
    await expect(page.getByTestId('quest-meta-status')).toHaveText('draft');

    await openModal(page);
    await expect(page.getByTestId('meta-id')).toHaveValue('');
    await expect(page.getByTestId('meta-url')).toHaveValue('');
    await expect(page.getByTestId('meta-title')).toHaveValue('');
    await page.locator('[data-testid="metadataModalCancel"]').click();
  });
});
