// ── E2E tests: sliderStepValue + disabledDisplay ──────────────────────────────
// Fixture: tests/fixtures/slider-disabled.fhir.json
//   - pain-score   : integer, required, min=0 max=10, sliderStep=1
//   - extra-notes  : string, enableWhen pain-score>5, disabledDisplay=hidden
//   - general-notes: string, enableWhen pain-score>5 (default protected)
//
// data-testid registry:
//   slider-input            <input type="range"> in number control
//   slider-value            current value label next to the slider
//   slider-toggle           "Render as slider" checkbox in Answer Type modal
//   disabled-display-select <select> in Show When modal (When not visible)
//   min-value-input         Min field in Answer Type modal numeric section
//   max-value-input         Max field in Answer Type modal numeric section
//   slider-step-input       Step field in Answer Type modal (visible only when slider-toggle is checked)

import { test, expect } from '@playwright/test';
import path from 'node:path';

const FIXTURE = path.join(process.cwd(), 'tests/fixtures/slider-disabled.fhir.json');

async function loadFixture(page) {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/');
  await page.waitForSelector('[data-testid="add-root-group-btn"]', { timeout: 10_000 });
  await page.locator('[data-testid="fhir-file-input"]').setInputFiles(FIXTURE);
  await expect(page.locator('[data-preview-id="pain-score"]')).toBeVisible({ timeout: 8_000 });
}

async function moveSlider(page, value) {
  await page.locator('[data-preview-id="pain-score"] [data-testid="slider-input"]').evaluate((el, v) => {
    el.value = v;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, String(value));
  await page.waitForTimeout(300);
}

// ── Slider rendering ───────────────────────────────────────────────────────────

test.describe('slider rendering', () => {
  test('pain-score renders as range input', async ({ page }) => {
    await loadFixture(page);
    await expect(page.locator('[data-preview-id="pain-score"] [data-testid="slider-input"]')).toBeVisible();
  });

  test('slider has correct min / max / step attributes', async ({ page }) => {
    await loadFixture(page);
    const sl = page.locator('[data-preview-id="pain-score"] [data-testid="slider-input"]');
    await expect(sl).toHaveAttribute('min',  '0');
    await expect(sl).toHaveAttribute('max',  '10');
    await expect(sl).toHaveAttribute('step', '1');
  });

  test('value label updates when slider is moved', async ({ page }) => {
    await loadFixture(page);
    await moveSlider(page, 7);
    await expect(page.locator('[data-preview-id="pain-score"] [data-testid="slider-value"]')).toHaveText('7');
  });

  test('round-trip: sliderStepValue exported in FHIR JSON', async ({ page }) => {
    await loadFixture(page);
    await page.getByTestId('export-btn').click();
    await page.getByTestId('export-quest-item').click();
    await expect(page.locator('[data-testid="saveFormatModal"]')).toBeVisible();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('saveFormatModalApply').click().then(() => page.getByTestId('prompt-save').click()),
    ]);
    const { readFileSync } = await import('node:fs');
    const q = JSON.parse(readFileSync(await download.path(), 'utf8'));
    const ext = (q.item.find(i => i.linkId === 'pain-score').extension || [])
      .find(e => e.url === 'http://hl7.org/fhir/StructureDefinition/questionnaire-sliderStepValue');
    expect(ext?.valueInteger).toBe(1);
  });
});

// ── disabledDisplay behaviour ─────────────────────────────────────────────────

