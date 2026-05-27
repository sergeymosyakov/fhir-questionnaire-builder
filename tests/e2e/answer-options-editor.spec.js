// ── E2E: Answer Options Editor (choice/radio Answer Type modal) ───────────────
// Tests for the dynamic row-based options editor that replaced the plain-text
// textarea + prefix input fields in the Answer Type modal.
//
// Run: npx playwright test tests/e2e/answer-options-editor.spec.js
//
// Fixture: tests/fixtures/answer-options-editor.fhir.json
//   q-opts  — choice with 3 options (low/moderate/high) + ordinals + prefixes
//
// ── data-testid registry ──────────────────────────────────────────────────────
//   action-type         Answer Type action link (ItemNode)
//   answerTypeModal     Answer Type modal backdrop
//   answerTypeModalApply  Apply button
//   answerTypeModalCancel Cancel button
//   opt-add-btn         "+ Add option" button in the editor
//   opt-code-{i}        Code input for row i
//   opt-label-{i}       Label input for row i
//   opt-score-{i}       Score input for row i
//   opt-prefix-{i}      Prefix input for row i
//   opt-rm-{i}          Remove button for row i
//   export-btn          toolbar Export dropdown
//   export-fhir-item    Export FHIR Questionnaire item
// ─────────────────────────────────────────────────────────────────────────────

import { test, expect } from '@playwright/test';
import path from 'node:path';

const FIXTURE = path.join(process.cwd(), 'tests/fixtures/answer-options-editor.fhir.json');

async function freshLoad(page) {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/');
  await page.waitForSelector('[data-testid="add-root-group-btn"]', { timeout: 10_000 });
  await page.locator('#fhirFileInput').setInputFiles(FIXTURE);
  await expect(page.locator('[data-node-id="q-opts"]')).toBeVisible({ timeout: 8_000 });
}

async function openModal(page, nodeId = 'q-opts') {
  await page.locator(`[data-node-id="${nodeId}"] [data-testid="action-type"]`).click();
  await expect(page.locator('[data-testid="answerTypeModal"]')).toBeVisible();
}

async function applyModal(page) {
  await page.locator('[data-testid="answerTypeModalApply"]').click();
  await expect(page.locator('[data-testid="answerTypeModal"]')).toBeHidden();
}

// ── Pre-population ────────────────────────────────────────────────────────────

test.describe('answer options editor — pre-population', () => {
  test('shows 3 rows when item has 3 answerOptions', async ({ page }) => {
    await freshLoad(page);
    await openModal(page);
    await expect(page.getByTestId('opt-code-0')).toBeVisible();
    await expect(page.getByTestId('opt-code-1')).toBeVisible();
    await expect(page.getByTestId('opt-code-2')).toBeVisible();
  });

  test('Code field is pre-populated from answerOption.valueCoding.code', async ({ page }) => {
    await freshLoad(page);
    await openModal(page);
    await expect(page.getByTestId('opt-code-0')).toHaveValue('low');
    await expect(page.getByTestId('opt-code-1')).toHaveValue('moderate');
    await expect(page.getByTestId('opt-code-2')).toHaveValue('high');
  });

  test('Label field is pre-populated from answerOption.valueCoding.display', async ({ page }) => {
    await freshLoad(page);
    await openModal(page);
    await expect(page.getByTestId('opt-label-0')).toHaveValue('Low');
    await expect(page.getByTestId('opt-label-1')).toHaveValue('Moderate');
    await expect(page.getByTestId('opt-label-2')).toHaveValue('High');
  });

  test('Score field is pre-populated from ordinalValue extension', async ({ page }) => {
    await freshLoad(page);
    await openModal(page);
    await expect(page.getByTestId('opt-score-0')).toHaveValue('1');
    await expect(page.getByTestId('opt-score-1')).toHaveValue('2');
    await expect(page.getByTestId('opt-score-2')).toHaveValue('3');
  });

  test('Prefix field is pre-populated from questionnaire-optionPrefix extension', async ({ page }) => {
    await freshLoad(page);
    await openModal(page);
    await expect(page.getByTestId('opt-prefix-0')).toHaveValue('A.');
    await expect(page.getByTestId('opt-prefix-1')).toHaveValue('B.');
    await expect(page.getByTestId('opt-prefix-2')).toHaveValue('C.');
  });

  test('removing all rows shows "No options yet" message', async ({ page }) => {
    await freshLoad(page);
    await openModal(page);
    await page.getByTestId('opt-rm-2').click();
    await page.getByTestId('opt-rm-1').click();
    await page.getByTestId('opt-rm-0').click();
    await expect(page.locator('.opt-editor__empty')).toBeVisible();
    await expect(page.locator('.opt-editor__empty')).toContainText('No options yet');
  });
});

// ── Add / Remove rows ─────────────────────────────────────────────────────────

test.describe('answer options editor — add/remove', () => {
  test('clicking "+ Add option" adds a new empty row', async ({ page }) => {
    await freshLoad(page);
    await openModal(page);
    await page.getByTestId('opt-add-btn').click();
    await expect(page.getByTestId('opt-code-3')).toBeVisible();
    await expect(page.getByTestId('opt-code-3')).toHaveValue('');
  });

  test('remove button removes that row', async ({ page }) => {
    await freshLoad(page);
    await openModal(page);
    await page.getByTestId('opt-rm-1').click();
    // Row 1 (moderate) is gone; now row 1 should be "high"
    await expect(page.getByTestId('opt-code-1')).toHaveValue('high');
    await expect(page.locator('[data-testid="opt-code-2"]')).toBeHidden();
  });

  test('adding then removing a row shows empty message', async ({ page }) => {
    await freshLoad(page);
    await openModal(page);
    await page.getByTestId('opt-rm-2').click();
    await page.getByTestId('opt-rm-1').click();
    await page.getByTestId('opt-rm-0').click();
    await page.getByTestId('opt-add-btn').click();
    await page.getByTestId('opt-rm-0').click();
    await expect(page.locator('.opt-editor__empty')).toBeVisible();
  });
});

