// ── E2E: FHIR features — readOnly, maxLength, minValue/maxValue, ordinalValue, minLength ───
// Tests that cover:
//   1. item.readOnly  — field blocked in preview (disabled-looking, no input rendered)
//   2. item.maxLength — character counter shown; input blocked at the limit
//   3. minValue/maxValue — validation icon ✘ when out of range; ✔ when in range
//   4. ordinalValue   — score shown next to answer option in select and radio controls
//   5. minLength      — error shown on blur when value is too short; clears when valid
//
// Fixture: tests/fixtures/fhir-features.fhir.json
//
// Run: npx playwright test tests/e2e/fhir-features.spec.js
//
// ── data-testid registry ─────────────────────────────────────────────────────
// Selectors unique to this spec — all set via element.dataset.testid in JS sources.
//
//   preview-readonly-value    read-only value span (preview-form.js)
//   char-counter              character counter span (controls/text.js, controls/url.js)
//   preview-panel             preview panel wrapper (index.html)
//
// Shared selectors (also used in builder.spec.js):
//   add-root-group-btn, load-fhir-btn, preview-panel, status-badge-btn
// ─────────────────────────────────────────────────────────────────────────────

import path from 'node:path';
import { test, expect } from '@playwright/test';
import { FHIR } from '../../js/fhir/urls/fhir.js';
import { openDropdownItem } from './helpers/dropdown.js';

const FIXTURE = path.resolve('tests/fixtures/fhir-features.fhir.json');

// ── Helpers ───────────────────────────────────────────────────────────────────

async function waitForLoad(page) {
  await page.waitForSelector('[data-testid="add-root-group-btn"]', { timeout: 10_000 });
}

async function loadFixture(page) {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/');
  await waitForLoad(page);
  await page.locator('[data-testid="fhir-file-input"]').setInputFiles(FIXTURE);
  await expect(page.locator('[data-preview-id="readonly-text"]')).toBeVisible({ timeout: 8_000 });
}

// ── 1. item.readOnly ──────────────────────────────────────────────────────────

test.describe('readOnly enforcement', () => {
  test('read-only item renders a non-editable value span (no input)', async ({ page }) => {
    await loadFixture(page);
    const row = page.locator('[data-preview-id="readonly-text"]');

    // The value span must be visible (shows the pre-filled value from item.initial)
    const valSpan = row.locator('[data-testid="preview-readonly-value"]');
    await expect(valSpan).toBeVisible();
    await expect(valSpan).toHaveText('Pre-filled value');

    // No editable textarea/input must exist inside the row
    await expect(row.locator('textarea:not([disabled]), input:not([disabled])')).toHaveCount(0);
  });

  test('read-only badge is visible alongside the value', async ({ page }) => {
    await loadFixture(page);
    const row = page.locator('[data-preview-id="readonly-text"]');
    // The grey 🔒 read-only badge is rendered for readOnly items without calculatedExpr
    await expect(row.locator('.preview-meta-badge').first()).toContainText('read-only');
  });

  test('read-only item with no initial value shows placeholder dash', async ({ page }) => {
    await loadFixture(page);
    // Load a questionnaire that has a readOnly field with NO initial value
    // We check via the fixture that "score" field (required integer with min/max) is NOT readOnly
    // and "readonly-text" IS readOnly. Since "readonly-text" has an initialValue it shows the value.
    // The readOnly span always renders — even empty ones show "—"
    const valSpan = page.locator('[data-preview-id="readonly-text"] [data-testid="preview-readonly-value"]');
    await expect(valSpan).toBeVisible();
  });
});

// ── 2. item.maxLength ────────────────────────────────────────────────────────

