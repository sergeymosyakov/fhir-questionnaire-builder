// ── E2E: questionnaire-supportLink feature ────────────────────────────────────
//
// Tests that supportLink URIs imported from FHIR are:
//   1. Parsed and shown as 🔗 icons in builder preview
//   2. Shown as "More info ↗" buttons in patient view
//   3. Editable via the "Props" modal — Support Links collapsible section
//
// Fixture: tests/fixtures/support-link.fhir.json
//   q-single   — item with ONE supportLink (https://example.com/help1)
//   q-multi    — item with TWO supportLinks
//   q-none     — item with NO supportLinks
//
// Run: npx playwright test tests/e2e/support-link.spec.js
//
// ── data-testid registry ──────────────────────────────────────────────────────
//   support-link-icon          — 🔗 anchor in builder preview (one per link)
//   support-link-patient-btn   — "More info ↗" anchor in patient view (one per link)
//   action-codes               — "Props" button on item/group node card
//   item-props-sl-toggle       — "▼ Support Links" collapsible toggle inside Props modal
//   support-link-add           — "+ Add link" button inside Props modal
//   support-link-input         — URL input field inside Props modal (one per entry)
//   support-link-rm            — ✕ remove button inside Props modal (one per entry)
// ─────────────────────────────────────────────────────────────────────────────

import path from 'node:path';
import { test, expect } from '@playwright/test';

const FIXTURE = path.resolve('tests/fixtures/support-link.fhir.json');

async function waitForLoad(page) {
  await page.waitForSelector('[data-testid="add-root-group-btn"]', { timeout: 10_000 });
}

async function loadFixture(page) {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/');
  await waitForLoad(page);
  await page.locator('[data-testid="fhir-file-input"]').setInputFiles(FIXTURE);
  await expect(page.locator('[data-preview-id="q-single"]')).toBeVisible({ timeout: 8_000 });
}

// ── builder preview ──────────────────────────────────────────────────────────

test.describe('support-link — builder preview', () => {
  test('shows one 🔗 icon for an item with a single supportLink', async ({ page }) => {
    await loadFixture(page);
    const row = page.locator('[data-preview-id="q-single"]');
    await expect(row.getByTestId('support-link-icon')).toHaveCount(1);
  });

  test('shows two 🔗 icons for an item with two supportLinks', async ({ page }) => {
    await loadFixture(page);
    const row = page.locator('[data-preview-id="q-multi"]');
    await expect(row.getByTestId('support-link-icon')).toHaveCount(2);
  });

  test('shows no 🔗 icon for an item without supportLinks', async ({ page }) => {
    await loadFixture(page);
    const row = page.locator('[data-preview-id="q-none"]');
    await expect(row.getByTestId('support-link-icon')).toHaveCount(0);
  });

  test('icon href matches the imported URL', async ({ page }) => {
    await loadFixture(page);
    const icon = page.locator('[data-preview-id="q-single"]').getByTestId('support-link-icon').first();
    await expect(icon).toHaveAttribute('href', 'https://example.com/help1');
  });

  test('icon opens in a new tab (target=_blank)', async ({ page }) => {
    await loadFixture(page);
    const icon = page.locator('[data-preview-id="q-single"]').getByTestId('support-link-icon').first();
    await expect(icon).toHaveAttribute('target', '_blank');
  });
});

// ── patient view ─────────────────────────────────────────────────────────────

test.describe('support-link — patient view', () => {
  test('shows one "More info" button in patient view for single-link item', async ({ page }) => {
    await loadFixture(page);
    // Switch to patient view
    await page.getByTestId('preview-mode-btn').click();
    await page.getByTestId('preview-mode-patient').click();
    const row = page.locator('[data-preview-id="q-single"]');
    await expect(row.getByTestId('support-link-patient-btn')).toHaveCount(1);
  });

  test('patient button has correct href and opens in new tab', async ({ page }) => {
    await loadFixture(page);
    await page.getByTestId('preview-mode-btn').click();
    await page.getByTestId('preview-mode-patient').click();
    const btn = page.locator('[data-preview-id="q-single"]').getByTestId('support-link-patient-btn').first();
    await expect(btn).toHaveAttribute('href', 'https://example.com/help1');
    await expect(btn).toHaveAttribute('target', '_blank');
  });

  test('shows two "More info" buttons for two-link item in patient view', async ({ page }) => {
    await loadFixture(page);
    await page.getByTestId('preview-mode-btn').click();
    await page.getByTestId('preview-mode-patient').click();
    const row = page.locator('[data-preview-id="q-multi"]');
    await expect(row.getByTestId('support-link-patient-btn')).toHaveCount(2);
  });

  test('no "More info" button for item without supportLinks in patient view', async ({ page }) => {
    await loadFixture(page);
    await page.getByTestId('preview-mode-btn').click();
    await page.getByTestId('preview-mode-patient').click();
    const row = page.locator('[data-preview-id="q-none"]');
    await expect(row.getByTestId('support-link-patient-btn')).toHaveCount(0);
  });
});

// ── builder panel ─────────────────────────────────────────────────────────────

test.describe('support-link — Props modal', () => {
  async function openPropsModal(page, nodeId) {
    await page.locator(`[data-node-id="${nodeId}"] [data-testid="action-codes"]`).click();
    await expect(page.locator('[data-testid="codesModal"]')).toBeVisible({ timeout: 3000 });
    // Expand the Support Links section if not already open
    const addBtn = page.getByTestId('support-link-add');
    if (!await addBtn.isVisible()) {
      await page.getByTestId('item-props-sl-toggle').click();
    }
  }

  test('Props button is highlighted (active) for item with support links', async ({ page }) => {
    await loadFixture(page);
    const btn = page.locator('[data-node-id="q-single"] [data-testid="action-codes"]');
    await expect(btn).toHaveClass(/action-edit--active/);
  });

  test('Props button is NOT highlighted for item without support links or codes', async ({ page }) => {
    await loadFixture(page);
    const btn = page.locator('[data-node-id="q-none"] [data-testid="action-codes"]');
    await expect(btn).not.toHaveClass(/action-edit--active/);
  });

  test('Support Links section shows existing URL in input', async ({ page }) => {
    await loadFixture(page);
    await openPropsModal(page, 'q-single');
    const input = page.getByTestId('support-link-input').first();
    await expect(input).toHaveValue('https://example.com/help1');
  });

  test('two inputs shown for item with two support links', async ({ page }) => {
    await loadFixture(page);
    await openPropsModal(page, 'q-multi');
    await expect(page.getByTestId('support-link-input')).toHaveCount(2);
  });

  test('"+ Add link" adds a new empty input row', async ({ page }) => {
    await loadFixture(page);
    await openPropsModal(page, 'q-single');
    const before = await page.getByTestId('support-link-input').count();
    await page.getByTestId('support-link-add').click();
    await expect(page.getByTestId('support-link-input')).toHaveCount(before + 1);
  });

  test('removing a link and applying updates the preview icon count', async ({ page }) => {
    await loadFixture(page);
    await openPropsModal(page, 'q-multi');
    // q-multi has 2 links — remove first
    await page.getByTestId('support-link-rm').first().click();
    await page.locator('[data-testid="codesModalApply"]').click();
    // Preview should now show 1 icon
    await expect(
      page.locator('[data-preview-id="q-multi"]').getByTestId('support-link-icon')
    ).toHaveCount(1, { timeout: 3000 });
  });
});