// ── Apply / Cancel ────────────────────────────────────────────────────────────

test.describe('answer options editor — apply/cancel', () => {
  test('Cancel discards edits — re-opening shows original values', async ({ page }) => {
    await freshLoad(page);
    await openModal(page);
    await page.getByTestId('opt-label-0').fill('Changed');
    await page.locator('[data-testid="answerTypeModalCancel"]').click();
    await openModal(page);
    await expect(page.getByTestId('opt-label-0')).toHaveValue('Low');
  });

  test('Apply commits new row — editor re-opens with it', async ({ page }) => {
    await freshLoad(page);
    await openModal(page);
    await page.getByTestId('opt-add-btn').click();
    await page.getByTestId('opt-code-3').fill('critical');
    await page.getByTestId('opt-label-3').fill('Critical');
    await applyModal(page);
    await openModal(page);
    await expect(page.getByTestId('opt-code-3')).toHaveValue('critical');
    await expect(page.getByTestId('opt-label-3')).toHaveValue('Critical');
  });

  test('Apply with row removed — editor re-opens without it', async ({ page }) => {
    await freshLoad(page);
    await openModal(page);
    await page.getByTestId('opt-rm-0').click(); // remove "low"
    await applyModal(page);
    await openModal(page);
    await expect(page.getByTestId('opt-code-0')).toHaveValue('moderate');
    await expect(page.locator('[data-testid="opt-code-2"]')).toBeHidden();
  });
});

// ── Export round-trip ─────────────────────────────────────────────────────────

test.describe('answer options editor — export round-trip', () => {
  test('answerOption[].valueCoding preserved in exported FHIR JSON', async ({ page }) => {
    await freshLoad(page);
    await page.locator('[data-testid="export-btn"]').click();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('export-fhir-item').click().then(() => page.getByTestId('prompt-save').click()),
    ]);
    const { readFileSync } = await import('node:fs');
    const q = JSON.parse(readFileSync(await download.path(), 'utf8'));
    const opts = q.item[0].answerOption;
    expect(opts).toHaveLength(3);
    expect(opts[0].valueCoding.code).toBe('low');
    expect(opts[1].valueCoding.code).toBe('moderate');
    expect(opts[2].valueCoding.code).toBe('high');
  });

  test('ordinalValue extension round-trips correctly', async ({ page }) => {
    await freshLoad(page);
    await page.locator('[data-testid="export-btn"]').click();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('export-fhir-item').click().then(() => page.getByTestId('prompt-save').click()),
    ]);
    const { readFileSync } = await import('node:fs');
    const q = JSON.parse(readFileSync(await download.path(), 'utf8'));
    const opts = q.item[0].answerOption;
    const ordUrl = 'http://hl7.org/fhir/StructureDefinition/ordinalValue';
    expect(opts[0].extension?.find(e => e.url === ordUrl)?.valueDecimal).toBe(1);
    expect(opts[1].extension?.find(e => e.url === ordUrl)?.valueDecimal).toBe(2);
    expect(opts[2].extension?.find(e => e.url === ordUrl)?.valueDecimal).toBe(3);
  });

  test('questionnaire-optionPrefix extension round-trips correctly', async ({ page }) => {
    await freshLoad(page);
    await page.locator('[data-testid="export-btn"]').click();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('export-fhir-item').click().then(() => page.getByTestId('prompt-save').click()),
    ]);
    const { readFileSync } = await import('node:fs');
    const q = JSON.parse(readFileSync(await download.path(), 'utf8'));
    const opts = q.item[0].answerOption;
    const pfxUrl = 'http://hl7.org/fhir/StructureDefinition/questionnaire-optionPrefix';
    expect(opts[0].extension?.find(e => e.url === pfxUrl)?.valueString).toBe('A.');
    expect(opts[1].extension?.find(e => e.url === pfxUrl)?.valueString).toBe('B.');
    expect(opts[2].extension?.find(e => e.url === pfxUrl)?.valueString).toBe('C.');
  });

  test('added option with score appears in export', async ({ page }) => {
    await freshLoad(page);
    await openModal(page);
    await page.getByTestId('opt-add-btn').click();
    await page.getByTestId('opt-code-3').fill('critical');
    await page.getByTestId('opt-label-3').fill('Critical');
    await page.getByTestId('opt-score-3').fill('4');
    await applyModal(page);

    await page.locator('[data-testid="export-btn"]').click();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('export-fhir-item').click().then(() => page.getByTestId('prompt-save').click()),
    ]);
    const { readFileSync } = await import('node:fs');
    const q = JSON.parse(readFileSync(await download.path(), 'utf8'));
    const opts = q.item[0].answerOption;
    expect(opts).toHaveLength(4);
    expect(opts[3].valueCoding.code).toBe('critical');
    const ordUrl = 'http://hl7.org/fhir/StructureDefinition/ordinalValue';
    expect(opts[3].extension?.find(e => e.url === ordUrl)?.valueDecimal).toBe(4);
  });
});