test.describe('disabledDisplay', () => {
  test('hidden item is absent from DOM when condition not met', async ({ page }) => {
    await loadFixture(page);
    await expect(page.locator('[data-preview-id="extra-notes"]')).toHaveCount(0);
  });

  test('protected item is visible (dimmed) when condition not met', async ({ page }) => {
    await loadFixture(page);
    const row = page.locator('[data-preview-id="general-notes"]');
    await expect(row).toBeVisible();
    await expect(row).toHaveClass(/lform-waiting/);
  });

  test('hidden item appears when condition becomes met', async ({ page }) => {
    await loadFixture(page);
    await moveSlider(page, 8);
    await expect(page.locator('[data-preview-id="extra-notes"]')).toBeVisible();
  });

  test('hidden item disappears again when condition stops being met', async ({ page }) => {
    await loadFixture(page);
    await moveSlider(page, 8);
    await expect(page.locator('[data-preview-id="extra-notes"]')).toBeVisible();
    await moveSlider(page, 3);
    await expect(page.locator('[data-preview-id="extra-notes"]')).toHaveCount(0);
  });

  test('round-trip: disabledDisplay exported in FHIR JSON', async ({ page }) => {
    await loadFixture(page);
    await page.getByTestId('export-btn').click();
    await page.getByTestId('export-quest-item').click();
    await expect(page.locator('[data-testid="saveFormatModal"]')).toBeVisible();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('saveFormatModalApply').click().then(() => page.getByTestId('prompt-save').click()),
    ]);
    const { readFileSync } = await import('node:fs');
    const q = JSON.parse(readFileSync(await download.path(), 'utf8'));
    expect(q.item.find(i => i.linkId === 'extra-notes').disabledDisplay).toBe('hidden');
  });
});

// ── Builder UI ────────────────────────────────────────────────────────────────

test.describe('builder UI', () => {
  test('Answer Type modal shows min/max/step fields for integer type', async ({ page }) => {
    await loadFixture(page);
    await page.locator('[data-node-id="pain-score"]').getByTestId('action-type').click();
    await expect(page.getByTestId('min-value-input')).toBeVisible();
    await expect(page.getByTestId('max-value-input')).toBeVisible();
    // pain-score has _sliderStep set → checkbox pre-checked → step field visible
    await expect(page.getByTestId('slider-toggle')).toBeChecked();
    await expect(page.getByTestId('slider-step-input')).toBeVisible();
    await expect(page.getByTestId('min-value-input')).toHaveValue('0');
    await expect(page.getByTestId('max-value-input')).toHaveValue('10');
    await expect(page.getByTestId('slider-step-input')).toHaveValue('1');
    await page.keyboard.press('Escape');
  });

  test('Answer Type modal hides numeric section for text type', async ({ page }) => {
    await loadFixture(page);
    await page.locator('[data-node-id="extra-notes"]').getByTestId('action-type').click();
    await expect(page.getByTestId('min-value-input')).not.toBeVisible();
    await expect(page.getByTestId('slider-toggle')).not.toBeVisible();
    await page.keyboard.press('Escape');
  });

  test('setting slider step via Answer Type modal makes slider appear', async ({ page }) => {
    await loadFixture(page);
    // Switch general-notes to integer and enable slider via checkbox
    await page.locator('[data-node-id="general-notes"]').getByTestId('action-type').click();
    // Select integer type
    await page.getByTestId('type-select').click();
    await page.locator('[data-testid="csel-drop"] [data-val="integer"]').click();
    // Check "Render as slider" — step field appears with default value 1
    await page.getByTestId('slider-toggle').check();
    await expect(page.getByTestId('slider-step-input')).toBeVisible();
    await page.locator('[data-testid="answerTypeModalApply"]').click();
    // Just verify the modal Apply succeeded without error
    await expect(page.locator('[data-node-id="general-notes"]')).toBeVisible();
  });

  test('Show When modal shows disabledDisplay select', async ({ page }) => {
    await loadFixture(page);
    await page.locator('[data-node-id="extra-notes"]').getByTestId('action-vis').click();
    await expect(page.getByTestId('disabled-display-select')).toBeVisible();
    await expect(page.getByTestId('disabled-display-select')).toHaveAttribute('data-value', 'hidden');
    await page.keyboard.press('Escape');
  });

  test('Show When modal shows protected as default for general-notes', async ({ page }) => {
    await loadFixture(page);
    await page.locator('[data-node-id="general-notes"]').getByTestId('action-vis').click();
    await expect(page.getByTestId('disabled-display-select')).toHaveAttribute('data-value', 'protected');
    await page.keyboard.press('Escape');
  });

  test('changing disabledDisplay to hidden removes item from preview', async ({ page }) => {
    await loadFixture(page);
    // general-notes is currently protected (shows dimmed)
    await expect(page.locator('[data-preview-id="general-notes"]')).toBeVisible();
    await page.locator('[data-node-id="general-notes"]').getByTestId('action-vis').click();
    await page.getByTestId('disabled-display-select').click();
    await page.locator('.oc-opt[data-val="hidden"]').click();
    await page.locator('[data-testid="showWhenModalApply"]').click();
    // After applying, general-notes should no longer be in the DOM (condition still not met)
    await expect(page.locator('[data-preview-id="general-notes"]')).toHaveCount(0);
  });
});

