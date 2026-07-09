// ── E2E: questionnaire-itemControl = flyover ──────────────────────────────────
// Tests that cover the flyover display control:
//   1. Import render — a flyover display item shows an ⓘ marker, not inline text.
//   2. Hover reveals the display text in the rich tooltip.
//   3. A plain display item shows its text inline (no flyover marker).
//   4. Round-trip — the flyover itemControl survives import → export.
//   5. Builder UI — toggling the Flyover checkbox turns a plain display item
//      into a flyover marker in the preview.
//
// Fixture: tests/fixtures/flyover.fhir.json
//
// Run: npx playwright test tests/e2e/flyover.spec.js
//
// ── data-testid registry ─────────────────────────────────────────────────────
//   fhir-file-input           hidden file <input> for Open → FHIR JSON
//   display-flyover           the ⓘ marker rendered in the preview
//   action-type               "Answer Type" config button on an item node
//   answerTypeModal           Answer Type modal backdrop
//   display-flyover-toggle    the Flyover checkbox in the Answer Type modal
//   answerTypeModalApply      Apply button
//   export-btn / export-quest-item / saveFormatModalApply / prompt-save — export flow
// ─────────────────────────────────────────────────────────────────────────────

import path from 'node:path';
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { openDropdownItem } from './helpers/dropdown.js';

const FIXTURE = path.resolve('tests/fixtures/flyover.fhir.json');

// ── Helpers ───────────────────────────────────────────────────────────────────

async function loadFixture(page) {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/');
  await page.waitForSelector('[data-testid="add-root-group-btn"]', { timeout: 10_000 });
  await page.locator('[data-testid="fhir-file-input"]').setInputFiles(FIXTURE);
  await expect(page.locator('[data-preview-id="q1"]')).toBeVisible({ timeout: 8_000 });
}

async function exportFHIR(page) {
  await openDropdownItem(page, 'export-btn', 'export-quest-item');
  await expect(page.locator('[data-testid="saveFormatModal"]')).toBeVisible();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('saveFormatModalApply').click().then(() => page.getByTestId('prompt-save').click()),
  ]);
  return JSON.parse(readFileSync(await download.path(), 'utf8'));
}

// ── 1-3. Import render ────────────────────────────────────────────────────────

test.describe('flyover — import render', () => {
  test('flyover display item renders an ⓘ marker instead of inline text', async ({ page }) => {
    await loadFixture(page);
    const row = page.locator('[data-preview-id="flyover-note"]');
    const marker = row.getByTestId('display-flyover');
    await expect(marker).toBeVisible();
    await expect(marker).toContainText('Flyover');
    // The full display text is NOT shown inline — it lives in the tooltip attribute.
    await expect(row).not.toContainText('government-issued ID');
    await expect(marker).toHaveAttribute('data-tip-body', /government-issued ID/);
  });

  test('hovering the marker reveals the display text in the rich tooltip', async ({ page }) => {
    await loadFixture(page);
    const marker = page.locator('[data-preview-id="flyover-note"]').getByTestId('display-flyover');
    await marker.hover();
    const tip = page.locator('.rich-tooltip');
    await expect(tip).toBeVisible({ timeout: 5_000 });
    await expect(tip).toContainText('government-issued ID');
  });

  test('plain display item shows its text inline (no flyover marker)', async ({ page }) => {
    await loadFixture(page);
    const row = page.locator('[data-preview-id="plain-note"]');
    await expect(row).toContainText('plain display note shown inline');
    await expect(row.getByTestId('display-flyover')).toHaveCount(0);
  });
});

// ── 4. Round-trip ───────────────────────────────────────────────────────────

test.describe('flyover — round-trip', () => {
  test('flyover itemControl survives import → export', async ({ page }) => {
    await loadFixture(page);
    const q = await exportFHIR(page);
    const item = q.item.find(i => i.linkId === 'flyover-note');
    expect(item.type).toBe('display');
    const ic = (item.extension || []).find(e => e.url.includes('questionnaire-itemControl'));
    expect(ic).toBeDefined();
    expect(ic.valueCodeableConcept.coding[0].code).toBe('flyover');
  });
});

// ── 5. Builder UI — toggle flyover on ─────────────────────────────────────────

test.describe('flyover — builder toggle', () => {
  test('checking the Flyover toggle turns a plain display item into a marker', async ({ page }) => {
    await loadFixture(page);

    // plain-note starts as inline text.
    const row = page.locator('[data-preview-id="plain-note"]');
    await expect(row.getByTestId('display-flyover')).toHaveCount(0);

    // Open the Answer Type config for plain-note.
    const card = page.locator('[data-node-id="plain-note"]');
    await expect(card.getByTestId('action-type')).toBeVisible();
    await card.getByTestId('action-type').click();
    await expect(page.locator('[data-testid="answerTypeModal"]')).toBeVisible();

    const toggle = page.locator('[data-testid="answerTypeModal"]').getByTestId('display-flyover-toggle');
    await expect(toggle).toBeVisible();
    await toggle.check();
    await page.locator('[data-testid="answerTypeModalApply"]').click();
    await expect(page.locator('[data-testid="answerTypeModal"]')).not.toBeVisible();

    await expect(row.getByTestId('display-flyover')).toBeVisible();
  });
});
