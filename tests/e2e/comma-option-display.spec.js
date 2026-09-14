// ── E2E: comma inside a choice-option display must not split ──────────────────
// A procedure-code answerOption whose display contains commas (real HCPCS/CPT
// descriptions) must render as ONE option in the preview and survive the export
// round-trip — not fragment into several options on each comma.
//
// Fixture: tests/fixtures/comma-option-display.fhir.json
//   q-radio-comma — radio choice, 2 answerOptions (one display has commas)
//
// Also covers the same bug entered live through the builder's Answer Type
// modal (reported by a real user — a checklist option label containing a
// comma got split into two separate options on Apply), plus the same option
// reaching three other readers: the Show When condition value picker, the
// Generate Docs report, and the Expression Builder's tree leaf editor.
//
// Run: npx playwright test tests/e2e/comma-option-display.spec.js
//
// ── data-testid registry ─────────────────────────────────────────────────────
//   add-root-group-btn     toolbar button (confirms app loaded)
//   fhir-file-input        hidden file input for loading a questionnaire
//   preview-mode-btn       mode toggle in toolbar
//   preview-mode-json      "JSON" option in mode dropdown
//   action-type / answerTypeModal / type-select / answerTypeModalApply
//   opt-add-btn / opt-code-<i> / opt-label-<i>       answer options editor
//   group-add-btn / add-menu-item / node-title-display / node-title-input
//   action-vis / showWhenModal / vis-add-condition-btn                    Show When
//   vis-cond-q-trigger-<i> / vis-cond-q-drop [data-id] / vis-cond-val-sel-<i>
//   export-btn / generate-docs-item                                       Save menu
//   qdoc-item-<linkId> / qdoc-options-<linkId>                            Generate Docs
//   enablewhen-build-btn / expressionBuilderModal / eb-leaf / eb-leaf-item
//   eb-leaf-value-select                                                  Expression Builder
//   csel-drop [data-val]                                                  custom-select option
// Preview control classes (sanctioned non-testid exception): .radio-label
// ─────────────────────────────────────────────────────────────────────────────

import path from 'node:path';
import { test, expect } from '@playwright/test';
import { openDropdownItem } from './helpers/dropdown.js';

const FIXTURE = path.resolve('tests/fixtures/comma-option-display.fhir.json');
const COMMA_DISPLAY = 'E1220 - Wheelchair, adult size, heavy duty, elevating legrests';

async function loadFixture(page) {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/');
  await page.waitForSelector('[data-testid="add-root-group-btn"]', { timeout: 10_000 });
  await page.locator('[data-testid="fhir-file-input"]').setInputFiles(FIXTURE);
  await expect(page.locator('[data-node-id="q-radio-comma"]')).toBeVisible({ timeout: 8_000 });
}

async function getExportedJSON(page) {
  await page.getByTestId('preview-mode-btn').click();
  await page.getByTestId('preview-mode-json').click();
  await expect(page.locator('#fhirJsonView')).toBeVisible();
  await expect(page.locator('#fhirJsonView')).toContainText('resourceType', { timeout: 8_000 });
  return JSON.parse(await page.locator('#fhirJsonView').textContent());
}

function findItem(items, linkId) {
  for (const it of items || []) {
    if (it.linkId === linkId) return it;
    const found = findItem(it.item, linkId);
    if (found) return found;
  }
  return null;
}

test.describe('comma in option display — preview', () => {
  test('renders exactly one option per answerOption (comma display not split)', async ({ page }) => {
    await loadFixture(page);
    const row = page.locator('[data-preview-id="q-radio-comma"]');
    await expect(row).toBeVisible({ timeout: 10_000 });

    const labels = row.locator('.radio-label');
    await expect(labels).toHaveCount(2);
    await expect(labels.filter({ hasText: COMMA_DISPLAY })).toHaveCount(1);
  });
});