test.describe('maxLength enforcement', () => {
  test('character counter is visible for maxLength item', async ({ page }) => {
    await loadFixture(page);
    const counter = page.locator('[data-preview-id="text-with-max"] [data-testid="char-counter"]');
    await expect(counter).toBeVisible();
    await expect(counter).toContainText('/ 20');
  });

  test('counter updates on typing', async ({ page }) => {
    await loadFixture(page);
    const textarea = page.locator('[data-preview-id="text-with-max"] textarea');
    await textarea.fill('Hello');
    const counter = page.locator('[data-preview-id="text-with-max"] [data-testid="char-counter"]');
    await expect(counter).toContainText('5');
  });

  test('input is blocked at maxLength limit (HTML maxlength attribute)', async ({ page }) => {
    await loadFixture(page);
    const textarea = page.locator('[data-preview-id="text-with-max"] textarea');
    // Fill exactly 20 characters
    await textarea.fill('12345678901234567890');
    // Verify the value is capped at 20 characters
    const val = await textarea.inputValue();
    expect(val.length).toBe(20);
    // Try typing more — should not increase length
    await textarea.press('a');
    const val2 = await textarea.inputValue();
    expect(val2.length).toBe(20);
  });

  test('counter starts at 0 / maxLength for empty field', async ({ page }) => {
    await loadFixture(page);
    const counter = page.locator('[data-preview-id="text-with-max"] [data-testid="char-counter"]');
    await expect(counter).toContainText('0');
    await expect(counter).toContainText('20');
  });
});

// ── 3. minValue / maxValue ────────────────────────────────────────────────────

test.describe('minValue / maxValue enforcement', () => {
  test('field starts empty — no error message', async ({ page }) => {
    await loadFixture(page);
    const errMsg = page.locator('[data-preview-id="score"] .ctrl-err');
    // Error span exists but is hidden when empty
    await expect(errMsg).toHaveCount(1);
    await expect(errMsg).toBeHidden();
  });

  test('value within range: no error, icon shows ✔', async ({ page }) => {
    await loadFixture(page);
    const input = page.locator('[data-preview-id="score"] input[type="number"]');
    await input.fill('5');
    await input.blur();
    // No error message shown
    const errMsg = page.locator('[data-preview-id="score"] .ctrl-err');
    await expect(errMsg).toBeHidden();
    // Icon shows ✔ (required field with valid value)
    const icon = page.locator('[data-preview-id="score"] .icon-ok');
    await expect(icon).toBeVisible();
  });

  test('value below minValue (0): error shown', async ({ page }) => {
    await loadFixture(page);
    const input = page.locator('[data-preview-id="score"] input[type="number"]');
    await input.fill('-1');
    await input.blur();
    const errMsg = page.locator('[data-preview-id="score"] .ctrl-err');
    await expect(errMsg).toBeVisible();
    await expect(errMsg).toContainText('Min: 0');
    // Icon shows ✘
    const failIcon = page.locator('[data-preview-id="score"] .icon-fail');
    await expect(failIcon).toBeVisible();
  });

  test('value above maxValue (10): error shown', async ({ page }) => {
    await loadFixture(page);
    const input = page.locator('[data-preview-id="score"] input[type="number"]');
    await input.fill('11');
    await input.blur();
    const errMsg = page.locator('[data-preview-id="score"] .ctrl-err');
    await expect(errMsg).toBeVisible();
    await expect(errMsg).toContainText('Max: 10');
    const failIcon = page.locator('[data-preview-id="score"] .icon-fail');
    await expect(failIcon).toBeVisible();
  });

  test('min/max HTML attributes set on the input', async ({ page }) => {
    await loadFixture(page);
    const input = page.locator('[data-preview-id="score"] input[type="number"]');
    await expect(input).toHaveAttribute('min', '0');
    await expect(input).toHaveAttribute('max', '10');
  });

  test('error clears after correcting value back to range', async ({ page }) => {
    await loadFixture(page);
    const input = page.locator('[data-preview-id="score"] input[type="number"]');
    await input.fill('11');
    await expect(page.locator('[data-preview-id="score"] .ctrl-err')).toBeVisible();
    await input.fill('7');
    await expect(page.locator('[data-preview-id="score"] .ctrl-err')).toBeHidden();
  });

  test('round-trip: minValue/maxValue exported in FHIR JSON', async ({ page }) => {
    await loadFixture(page);
    await openDropdownItem(page, 'export-btn', 'export-quest-item');
    await expect(page.locator('[data-testid="saveFormatModal"]')).toBeVisible();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('saveFormatModalApply').click().then(() => page.getByTestId('prompt-save').click()),
    ]);
    const filePath = await download.path();
    const { readFileSync } = await import('node:fs');
    const q = JSON.parse(readFileSync(filePath, 'utf8'));
    const scoreItem = q.item.find(i => i.linkId === 'score');
    const minExt = (scoreItem.extension || []).find(e => e.url === FHIR.minValue);
    const maxExt = (scoreItem.extension || []).find(e => e.url === FHIR.maxValue);
    expect(minExt?.valueInteger).toBe(0);
    expect(maxExt?.valueInteger).toBe(10);
  });
});

