// ── E2E: unknown extensions pass-through ─────────────────────────────────────
// Tests that cover:
//   1. Round-trip: custom extension URL+value preserved in exported FHIR JSON
//   2. Props modal shows unknown extension in Extensions collapsible section
//   3. Extension can be removed via Props modal; removed extension absent on export
//   4. New extension can be added via Props modal and appears on export
//
// Fixture: tests/fixtures/unknown-extensions.fhir.json
//
// Run: npx playwright test tests/e2e/unknown-extensions.spec.js
//
// ── data-testid registry ─────────────────────────────────────────────────────
//   action-codes              Props action button (node-item.js)
//   item-props-ext-toggle     Extensions collapsible toggle
//   item-props-ext-url-0      URL input for first unknown extension
//   item-props-ext-type-0     Custom-select trigger for value type (data-value holds current value)
//   item-props-ext-val-0      Value textarea / input for first unknown extension
//   item-props-ext-rm-0       Remove button for first unknown extension
//   item-props-ext-add        Add extension button
//   csel-drop                 Dropdown panel of any custom select
//   codesModalApply           Apply button
//   export-btn                Export dropdown button
//   export-fhir-item          Export FHIR Questionnaire menu item
// ─────────────────────────────────────────────────────────────────────────────

import path from 'node:path';
import { test, expect } from '@playwright/test';

const FIXTURE = path.resolve('tests/fixtures/unknown-extensions.fhir.json');
const CUSTOM_URL = 'http://vendor.example.com/fhir/StructureDefinition/custom-field';

// ── Helpers ───────────────────────────────────────────────────────────────────

async function waitForLoad(page) {
  await page.waitForSelector('[data-testid="add-root-group-btn"]', { timeout: 10_000 });
}

async function loadFixture(page) {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/');
  await waitForLoad(page);
  await page.locator('#fhirFileInput').setInputFiles(FIXTURE);
  await expect(page.locator('[data-testid="node-type-label"]').first()).toBeVisible({ timeout: 8_000 });
}

async function exportFHIR(page) {
  page.once('dialog', d => d.accept());
  await page.locator('[data-testid="export-btn"]').click();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('[data-testid="export-fhir-item"]').click(),
  ]);
  const filePath = await download.path();
  const { readFileSync } = await import('node:fs');
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

// ── 1. Round-trip preservation ────────────────────────────────────────────────

test.describe('Unknown extensions round-trip', () => {
  test('custom item extension is preserved in exported FHIR JSON', async ({ page }) => {
    await loadFixture(page);
    const q = await exportFHIR(page);
    const ext = q.item[0].extension;
    expect(ext).toBeDefined();
    const custom = ext.find(e => e.url === CUSTOM_URL);
    expect(custom).toBeDefined();
    expect(custom.valueString).toBe('custom-value');
  });

  test('known extension (minLength) is still present and unknown does not duplicate it', async ({ page }) => {
    await loadFixture(page);
    const q = await exportFHIR(page);
    const ext = q.item[0].extension;
    const minLen = ext.filter(e => e.url === 'http://hl7.org/fhir/StructureDefinition/minLength');
    // minLength should appear exactly once (written by known handler)
    expect(minLen).toHaveLength(1);
  });
});

// ── 2. Props modal shows Extensions section ───────────────────────────────────

test.describe('Props modal — Extensions section', () => {
  test('extensions toggle is visible after loading fixture with unknown extension', async ({ page }) => {
    await loadFixture(page);
    await page.locator('[data-testid="action-codes"]').first().click();
    await expect(page.locator('[data-testid="item-props-ext-toggle"]')).toBeVisible();
  });

  test('URL input and value input show the custom extension fields', async ({ page }) => {
    await loadFixture(page);
    await page.locator('[data-testid="action-codes"]').first().click();
    await expect(page.locator('[data-testid="item-props-ext-url-0"]')).toHaveValue(CUSTOM_URL);
    await expect(page.locator('[data-testid="item-props-ext-type-0"]')).toHaveAttribute('data-value', 'valueString');
    await expect(page.locator('[data-testid="item-props-ext-val-0"]')).toHaveValue('custom-value');
  });

  test('Extensions section is collapsed and shows no badge for item without unknown extensions', async ({ page }) => {
    await loadFixture(page);
    // q2 has no unknown extensions
    await page.locator('[data-testid="action-codes"]').nth(1).click();
    const toggle = page.locator('[data-testid="item-props-ext-toggle"]');
    await expect(toggle).toBeVisible();
    await expect(toggle).toContainText('Extensions');
    await expect(toggle).not.toContainText('(');
  });
});

// ── 3. Remove extension via Props modal ───────────────────────────────────────

test.describe('Remove unknown extension via Props modal', () => {
  test('removed extension is absent from exported JSON', async ({ page }) => {
    await loadFixture(page);
    await page.locator('[data-testid="action-codes"]').first().click();
    await page.locator('[data-testid="item-props-ext-rm-0"]').click();
    await page.locator('#codesModalApply').click();
    const q = await exportFHIR(page);
    const ext = (q.item[0].extension || []);
    const custom = ext.find(e => e.url === CUSTOM_URL);
    expect(custom).toBeUndefined();
  });
});

// ── 4. Add new extension via Props modal ──────────────────────────────────────

test.describe('Add unknown extension via Props modal', () => {
  test('newly added extension appears in exported JSON', async ({ page }) => {
    await loadFixture(page);
    // Open props for q2 (no extensions)
    await page.locator('[data-testid="action-codes"]').nth(1).click();
    await page.locator('[data-testid="item-props-ext-toggle"]').click();
    await page.locator('[data-testid="item-props-ext-add"]').click();
    await page.locator('[data-testid="item-props-ext-url-0"]').fill('http://new.example.com/ext');
    await page.locator('[data-testid="item-props-ext-type-0"]').click();
    await page.locator('[data-testid="csel-drop"] [data-val="valueBoolean"]').click();
    await page.locator('[data-testid="item-props-ext-val-0"]').click();
    await page.locator('[data-testid="csel-drop"] [data-val="true"]').click();
    await page.locator('#codesModalApply').click();
    const q = await exportFHIR(page);
    const ext = (q.item[1].extension || []);
    const added = ext.find(e => e.url === 'http://new.example.com/ext');
    expect(added).toBeDefined();
    expect(added.valueBoolean).toBe(true);
  });
});