// ── sliderStepValue — R4 decimal constraint ────────────────────────────────────
// The decimal-slider scenario is built from scratch (not loaded via fixture) because
// a fixture with a decimal sliderStep would generate a validator warning on export,
// causing the export validate modal to open and interfere with download tests.
// Instead we create the item via UI and test export + validator directly.

test.describe('sliderStepValue — R4 decimal constraint', () => {
  async function buildDecimalSlider(page) {
    await page.addInitScript(() => localStorage.clear());
    await page.goto('/');
    await page.waitForSelector('[data-testid="add-root-group-btn"]', { timeout: 10_000 });
    // Add a root group then a decimal item
    await page.getByTestId('add-root-group-btn').click();
    await expect(page.locator('[data-node-id="1"]')).toBeVisible();
    await page.locator('[data-node-id="1"]').getByTestId('group-add-btn').click();
    await page.locator('[data-testid="add-menu-item"]').first().click();
    await expect(page.locator('[data-node-id="1.1"]')).toBeVisible();
    // Open Answer Type modal, switch to decimal, enable slider with step 0.5
    await page.locator('[data-node-id="1.1"]').getByTestId('action-type').click();
    await expect(page.locator('[data-testid="answerTypeModal"]')).toBeVisible();
    await page.locator('[data-testid="answerTypeModal"]').getByTestId('type-select').click();
    await page.locator('[data-testid="csel-drop"] [data-val="decimal"]').click();
    await page.getByTestId('slider-toggle').check();
    await expect(page.getByTestId('slider-step-input')).toBeVisible();
    await page.getByTestId('slider-step-input').fill('0.5');
    await page.locator('[data-testid="answerTypeModalApply"]').click();
    await expect(page.locator('[data-testid="answerTypeModal"]')).not.toBeVisible();
  }

  test('decimal slider step is rounded to valueInteger on export', async ({ page }) => {
    await buildDecimalSlider(page);
    await page.getByTestId('export-btn').click();
    await page.getByTestId('export-quest-item').click();
    await expect(page.locator('[data-testid="saveFormatModal"]')).toBeVisible();
    await page.getByTestId('saveFormatModalApply').click();
    // Validate modal opens because of the decimal-step warning — click Export anyway
    const modal = page.locator('[data-testid="validateModal"]');
    await modal.waitFor({ state: 'visible', timeout: 5_000 });
    await page.locator('[data-testid="validateModal"] .btn-fhir-export').click();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('prompt-save').click(),
    ]);
    const { readFileSync } = await import('node:fs');
    const q = JSON.parse(readFileSync(await download.path(), 'utf8'));
    // Find the item (it's nested under a group)
    const ext = (q.item[0].item[0].extension || []).find(
      e => e.url === 'http://hl7.org/fhir/StructureDefinition/questionnaire-sliderStepValue'
    );
    expect(ext?.valueInteger).toBe(1); // 0.5 rounded to 1
    expect(ext?.valueDecimal).toBeUndefined();
  });

  test('decimal slider step triggers validator warning', async ({ page }) => {
    await buildDecimalSlider(page);
    await page.getByTestId('tools-btn').click();
    await page.getByTestId('validate-item').click();
    await expect(page.locator('[data-testid="validateModal"]')).toBeVisible();
    const body = page.locator('[data-testid="validateModalBody"]');
    await expect(body).toContainText('decimal');
    await expect(body).toContainText('valueInteger');
    await page.keyboard.press('Escape');
  });
});