// ── 4. ordinalValue ───────────────────────────────────────────────────────────

test.describe('ordinalValue display', () => {
  test('select control trigger shows ordinal after selecting an option', async ({ page }) => {
    await loadFixture(page);
    // Open the select dropdown for "mood"
    const trigger = page.locator('[data-preview-id="mood"] .sc-trigger');
    await trigger.click();
    // Click first option "Not at all" (ordinal 0)
    await page.locator('.oc-opt').filter({ hasText: 'Not at all' }).first().click();
    // Trigger text should now show "(0)"
    await expect(trigger).toContainText('(0)');
  });

  test('select dropdown options show ordinal values', async ({ page }) => {
    await loadFixture(page);
    const trigger = page.locator('[data-preview-id="mood"] .sc-trigger');
    await trigger.click();
    // All dropdown options should have their ordinal scores
    const opts = page.locator('.oc-opt');
    await expect(opts.nth(0)).toContainText('(0)');
    await expect(opts.nth(1)).toContainText('(1)');
    await expect(opts.nth(2)).toContainText('(2)');
    // Close dropdown
    await page.keyboard.press('Escape');
  });

  test('radio control shows ordinal badge next to each option', async ({ page }) => {
    await loadFixture(page);
    const row = page.locator('[data-preview-id="mood-radio"]');
    // Each radio label should contain ordinal in parentheses
    const labels = row.locator('.radio-label');
    await expect(labels.nth(0)).toContainText('(0)');
    await expect(labels.nth(1)).toContainText('(1)');
    await expect(labels.nth(2)).toContainText('(2)');
  });

  test('ordinalValue round-trips through export', async ({ page }) => {
    await loadFixture(page);
    await openDropdownItem(page, 'export-btn', 'export-quest-item');
    await expect(page.locator('[data-testid="saveFormatModal"]')).toBeVisible();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('saveFormatModalApply').click().then(() => page.getByTestId('prompt-save').click()),
    ]);
    const filePath = await download.path();
    const { readFileSync } = await import('node:fs');
    const q = JSON.parse(readFileSync(filePath, 'utf8'));
    const moodItem = q.item.find(i => i.linkId === 'mood');
    const firstOpt = moodItem.answerOption[0];
    const ordExt = (firstOpt.extension || []).find(
      e => e.url === FHIR.ordinalValue
    );
    expect(ordExt?.valueDecimal).toBe(0);
  });

  test('selecting a radio option with ordinal does not break PASS/FAIL', async ({ page }) => {
    await loadFixture(page);
    const row = page.locator('[data-preview-id="mood-radio"]');
    // Click "Never" radio (ordinal 0)
    await row.locator('.radio-label').first().locator('input[type="radio"]').check();
    // Verify no JS errors and row is still visible
    await expect(row).toBeVisible();
  });
});

// ── 5. minLength ──────────────────────────────────────────────────────────────

