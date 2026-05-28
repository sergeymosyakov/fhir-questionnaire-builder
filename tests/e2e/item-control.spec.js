// ── E2E: questionnaire-itemControl ────────────────────────────────────────────
// Fixture: tests/fixtures/item-control.fhir.json
//
// data-testid registry:
//   autocomplete-search  — search input inside autocomplete dropdown
//   text-area-toggle     — multi-line checkbox in Answer Type modal
//   autocomplete-toggle  — autocomplete checkbox in Answer Type modal
//   export-btn, export-fhir-item, prompt-save — export flow
import path from 'node:path';
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const FIXTURE = path.resolve('tests/fixtures/item-control.fhir.json');

async function loadFixture(page) {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/');
  await page.waitForSelector('[data-testid="add-root-group-btn"]', { timeout: 10_000 });
  await page.locator('#fhirFileInput').setInputFiles(FIXTURE);
  await page.waitForSelector('[data-preview-id="cb-multi"]', { timeout: 5000 });
}

// ── check-box (checklist) ─────────────────────────────────────────────────────
test.describe('check-box itemControl (checklist)', () => {
  test('renders checkboxes for all options', async ({ page }) => {
    await loadFixture(page);
    const row = page.locator('[data-preview-id="cb-multi"]');
    const checkboxes = row.locator('input[type="checkbox"]');
    await expect(checkboxes).toHaveCount(3);
  });

  test('selecting multiple checkboxes updates state', async ({ page }) => {
    await loadFixture(page);
    const row = page.locator('[data-preview-id="cb-multi"]');
    const checkboxes = row.locator('input[type="checkbox"]');
    await checkboxes.nth(0).check();
    await checkboxes.nth(2).check();
    // Both should be checked
    await expect(checkboxes.nth(0)).toBeChecked();
    await expect(checkboxes.nth(2)).toBeChecked();
    await expect(checkboxes.nth(1)).not.toBeChecked();
  });

  test('unchecking a checkbox removes it from selection', async ({ page }) => {
    await loadFixture(page);
    const row = page.locator('[data-preview-id="cb-multi"]');
    const checkboxes = row.locator('input[type="checkbox"]');
    await checkboxes.nth(0).check();
    await checkboxes.nth(1).check();
    await checkboxes.nth(0).uncheck();
    await expect(checkboxes.nth(0)).not.toBeChecked();
    await expect(checkboxes.nth(1)).toBeChecked();
  });

  test('checklist round-trips through export with check-box itemControl', async ({ page }) => {
    await loadFixture(page);
    await page.getByTestId('export-btn').click();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('export-fhir-item').click().then(() => page.getByTestId('prompt-save').click()),
    ]);
    const filePath = await download.path();
    const q = JSON.parse(readFileSync(filePath, 'utf8'));
    const item = q.item.find(i => i.linkId === 'cb-multi');
    expect(item.type).toBe('choice');
    expect(item.repeats).toBe(true);
    const ic = (item.extension || []).find(e => e.url.includes('questionnaire-itemControl'));
    expect(ic.valueCodeableConcept.coding[0].code).toBe('check-box');
  });
});

// ── autocomplete ──────────────────────────────────────────────────────────────
test.describe('autocomplete itemControl', () => {
  test('dropdown has a search input', async ({ page }) => {
    await loadFixture(page);
    const row = page.locator('[data-preview-id="ac-search"]');
    const trigger = row.locator('.sc-trigger');
    await trigger.click();
    const search = page.getByTestId('autocomplete-search');
    await expect(search).toBeVisible();
  });

  test('typing in search filters options', async ({ page }) => {
    await loadFixture(page);
    const row = page.locator('[data-preview-id="ac-search"]');
    await row.locator('.sc-trigger').click();
    const search = page.getByTestId('autocomplete-search');
    await search.fill('Ye');
    // Only Yellow should match
    const opts = page.locator('.oc-drop .oc-opt');
    await expect(opts).toHaveCount(1);
    await expect(opts.first()).toContainText('Yellow');
  });

  test('autocomplete round-trips through export', async ({ page }) => {
    await loadFixture(page);
    await page.getByTestId('export-btn').click();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('export-fhir-item').click().then(() => page.getByTestId('prompt-save').click()),
    ]);
    const filePath = await download.path();
    const q = JSON.parse(readFileSync(filePath, 'utf8'));
    const item = q.item.find(i => i.linkId === 'ac-search');
    const ic = (item.extension || []).find(e => e.url.includes('questionnaire-itemControl'));
    expect(ic.valueCodeableConcept.coding[0].code).toBe('autocomplete');
  });
});

// ── text-area ─────────────────────────────────────────────────────────────────
test.describe('text-area itemControl', () => {
  test('renders textarea with multiple rows', async ({ page }) => {
    await loadFixture(page);
    const row = page.locator('[data-preview-id="ta-multi"]');
    const textarea = row.locator('textarea');
    await expect(textarea).toBeVisible();
    const rows = await textarea.getAttribute('rows');
    expect(Number(rows)).toBeGreaterThan(1);
  });

  test('text-area round-trips through export', async ({ page }) => {
    await loadFixture(page);
    await page.getByTestId('export-btn').click();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('export-fhir-item').click().then(() => page.getByTestId('prompt-save').click()),
    ]);
    const filePath = await download.path();
    const q = JSON.parse(readFileSync(filePath, 'utf8'));
    const item = q.item.find(i => i.linkId === 'ta-multi');
    const ic = (item.extension || []).find(e => e.url.includes('questionnaire-itemControl'));
    expect(ic.valueCodeableConcept.coding[0].code).toBe('text-area');
  });
});

// ── spinner ───────────────────────────────────────────────────────────────────
test.describe('spinner itemControl', () => {
  test('spinner round-trips through export', async ({ page }) => {
    await loadFixture(page);
    await page.getByTestId('export-btn').click();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('export-fhir-item').click().then(() => page.getByTestId('prompt-save').click()),
    ]);
    const filePath = await download.path();
    const q = JSON.parse(readFileSync(filePath, 'utf8'));
    const item = q.item.find(i => i.linkId === 'sp-num');
    const ic = (item.extension || []).find(e => e.url.includes('questionnaire-itemControl'));
    expect(ic.valueCodeableConcept.coding[0].code).toBe('spinner');
  });
});

// ── drop-down ─────────────────────────────────────────────────────────────────
test.describe('drop-down itemControl', () => {
  test('drop-down round-trips through export', async ({ page }) => {
    await loadFixture(page);
    await page.getByTestId('export-btn').click();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('export-fhir-item').click().then(() => page.getByTestId('prompt-save').click()),
    ]);
    const filePath = await download.path();
    const q = JSON.parse(readFileSync(filePath, 'utf8'));
    const item = q.item.find(i => i.linkId === 'dd-default');
    const ic = (item.extension || []).find(e => e.url.includes('questionnaire-itemControl'));
    expect(ic.valueCodeableConcept.coding[0].code).toBe('drop-down');
  });
});
