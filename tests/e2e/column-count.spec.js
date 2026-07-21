// ── E2E: sdc-questionnaire-columnCount ────────────────────────────────────────
// Tests import, preview rendering, Answer Type modal editing, and export
// round-trip of the SDC columnCount extension. Per spec, columnCount is valid
// on any choice item with a set of options; the field is editable for all
// choice types and round-trips. This preview applies the visual column layout
// only to inline option lists (radio / check-box); drop-downs keep the value
// but render unchanged.
//
// Run: npx playwright test tests/e2e/column-count.spec.js
//
// Fixture: tests/fixtures/column-count.fhir.json
//   q-cols   — radio WITH columnCount: 2 (4 options)
//   q-plain  — radio WITHOUT columnCount (control group)
//   q-select — drop-down choice WITH columnCount: 3 (field/round-trip, no visual columns)
//
// data-testid registry:
//   action-type            Answer Type action link
//   column-count-select    custom select for columnCount (all choice types)
//   csel-drop              dropdown panel of any custom select
//   answerTypeModal        Answer Type modal backdrop
//   answerTypeModalApply   Apply button in the Answer Type modal

import { test, expect } from '@playwright/test';
import { FHIR } from '../../js/fhir/urls/fhir.js';
import { openDropdownItem } from './helpers/dropdown.js';
import path from 'node:path';

const FIXTURE = path.join(process.cwd(), 'tests/fixtures/column-count.fhir.json');
const CC_URL  = FHIR.columnCount;

async function loadFixture(page) {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/');
  await page.waitForSelector('[data-testid="add-root-group-btn"]', { timeout: 10_000 });
  await page.locator('[data-testid="fhir-file-input"]').setInputFiles(FIXTURE);
  await expect(page.locator('[data-preview-id="q-cols"]')).toBeVisible({ timeout: 8_000 });
}

async function openAnswerTypeModal(page, itemId) {
  const link = page.locator(`[data-node-id="${itemId}"]`).getByTestId('action-type');
  await expect(async () => {
    await link.click();
    await expect(page.locator('[data-testid="answerTypeModal"]')).toBeVisible();
  }).toPass();
}

async function readDownload(download) {
  return download.createReadStream().then(s => new Promise((res, rej) => {
    let d = '';
    s.on('data', c => d += c);
    s.on('end', () => res(d));
    s.on('error', rej);
  }));
}

// ── Import + preview rendering ────────────────────────────────────────────────

test.describe('columnCount — preview rendering', () => {
  test('radio with columnCount gets ctrl-wrap--columns class and --col-count', async ({ page }) => {
    await loadFixture(page);
    const wrap = page.locator('[data-preview-id="q-cols"] .ctrl-wrap');
    await expect(wrap).toBeVisible();
    await expect(wrap).toHaveClass(/ctrl-wrap--columns/);
    await expect(wrap).toHaveAttribute('style', /--col-count:\s*2/);
  });

  test('radio without columnCount has no columns class', async ({ page }) => {
    await loadFixture(page);
    const wrap = page.locator('[data-preview-id="q-plain"] .ctrl-wrap');
    await expect(wrap).toBeVisible();
    await expect(wrap).not.toHaveClass(/ctrl-wrap--columns/);
  });

  test('drop-down with columnCount is not laid out in columns (preview unaffected)', async ({ page }) => {
    await loadFixture(page);
    await expect(page.locator('[data-preview-id="q-select"]')).toBeVisible();
    await expect(page.locator('[data-preview-id="q-select"] .ctrl-wrap--columns')).toHaveCount(0);
  });
});

// ── Answer Type modal ─────────────────────────────────────────────────────────

test.describe('columnCount — Answer Type modal', () => {
  test('column-count select reflects the imported value', async ({ page }) => {
    await loadFixture(page);
    await openAnswerTypeModal(page, 'q-cols');
    await expect(page.getByTestId('column-count-select')).toHaveAttribute('data-value', '2');
  });

  test('column-count select is default for the plain item', async ({ page }) => {
    await loadFixture(page);
    await openAnswerTypeModal(page, 'q-plain');
    await expect(page.getByTestId('column-count-select')).toHaveAttribute('data-value', '');
  });

  test('column-count field is shown for a drop-down choice (per spec)', async ({ page }) => {
    await loadFixture(page);
    await openAnswerTypeModal(page, 'q-select');
    await expect(page.getByTestId('column-count-select')).toHaveAttribute('data-value', '3');
  });

  test('setting columnCount applies the columns layout in preview', async ({ page }) => {
    await loadFixture(page);
    await openAnswerTypeModal(page, 'q-plain');
    await page.locator('[data-testid="answerTypeModal"]').getByTestId('column-count-select').click();
    await page.locator('[data-testid="csel-drop"] [data-val="3"]').click();
    await page.locator('[data-testid="answerTypeModalApply"]').click();
    await expect(page.locator('[data-testid="answerTypeModal"]')).not.toBeVisible();
    const wrap = page.locator('[data-preview-id="q-plain"] .ctrl-wrap');
    await expect(wrap).toHaveClass(/ctrl-wrap--columns/);
    await expect(wrap).toHaveAttribute('style', /--col-count:\s*3/);
  });

  test('clearing columnCount removes the columns layout', async ({ page }) => {
    await loadFixture(page);
    await openAnswerTypeModal(page, 'q-cols');
    await page.locator('[data-testid="answerTypeModal"]').getByTestId('column-count-select').click();
    await page.locator('[data-testid="csel-drop"] [data-val=""]').click();
    await page.locator('[data-testid="answerTypeModalApply"]').click();
    await expect(page.locator('[data-testid="answerTypeModal"]')).not.toBeVisible();
    const wrap = page.locator('[data-preview-id="q-cols"] .ctrl-wrap');
    await expect(wrap).not.toHaveClass(/ctrl-wrap--columns/);
  });
});

// ── Export round-trip ─────────────────────────────────────────────────────────

test.describe('columnCount — export round-trip', () => {
  test('exported JSON contains columnCount extension for q-cols only', async ({ page }) => {
    await loadFixture(page);
    await openDropdownItem(page, 'export-btn', 'export-quest-item');
    await expect(page.locator('[data-testid="saveFormatModal"]')).toBeVisible();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('saveFormatModalApply').click().then(() =>
        page.getByTestId('prompt-save').click()
      ),
    ]);
    const q = JSON.parse(await readDownload(download));
    const cols  = q.item.find(i => i.linkId === 'q-cols');
    const plain = q.item.find(i => i.linkId === 'q-plain');
    expect((cols.extension || []).find(e => e.url === CC_URL)?.valueInteger).toBe(2);
    expect((plain.extension || []).find(e => e.url === CC_URL)).toBeUndefined();
  });

  test('exported JSON preserves columnCount on a drop-down choice (spec-valid)', async ({ page }) => {
    await loadFixture(page);
    await openDropdownItem(page, 'export-btn', 'export-quest-item');
    await expect(page.locator('[data-testid="saveFormatModal"]')).toBeVisible();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('saveFormatModalApply').click().then(() =>
        page.getByTestId('prompt-save').click()
      ),
    ]);
    const q = JSON.parse(await readDownload(download));
    const sel = q.item.find(i => i.linkId === 'q-select');
    expect((sel.extension || []).find(e => e.url === CC_URL)?.valueInteger).toBe(3);
  });
});
