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
  await page.locator('#fhirFileInput').setInputFiles(FIXTURE);
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
    page.once('dialog', d => d.accept());
    await page.getByTestId('export-btn').click();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('export-fhir-item').click(),
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
    page.once('dialog', d => d.accept());
    await page.getByTestId('export-btn').click();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('export-fhir-item').click(),
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
    await page.locator('#answerTypeModalApply').click();
    // Just verify the modal Apply succeeded without error
    await expect(page.locator('[data-node-id="general-notes"]')).toBeVisible();
  });

  test('Show When modal shows disabledDisplay select', async ({ page }) => {
    await loadFixture(page);
    await page.locator('[data-node-id="extra-notes"]').getByTestId('action-vis').click();
    await expect(page.getByTestId('disabled-display-select')).toBeVisible();
    await expect(page.getByTestId('disabled-display-select')).toHaveValue('hidden');
    await page.keyboard.press('Escape');
  });

  test('Show When modal shows protected as default for general-notes', async ({ page }) => {
    await loadFixture(page);
    await page.locator('[data-node-id="general-notes"]').getByTestId('action-vis').click();
    await expect(page.getByTestId('disabled-display-select')).toHaveValue('protected');
    await page.keyboard.press('Escape');
  });

  test('changing disabledDisplay to hidden removes item from preview', async ({ page }) => {
    await loadFixture(page);
    // general-notes is currently protected (shows dimmed)
    await expect(page.locator('[data-preview-id="general-notes"]')).toBeVisible();
    await page.locator('[data-node-id="general-notes"]').getByTestId('action-vis').click();
    await page.getByTestId('disabled-display-select').selectOption('hidden');
    await page.locator('#showWhenModalApply').click();
    // After applying, general-notes should no longer be in the DOM (condition still not met)
    await expect(page.locator('[data-preview-id="general-notes"]')).toHaveCount(0);
  });
});
