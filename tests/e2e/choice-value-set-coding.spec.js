// ── E2E: choice answers backed by a value set keep their code system and label ──
// A selected option of a value-set-backed choice question is exported as valueCoding with system, code and display.
// Fixture: tests/fixtures/choice-value-set-coding.fhir.json
//
// ── data-testid used in this suite ───────────────────────────────────────────
//   fhir-file-input / qr-file-input   hidden file inputs (questionnaire / response)
//   export-btn / export-qr-item / qrExportModal / qrExportModalApply   QR export flow
// Preview controls (.sc-trigger, .oc-drop, .oc-opt, .radio-label) mirror the renderer and are selected by class/label.
// ─────────────────────────────────────────────────────────────────────────────

import path from 'node:path';
import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import { loadFixtureFile } from './helpers/load-fixture.js';
import { openDropdownItem } from './helpers/dropdown.js';

const FIXTURE = path.join(process.cwd(), 'tests/fixtures/choice-value-set-coding.fhir.json');
const PROXY_HOST = 'fhir-cors-proxy.sergeymosyakov.workers.dev';
const DIET = 'https://example.org/diet';
const PAIN = 'https://example.org/pain';
const EXT = 'https://example.org/ext';

const LOW_CARB = { system: DIET, code: 'low-carb', display: 'Low Carbohydrate' };
const MEDITERRANEAN = { system: DIET, code: 'mediterranean', display: 'Mediterranean' };

// 'full' expands the external value set; 'empty' answers with a valid but empty expansion (value set not usable)
async function freshLoad(page, expansion = 'full') {
  await page.route(url => url.hostname === PROXY_HOST, async route => {
    const contains = expansion === 'full'
      ? [{ system: EXT, code: 'x1', display: 'External One' }, { system: EXT, code: 'x2', display: 'External Two' }]
      : [];
    await route.fulfill({ status: 200, contentType: 'application/fhir+json', body: JSON.stringify({ resourceType: 'ValueSet', expansion: { contains } }) });
  });
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/');
  await page.waitForSelector('[data-testid="add-menu-btn"]', { timeout: 10_000 });
  await loadFixtureFile(page, FIXTURE);
  await expect(page.locator('[data-preview-id="vs-select"]')).toBeVisible({ timeout: 10_000 });
}

const item = (page, id) => page.locator(`[data-preview-id="${id}"]`);

async function selectOption(page, id, label) {
  await expect(async () => {
    await page.keyboard.press('Escape');
    await item(page, id).locator('.sc-trigger').first().click();
    await expect(page.locator('.oc-drop .oc-opt', { hasText: label }).first()).toBeVisible();
  }).toPass();
  await page.locator('.oc-drop .oc-opt', { hasText: label }).first().click();
}

async function exportQR(page) {
  await openDropdownItem(page, 'export-btn', 'export-qr-item');
  await expect(page.getByTestId('qrExportModal')).toBeVisible();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('qrExportModalApply').click(),
  ]);
  return JSON.parse(readFileSync(await download.path(), 'utf8'));
}

const answersOf = (qr, linkId) => qr.item.find(i => i.linkId === linkId)?.answer;
const coding = c => ({ valueCoding: c });

async function loadResponse(page, items) {
  await page.getByTestId('qr-file-input').setInputFiles({
    name: 'response.qr.json', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ resourceType: 'QuestionnaireResponse', status: 'completed', item: items })),
  });
}

test.describe('choice backed by a contained value set', () => {
  test('a drop-down pick is exported with system, code and display', async ({ page }) => {
    await freshLoad(page);
    await selectOption(page, 'vs-select', 'Low Carbohydrate');
    expect(answersOf(await exportQR(page), 'vs-select')).toEqual([coding(LOW_CARB)]);
  });

  test('a radio pick is exported with system, code and display', async ({ page }) => {
    await freshLoad(page);
    await item(page, 'vs-radio').locator('.radio-label', { hasText: 'Mediterranean' }).click();
    expect(answersOf(await exportQR(page), 'vs-radio')).toEqual([coding(MEDITERRANEAN)]);
  });

  test('every ticked check-box is exported with system, code and display', async ({ page }) => {
    await freshLoad(page);
    await item(page, 'vs-checklist').getByLabel('Low Carbohydrate').check();
    await item(page, 'vs-checklist').getByLabel('Mediterranean').check();
    expect(answersOf(await exportQR(page), 'vs-checklist')).toEqual([coding(LOW_CARB), coding(MEDITERRANEAN)]);
  });

  test('a default taken from the value set is exported with system and display', async ({ page }) => {
    await freshLoad(page);
    expect(answersOf(await exportQR(page), 'vs-default')).toEqual([coding(MEDITERRANEAN)]);
  });

  test('a loaded repeating drop-down exports every answer with its coding', async ({ page }) => {
    await freshLoad(page);
    await loadResponse(page, [{ linkId: 'vs-repeat', answer: [coding(LOW_CARB), coding(MEDITERRANEAN)] }]);
    expect(answersOf(await exportQR(page), 'vs-repeat')).toEqual([coding(LOW_CARB), coding(MEDITERRANEAN)]);
  });
});

test.describe('choice backed by an external value set', () => {
  test('a pick from the expanded set is exported with the set\'s system and display', async ({ page }) => {
    await freshLoad(page);
    await selectOption(page, 'vs-ext', 'External Two');
    expect(answersOf(await exportQR(page), 'vs-ext')).toEqual([coding({ system: EXT, code: 'x2', display: 'External Two' })]);
  });

  test('a loaded response keeps its coding even when the value set cannot be expanded', async ({ page }) => {
    await freshLoad(page, 'empty');
    const given = coding({ system: EXT, code: 'x1', display: 'External One' });
    await loadResponse(page, [{ linkId: 'vs-ext', answer: [given] }]);
    expect(answersOf(await exportQR(page), 'vs-ext')).toEqual([given]);
  });

  test('without a usable value set or a loaded coding only the code can be exported', async ({ page }) => {
    await freshLoad(page, 'empty');
    await loadResponse(page, [{ linkId: 'vs-ext', answer: [{ valueCoding: { code: 'x1' } }] }]);
    expect(answersOf(await exportQR(page), 'vs-ext')).toEqual([coding({ code: 'x1' })]);
  });
});

test.describe('choice with options listed on the question', () => {
  test('keeps using its own option definition', async ({ page }) => {
    await freshLoad(page);
    await selectOption(page, 'list-select', 'Sharp');
    expect(answersOf(await exportQR(page), 'list-select')).toEqual([coding({ system: PAIN, code: 'sharp', display: 'Sharp' })]);
  });
});