test.describe('comma in option display — export round-trip', () => {
  test('answerOption is preserved as a single option with the full display', async ({ page }) => {
    await loadFixture(page);
    const q = await getExportedJSON(page);
    const item = findItem(q.item, 'q-radio-comma');
    expect(item).toBeTruthy();
    expect(item.answerOption).toHaveLength(2);
    expect(item.answerOption[0].valueCoding.code).toBe('E1220');
    expect(item.answerOption[0].valueCoding.display).toBe(COMMA_DISPLAY);
  });
});

test.describe('comma typed into an option label via the Answer Type modal', () => {
  const LABEL_WITH_COMMA = 'Wound Care (Must include current measurements, drainage and orders)';

  test('Apply keeps it as one option, not split at the comma', async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
    await page.goto('/');
    await page.waitForSelector('[data-testid="add-root-group-btn"]', { timeout: 10_000 });
    await page.getByTestId('add-root-group-btn').click();
    await expect(page.locator('[data-node-id="1"]')).toBeVisible();

    await page.locator('[data-node-id="1"]').getByTestId('group-add-btn').click();
    await page.locator('[data-testid="add-menu-item"]').first().click();
    const item = page.locator('[data-node-id="1.1"]');
    await expect(item.getByTestId('node-title-display')).toBeVisible();

    await item.getByTestId('action-type').click();
    await expect(page.getByTestId('answerTypeModal')).toBeVisible();
    await page.getByTestId('type-select').click();
    await page.locator('[data-testid="csel-drop"] [data-val="checklist"]').click();

    await page.getByTestId('opt-add-btn').click();
    await page.getByTestId('opt-code-0').fill('woundcare');
    await page.getByTestId('opt-label-0').fill(LABEL_WITH_COMMA);
    await page.getByTestId('opt-add-btn').click();
    await page.getByTestId('opt-code-1').fill('oth');
    await page.getByTestId('opt-label-1').fill('Other (Please Describe)');

    await page.getByTestId('answerTypeModalApply').click();
    await expect(page.getByTestId('answerTypeModal')).toBeHidden();

    const row = page.locator('[data-preview-id="1.1"]');
    await expect(row).toBeVisible();
    const labels = row.locator('.radio-label');
    await expect(labels).toHaveCount(2);
    await expect(labels.filter({ hasText: LABEL_WITH_COMMA })).toHaveCount(1);

    const q = await getExportedJSON(page);
    const exported = findItem(q.item, '1.1');
    expect(exported.answerOption).toHaveLength(2);
    expect(exported.answerOption[0].valueCoding.code).toBe('woundcare');
    expect(exported.answerOption[0].valueCoding.display).toBe(LABEL_WITH_COMMA);
  });
});

// ── Shared setup for the three tests below: a root group with a checklist item
// (comma-containing option) plus a second item to host a condition/reference.
const LABEL_WITH_COMMA_2 = 'Wound Care (Must include current measurements, drainage and orders)';

async function addTitledItem(page, groupId, nodeId, title) {
  await page.locator(`[data-node-id="${groupId}"]`).getByTestId('group-add-btn').click();
  await page.locator('[data-testid="add-menu-item"]').first().click();
  const item = page.locator(`[data-node-id="${nodeId}"]`);
  await expect(item.getByTestId('node-title-display')).toBeVisible();
  await expect(async () => {
    await item.getByTestId('node-title-display').click();
    await expect(item.getByTestId('node-title-input')).toBeVisible();
  }).toPass();
  await item.getByTestId('node-title-input').fill(title);
  await item.getByTestId('node-title-input').blur();
}

async function setChecklistWithCommaOption(page, nodeId) {
  await page.locator(`[data-node-id="${nodeId}"]`).getByTestId('action-type').click();
  await expect(page.getByTestId('answerTypeModal')).toBeVisible();
  await page.getByTestId('type-select').click();
  await page.locator('[data-testid="csel-drop"] [data-val="checklist"]').click();

  await page.getByTestId('opt-add-btn').click();
  await page.getByTestId('opt-code-0').fill('woundcare');
  await page.getByTestId('opt-label-0').fill(LABEL_WITH_COMMA_2);
  await page.getByTestId('opt-add-btn').click();
  await page.getByTestId('opt-code-1').fill('oth');
  await page.getByTestId('opt-label-1').fill('Other (Please Describe)');

  await page.getByTestId('answerTypeModalApply').click();
  await expect(page.getByTestId('answerTypeModal')).toBeHidden();
}

