// ── E2E: questionnaire-itemControl = help (Help-Button) ───────────────────────
// Tests that cover the help-button display control:
//   1. Import render — a help display item shows a "? Help" button, text hidden.
//   2. Clicking the button reveals the display text.
//   3. A plain display item shows its text inline (no help button).
//   4. Round-trip — the help itemControl survives import → export.
//   5. Builder UI — the Display control select turns a plain display item into
//      a help-button item in the preview.
//   6. Nested help (_helpText) — a display+help child nested under a question
//      is collapsed into the parent's _helpText: renders inline on the parent's
//      own row (no separate row for the child), round-trips on export.
//   7. Props modal — editing the "Help Text" field on a plain question adds
//      the inline badge without any child node in the tree.
//
// Fixture: tests/fixtures/help-button.fhir.json
//
// Run: npx playwright test tests/e2e/help-button.spec.js
//
// ── data-testid registry ─────────────────────────────────────────────────────
//   fhir-file-input                    hidden file <input> for Open → FHIR JSON
//   display-itemcontrol-help-toggle    the "? Help" button rendered in the preview
//   display-itemcontrol-help-content   the collapsible text revealed on click
//   action-type                        "Answer Type" config button on an item node
//   answerTypeModal                    Answer Type modal backdrop
//   display-control-select             the Display control dropdown in the Answer Type modal
//   answerTypeModalApply                Apply button
//   action-codes                       "Props" config button on an item node
//   codesModal                         Item Properties modal backdrop
//   item-props-help-text               Help Text textarea in the Props modal
//   codesModalApply                    Props modal Apply button
//   export-btn / export-quest-item / saveFormatModalApply / prompt-save — export flow
// ─────────────────────────────────────────────────────────────────────────────

import path from 'node:path';
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { openDropdownItem } from './helpers/dropdown.js';

const FIXTURE = path.resolve('tests/fixtures/help-button.fhir.json');

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

test.describe('help-button — import render', () => {
  test('help display item renders a "? Help" button with content hidden', async ({ page }) => {
    await loadFixture(page);
    const row = page.locator('[data-preview-id="help-note"]');
    const toggle = row.getByTestId('display-itemcontrol-help-toggle');
    const content = row.getByTestId('display-itemcontrol-help-content');
    await expect(toggle).toBeVisible();
    // The display text is not shown until the button is clicked.
    await expect(content).not.toBeVisible();
  });

  test('clicking the Help button reveals the display text', async ({ page }) => {
    await loadFixture(page);
    const row = page.locator('[data-preview-id="help-note"]');
    const toggle = row.getByTestId('display-itemcontrol-help-toggle');
    const content = row.getByTestId('display-itemcontrol-help-content');
    await expect(content).not.toBeVisible();
    await expect(async () => {
      await toggle.click();
      await expect(content).toBeVisible();
    }).toPass();
    await expect(content).toContainText('government-issued ID');
  });

  test('plain display item shows its text inline (no Help button)', async ({ page }) => {
    await loadFixture(page);
    const row = page.locator('[data-preview-id="plain-note"]');
    await expect(row).toContainText('plain display note shown inline');
    await expect(row.getByTestId('display-itemcontrol-help-toggle')).toHaveCount(0);
  });
});

// ── 4. Round-trip ───────────────────────────────────────────────────────────

test.describe('help-button — round-trip', () => {
  test('help itemControl survives import → export', async ({ page }) => {
    await loadFixture(page);
    const q = await exportFHIR(page);
    const item = q.item.find(i => i.linkId === 'help-note');
    expect(item.type).toBe('display');
    const ic = (item.extension || []).find(e => e.url.includes('questionnaire-itemControl'));
    expect(ic).toBeDefined();
    expect(ic.valueCodeableConcept.coding[0].code).toBe('help');
  });
});

// ── 5. Builder UI — set help control on ───────────────────────────────────────