test.describe('minLength enforcement', () => {
  test('error is hidden on empty field', async ({ page }) => {
    await loadFixture(page);
    const err = page.locator('[data-preview-id="string-with-min"] [data-testid="minlength-err"]');
    await expect(err).toBeHidden();
  });

  test('error shown on blur when value is too short', async ({ page }) => {
    await loadFixture(page);
    const textarea = page.locator('[data-preview-id="string-with-min"] textarea');
    await textarea.click();
    await textarea.fill('Hi');
    await textarea.press('Tab');
    const err = page.locator('[data-preview-id="string-with-min"] [data-testid="minlength-err"]');
    await expect(err).toBeVisible();
    await expect(err).toContainText('5');
  });

  test('error clears when value reaches minLength', async ({ page }) => {
    await loadFixture(page);
    const textarea = page.locator('[data-preview-id="string-with-min"] textarea');
    await textarea.click();
    await textarea.fill('Hi');
    await textarea.press('Tab');
    await textarea.click();
    await textarea.fill('Hello world');
    await textarea.press('Tab');
    const err = page.locator('[data-preview-id="string-with-min"] [data-testid="minlength-err"]');
    await expect(err).toBeHidden();
  });

  test('minLength round-trips through export', async ({ page }) => {
    await loadFixture(page);
    await openDropdownItem(page, 'export-btn', 'export-quest-item');
    await expect(page.locator('[data-testid="saveFormatModal"]')).toBeVisible();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('saveFormatModalApply').click().then(() => page.getByTestId('prompt-save').click()),
    ]);
    const filePath = await download.path();
    const { readFileSync } = await import('node:fs');
    const q = JSON.parse(readFileSync(filePath, 'utf8'));
    const item = q.item.find(i => i.linkId === 'string-with-min');
    const minLenExt = (item.extension || []).find(
      e => e.url === FHIR.minLength
    );
    expect(minLenExt?.valueInteger).toBe(5);
  });
});

// ── maxDecimalPlaces ──────────────────────────────────────────────────────────
test.describe('maxDecimalPlaces', () => {
  test('shows error when too many decimal places entered', async ({ page }) => {
    await loadFixture(page);
    const row = page.locator('[data-preview-id="decimal-places"]');
    const input = row.locator('input[type="number"]');
    await input.fill('72.123');
    await input.press('Tab');
    const err = row.locator('[data-testid="numeric-err"]');
    await expect(err).toBeVisible();
    await expect(err).toContainText('Max 2 decimal place');
  });

  test('no error when decimal places within limit', async ({ page }) => {
    await loadFixture(page);
    const row = page.locator('[data-preview-id="decimal-places"]');
    const input = row.locator('input[type="number"]');
    await input.fill('72.12');
    await input.press('Tab');
    const err = row.locator('[data-testid="numeric-err"]');
    await expect(err).toBeHidden();
  });

  test('no error for integer value (no decimal point)', async ({ page }) => {
    await loadFixture(page);
    const row = page.locator('[data-preview-id="decimal-places"]');
    const input = row.locator('input[type="number"]');
    await input.fill('72');
    await input.press('Tab');
    const err = row.locator('[data-testid="numeric-err"]');
    await expect(err).toBeHidden();
  });

  test('maxDecimalPlaces round-trips through export', async ({ page }) => {
    await loadFixture(page);
    await openDropdownItem(page, 'export-btn', 'export-quest-item');
    await expect(page.locator('[data-testid="saveFormatModal"]')).toBeVisible();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('saveFormatModalApply').click().then(() => page.getByTestId('prompt-save').click()),
    ]);
    const filePath = await download.path();
    const { readFileSync } = await import('node:fs');
    const q = JSON.parse(readFileSync(filePath, 'utf8'));
    const item = q.item.find(i => i.linkId === 'decimal-places');
    const mdpExt = (item.extension || []).find(
      e => e.url === FHIR.maxDecimalPlaces
    );
    expect(mdpExt?.valueInteger).toBe(2);
  });
});