test.describe('comma-containing option reaches the Show When condition value picker', () => {
  test('value picker lists it as one option, not split at the comma', async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
    await page.goto('/');
    await page.waitForSelector('[data-testid="add-root-group-btn"]', { timeout: 10_000 });
    await page.getByTestId('add-root-group-btn').click();
    await expect(page.locator('[data-node-id="1"]')).toBeVisible();

    await addTitledItem(page, '1', '1.1', 'Target choice');
    await setChecklistWithCommaOption(page, '1.1');
    await addTitledItem(page, '1', '1.2', 'Condition host');

    await page.locator('[data-node-id="1.2"]').getByTestId('action-vis').click();
    await expect(page.getByTestId('showWhenModal')).toBeVisible();
    await page.getByTestId('vis-add-condition-btn').click();

    await page.getByTestId('vis-cond-q-trigger-0').click();
    await expect(page.getByTestId('vis-cond-q-drop')).toBeVisible();
    await page.locator('[data-testid="vis-cond-q-drop"] [data-id="1.1"]').click();

    await page.getByTestId('vis-cond-val-sel-0').click();
    const opts = page.locator('[data-testid="csel-drop"] [data-val]');
    await expect(opts).toHaveCount(2);
    await expect(opts.filter({ hasText: LABEL_WITH_COMMA_2 })).toHaveCount(1);
  });
});

test.describe('comma-containing option reaches the Generate Docs report', () => {
  test('report lists it as one option, not split at the comma', async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
    await page.goto('/');
    await page.waitForSelector('[data-testid="add-root-group-btn"]', { timeout: 10_000 });
    await page.getByTestId('add-root-group-btn').click();
    await expect(page.locator('[data-node-id="1"]')).toBeVisible();

    await addTitledItem(page, '1', '1.1', 'Target choice');
    await setChecklistWithCommaOption(page, '1.1');

    const [docsPage] = await Promise.all([
      page.context().waitForEvent('page'),
      openDropdownItem(page, 'export-btn', 'generate-docs-item'),
    ]);
    await docsPage.waitForLoadState('domcontentloaded');

    const opts = docsPage.getByTestId('qdoc-options-1.1').locator('li');
    await expect(opts).toHaveCount(2);
    await expect(opts.filter({ hasText: LABEL_WITH_COMMA_2 })).toHaveCount(1);
    await docsPage.close();
  });
});

test.describe('comma-containing option reaches the Expression Builder tree leaf editor', () => {
  test('value picker lists it as one option, not split at the comma', async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
    await page.goto('/');
    await page.waitForSelector('[data-testid="add-root-group-btn"]', { timeout: 10_000 });
    await page.getByTestId('add-root-group-btn').click();
    await expect(page.locator('[data-node-id="1"]')).toBeVisible();

    await addTitledItem(page, '1', '1.1', 'Condition host');
    await addTitledItem(page, '1', '1.2', 'Target choice');
    await setChecklistWithCommaOption(page, '1.2');

    await page.locator('[data-node-id="1.1"]').getByTestId('action-vis').click();
    await expect(page.getByTestId('showWhenModal')).toBeVisible();
    await page.getByTestId('enablewhen-build-btn').click();
    await expect(page.getByTestId('expressionBuilderModal')).toBeVisible();

    const leaf = page.getByTestId('eb-leaf').first();
    await leaf.getByTestId('eb-leaf-item').click();
    await page.locator('[data-testid="csel-drop"] [data-val="1.2"]').click();

    await leaf.getByTestId('eb-leaf-value-select').click();
    const opts = page.locator('[data-testid="csel-drop"] [data-val]');
    await expect(opts).toHaveCount(2);
    await expect(opts.filter({ hasText: LABEL_WITH_COMMA_2 })).toHaveCount(1);
  });
});
