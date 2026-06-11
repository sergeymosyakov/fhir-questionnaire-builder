// ── E2E: questionnaire-itemControl ────────────────────────────────────────────
// Fixture: tests/fixtures/item-control.fhir.json
//
// data-testid registry:
//   autocomplete-search  — search input inside autocomplete dropdown
//   text-area-toggle     — multi-line checkbox in Answer Type modal
//   autocomplete-toggle  — autocomplete checkbox in Answer Type modal
//   lookup-toggle        — lookup checkbox in Answer Type modal
//   lookup-search        — search input inside lookup dropdown
//   lookup-status        — status line inside lookup dropdown
//   slider-input         — <input type="range"> in slider control
//   slider-value         — current value label next to the slider
//   export-btn, export-quest-item, saveFormatModalApply, prompt-save — export flow
import path from 'node:path';
import { test, expect } from '@playwright/test';
import { openDropdownItem } from './helpers/dropdown.js';
import { readFileSync } from 'node:fs';

const FIXTURE = path.resolve('tests/fixtures/item-control.fhir.json');

async function loadFixture(page) {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/');
  await page.waitForSelector('[data-testid="add-root-group-btn"]', { timeout: 10_000 });
  await page.locator('[data-testid="fhir-file-input"]').setInputFiles(FIXTURE);
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
    await openDropdownItem(page, 'export-btn', 'export-quest-item');
    await expect(page.locator('[data-testid="saveFormatModal"]')).toBeVisible();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('saveFormatModalApply').click().then(() => page.getByTestId('prompt-save').click()),
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
    await openDropdownItem(page, 'export-btn', 'export-quest-item');
    await expect(page.locator('[data-testid="saveFormatModal"]')).toBeVisible();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('saveFormatModalApply').click().then(() => page.getByTestId('prompt-save').click()),
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
    await openDropdownItem(page, 'export-btn', 'export-quest-item');
    await expect(page.locator('[data-testid="saveFormatModal"]')).toBeVisible();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('saveFormatModalApply').click().then(() => page.getByTestId('prompt-save').click()),
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
    await openDropdownItem(page, 'export-btn', 'export-quest-item');
    await expect(page.locator('[data-testid="saveFormatModal"]')).toBeVisible();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('saveFormatModalApply').click().then(() => page.getByTestId('prompt-save').click()),
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
    await openDropdownItem(page, 'export-btn', 'export-quest-item');
    await expect(page.locator('[data-testid="saveFormatModal"]')).toBeVisible();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('saveFormatModalApply').click().then(() => page.getByTestId('prompt-save').click()),
    ]);
    const filePath = await download.path();
    const q = JSON.parse(readFileSync(filePath, 'utf8'));
    const item = q.item.find(i => i.linkId === 'dd-default');
    const ic = (item.extension || []).find(e => e.url.includes('questionnaire-itemControl'));
    expect(ic.valueCodeableConcept.coding[0].code).toBe('drop-down');
  });
});

// ── slider itemControl ────────────────────────────────────────────────────────
test.describe('slider itemControl', () => {
  test('sl-integer renders as range input', async ({ page }) => {
    await loadFixture(page);
    const sl = page.locator('[data-preview-id="sl-integer"] [data-testid="slider-input"]');
    await expect(sl).toBeVisible();
  });

  test('slider has correct min / max / step from imported extensions', async ({ page }) => {
    await loadFixture(page);
    const sl = page.locator('[data-preview-id="sl-integer"] [data-testid="slider-input"]');
    await expect(sl).toHaveAttribute('min',  '0');
    await expect(sl).toHaveAttribute('max',  '10');
    await expect(sl).toHaveAttribute('step', '1');
  });

  test('value label updates when slider moves', async ({ page }) => {
    await loadFixture(page);
    await page.locator('[data-preview-id="sl-integer"] [data-testid="slider-input"]').evaluate(el => {
      el.value = '7';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await expect(page.locator('[data-preview-id="sl-integer"] [data-testid="slider-value"]')).toHaveText('7');
  });

  test('round-trip exports both sliderStepValue and itemControl=slider', async ({ page }) => {
    await loadFixture(page);
    await openDropdownItem(page, 'export-btn', 'export-quest-item');
    await expect(page.locator('[data-testid="saveFormatModal"]')).toBeVisible();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('saveFormatModalApply').click().then(() => page.getByTestId('prompt-save').click()),
    ]);
    const q = JSON.parse(readFileSync(await download.path(), 'utf8'));
    const item = q.item.find(i => i.linkId === 'sl-integer');
    const stepExt = (item.extension || []).find(e => e.url.includes('questionnaire-sliderStepValue'));
    expect(stepExt?.valueInteger).toBe(1);
    const ic = (item.extension || []).find(e => e.url.includes('questionnaire-itemControl'));
    expect(ic?.valueCodeableConcept.coding[0].code).toBe('slider');
  });
});

// ── lookup itemControl ────────────────────────────────────────────────────────
test.describe('lookup itemControl', () => {
  test('lk-vs dropdown shows a search input', async ({ page }) => {
    await loadFixture(page);
    const trigger = page.locator('[data-preview-id="lk-vs"] .sc-trigger');
    await trigger.click();
    await expect(page.getByTestId('lookup-search')).toBeVisible();
  });

  test('lookup dropdown shows a status element', async ({ page }) => {
    await loadFixture(page);
    const trigger = page.locator('[data-preview-id="lk-vs"] .sc-trigger');
    await trigger.click();
    await expect(page.getByTestId('lookup-status')).toBeVisible();
  });

  test('round-trip exports itemControl=lookup', async ({ page }) => {
    await loadFixture(page);
    await openDropdownItem(page, 'export-btn', 'export-quest-item');
    await expect(page.locator('[data-testid="saveFormatModal"]')).toBeVisible();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('saveFormatModalApply').click().then(() => page.getByTestId('prompt-save').click()),
    ]);
    const q = JSON.parse(readFileSync(await download.path(), 'utf8'));
    const item = q.item.find(i => i.linkId === 'lk-vs');
    const ic = (item.extension || []).find(e => e.url.includes('questionnaire-itemControl'));
    expect(ic?.valueCodeableConcept.coding[0].code).toBe('lookup');
    expect(item.answerValueSet).toBe('http://hl7.org/fhir/ValueSet/administrative-gender');
  });
});