test.describe('help-button — builder toggle', () => {
  test('selecting Help button in Display control turns a plain display item into a Help button', async ({ page }) => {
    await loadFixture(page);

    // plain-note starts as inline text.
    const row = page.locator('[data-preview-id="plain-note"]');
    await expect(row.getByTestId('display-itemcontrol-help-toggle')).toHaveCount(0);

    // Open the Answer Type config for plain-note.
    const card = page.locator('[data-node-id="plain-note"]');
    await expect(card.getByTestId('action-type')).toBeVisible();
    await card.getByTestId('action-type').click();
    await expect(page.locator('[data-testid="answerTypeModal"]')).toBeVisible();

    const select = page.locator('[data-testid="answerTypeModal"]').getByTestId('display-control-select');
    await expect(select).toBeVisible();
    await select.click();
    await page.locator('[data-testid="csel-drop"] [data-val="help"]').click();
    await page.locator('[data-testid="answerTypeModalApply"]').click();
    await expect(page.locator('[data-testid="answerTypeModal"]')).not.toBeVisible();

    await expect(row.getByTestId('display-itemcontrol-help-toggle')).toBeVisible();
  });
});

// ── 6. Nested help (_helpText) — collapsed from a nested display+help child ──

test.describe('help-button — nested _helpText on import', () => {
  test('renders inline on the parent question row, no separate row for the child', async ({ page }) => {
    await loadFixture(page);
    const row = page.locator('[data-preview-id="care-level"]');
    await expect(row).toContainText('Level of care requested');
    await expect(row.getByTestId('display-itemcontrol-help-toggle')).toBeVisible();
    // The nested display child never gets its own preview row.
    await expect(page.locator('[data-preview-id="care-level-help"]')).toHaveCount(0);
  });

  test('clicking the badge reveals the nested help text', async ({ page }) => {
    await loadFixture(page);
    const row = page.locator('[data-preview-id="care-level"]');
    const toggle = row.getByTestId('display-itemcontrol-help-toggle');
    const content = row.getByTestId('display-itemcontrol-help-content');
    await expect(content).not.toBeVisible();
    await expect(async () => {
      await toggle.click();
      await expect(content).toBeVisible();
    }).toPass();
    await expect(content).toContainText('Selecting the level of care will define');
  });

  test('round-trips back to a nested display+help item on export', async ({ page }) => {
    await loadFixture(page);
    const q = await exportFHIR(page);
    const parent = q.item.find(i => i.linkId === 'care-level');
    expect(parent.item).toHaveLength(1);
    const helpItem = parent.item[0];
    expect(helpItem.type).toBe('display');
    const ic = (helpItem.extension || []).find(e => e.url.includes('questionnaire-itemControl'));
    expect(ic.valueCodeableConcept.coding[0].code).toBe('help');
  });
});

// ── 7. Props modal — editing Help Text directly on a question ────────────────

test.describe('help-button — Props modal Help Text field', () => {
  test('typing Help Text and applying adds the inline badge with no child node', async ({ page }) => {
    await loadFixture(page);
    const card = page.locator('[data-node-id="q1"]');
    await expect(card.getByTestId('action-codes')).toBeVisible();
    await card.getByTestId('action-codes').click();
    await expect(page.locator('[data-testid="codesModal"]')).toBeVisible();

    const textarea = page.locator('[data-testid="codesModal"]').getByTestId('item-props-help-text');
    await textarea.fill('Type your name as it appears on your ID.');
    await page.locator('[data-testid="codesModalApply"]').click();
    await expect(page.locator('[data-testid="codesModal"]')).not.toBeVisible();

    const row = page.locator('[data-preview-id="q1"]');
    await expect(row.getByTestId('display-itemcontrol-help-toggle')).toBeVisible();

    const q = await exportFHIR(page);
    const item = q.item.find(i => i.linkId === 'q1');
    expect(item.item).toHaveLength(1);
    expect(item.item[0].text).toBe('Type your name as it appears on your ID.');
  });
});
