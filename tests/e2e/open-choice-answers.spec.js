// ── E2E: open-choice answers — a picked option is a coded answer, typed text is a string ──
// R4: open-choice = "a Coding drawn from a list of possible answers or a free-text entry in a string".
// Fixture: tests/fixtures/open-choice-answers.fhir.json
//
// ── data-testid used in this suite ───────────────────────────────────────────
//   oc-coded-badge        ✓ marker shown when the value was picked from the list
//   oc-match-hint         hint shown when typed text equals a listed option
//   fhir-file-input / qr-file-input   hidden file inputs (questionnaire / response)
//   action-default / initialModal / initial-option-select / initialModalApply   builder Default value modal
//   export-btn / export-qr-item / qrExportModal / qrExportModalApply   QR export flow
//   preview-search-input  clicked to blur (commit) a typed value
// Preview controls (.oc-input, .oc-drop, .oc-opt, .icon-ok/.icon-fail) mirror the renderer and are selected by class.
// ─────────────────────────────────────────────────────────────────────────────

import path from 'node:path';
import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import { loadFixtureFile } from './helpers/load-fixture.js';
import { openDropdownItem, pickCustomSelect } from './helpers/dropdown.js';

const FIXTURE = path.join(process.cwd(), 'tests/fixtures/open-choice-answers.fhir.json');
const BARIATRIC = path.resolve('sampledata/example-bariatric.fhir.json');
const BARIATRIC_QR = path.resolve('sampledata/example-bariatric-response.qr.json');
const VS_DEMO = path.resolve('sampledata/valueset-demo.fhir.json');
const VS_DEMO_QR = path.resolve('sampledata/valueset-demo-response.qr.json');
const PROXY_HOST = 'fhir-cors-proxy.sergeymosyakov.workers.dev';
const PAIN = 'https://example.org/pain';
const DIET = 'https://example.org/diet';
const EXT = 'https://example.org/ext';

async function mockExternalExpansion(page) {
  await page.route(url => url.hostname === PROXY_HOST, async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/fhir+json',
      body: JSON.stringify({ resourceType: 'ValueSet', expansion: { contains: [
        { system: EXT, code: 'x1', display: 'External One' },
        { system: EXT, code: 'x2', display: 'External Two' },
      ] } }),
    });
  });
}

async function freshLoad(page, fixture = FIXTURE, readyId = 'oc-list') {
  await mockExternalExpansion(page);
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/');
  await page.waitForSelector('[data-testid="add-menu-btn"]', { timeout: 10_000 });
  await loadFixtureFile(page, fixture);
  await expect(page.locator(`[data-preview-id="${readyId}"]`)).toBeVisible({ timeout: 10_000 });
}

const item  = (page, id) => page.locator(`[data-preview-id="${id}"]`);
const input = (page, id) => item(page, id).locator('.oc-input').first();
const badge = (page, id) => item(page, id).getByTestId('oc-coded-badge');
const hint  = (page, id) => item(page, id).getByTestId('oc-match-hint');

async function pick(page, id, label) {
  await expect(async () => {
    await input(page, id).click();
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

// Typed values reach enableWhen on commit (blur): clicking the search input is the supported way to blur
async function commitInput(page) {
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  await page.getByTestId('preview-search-input').click();
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
}

function findItem(items, linkId) {
  for (const it of items || []) {
    if (it.linkId === linkId) return it;
    const nested = findItem(it.item, linkId);
    if (nested) return nested;
  }
  return undefined;
}
const answersOf = (qr, linkId) => findItem(qr.item, linkId)?.answer;

async function loadResponse(page, qr) {
  await page.getByTestId('qr-file-input').setInputFiles({
    name: 'response.qr.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(qr)),
  });
}

const responseOf = items => ({ resourceType: 'QuestionnaireResponse', status: 'completed', item: items });

test.describe('open-choice — values from a listed options', () => {
  test('picking an option records a coded answer and shows the ✓ marker', async ({ page }) => {
    await freshLoad(page);
    await expect(badge(page, 'oc-list')).toBeHidden();
    await pick(page, 'oc-list', 'Ache');
    await expect(input(page, 'oc-list')).toHaveValue('Ache');
    await expect(badge(page, 'oc-list')).toBeVisible();
    const qr = await exportQR(page);
    expect(answersOf(qr, 'oc-list')).toEqual([{ valueCoding: { system: PAIN, code: 'ache', display: 'Ache' } }]);
  });

  test('typing free text records a string answer without the marker', async ({ page }) => {
    await freshLoad(page);
    await input(page, 'oc-list').fill('Dull and throbbing');
    await expect(badge(page, 'oc-list')).toBeHidden();
    await expect(hint(page, 'oc-list')).toBeHidden();
    const qr = await exportQR(page);
    expect(answersOf(qr, 'oc-list')).toEqual([{ valueString: 'Dull and throbbing' }]);
  });

  test('text typed exactly as an option stays free text, with a hint; picking it then makes it coded', async ({ page }) => {
    await freshLoad(page);
    await input(page, 'oc-list').fill('Ache');
    await expect(hint(page, 'oc-list')).toBeVisible();
    await expect(badge(page, 'oc-list')).toBeHidden();
    let qr = await exportQR(page);
    expect(answersOf(qr, 'oc-list')).toEqual([{ valueString: 'Ache' }]);

    await pick(page, 'oc-list', 'Ache');
    await expect(hint(page, 'oc-list')).toBeHidden();
    await expect(badge(page, 'oc-list')).toBeVisible();
    qr = await exportQR(page);
    expect(answersOf(qr, 'oc-list')).toEqual([{ valueCoding: { system: PAIN, code: 'ache', display: 'Ache' } }]);
  });

  test('editing a picked value turns it into free text', async ({ page }) => {
    await freshLoad(page);
    await pick(page, 'oc-list', 'Sharp');
    await expect(badge(page, 'oc-list')).toBeVisible();
    await input(page, 'oc-list').fill('Sharp-ish');
    await expect(badge(page, 'oc-list')).toBeHidden();
    const qr = await exportQR(page);
    expect(answersOf(qr, 'oc-list')).toEqual([{ valueString: 'Sharp-ish' }]);
  });

  test('clearing the field removes the answer', async ({ page }) => {
    await freshLoad(page);
    await pick(page, 'oc-list', 'Ache');
    await input(page, 'oc-list').fill('');
    const qr = await exportQR(page);
    expect(answersOf(qr, 'oc-list')).toBeUndefined();
  });
});

test.describe('open-choice — value sets', () => {
  test('contained value set: pick is coded (with the set\'s system), text is a string', async ({ page }) => {
    await freshLoad(page);
    await pick(page, 'oc-vs', 'Mediterranean');
    await expect(badge(page, 'oc-vs')).toBeVisible();
    let qr = await exportQR(page);
    expect(answersOf(qr, 'oc-vs')).toEqual([{ valueCoding: { system: DIET, code: 'mediterranean', display: 'Mediterranean' } }]);

    await input(page, 'oc-vs').fill('Mediterranean-ish');
    qr = await exportQR(page);
    expect(answersOf(qr, 'oc-vs')).toEqual([{ valueString: 'Mediterranean-ish' }]);
  });

  test('external value set: pick is coded, text is a string', async ({ page }) => {
    await freshLoad(page);
    await pick(page, 'oc-ext', 'External Two');
    await expect(badge(page, 'oc-ext')).toBeVisible();
    let qr = await exportQR(page);
    expect(answersOf(qr, 'oc-ext')).toEqual([{ valueCoding: { system: EXT, code: 'x2', display: 'External Two' } }]);

    await input(page, 'oc-ext').fill('something else');
    qr = await exportQR(page);
    expect(answersOf(qr, 'oc-ext')).toEqual([{ valueString: 'something else' }]);
  });
});

test.describe('open-choice — options only', () => {
  test('the field is read-only and a pick is a coded answer', async ({ page }) => {
    await freshLoad(page);
    await expect(input(page, 'oc-only')).toHaveAttribute('readonly', '');
    await pick(page, 'oc-only', 'Sharp');
    await expect(input(page, 'oc-only')).toHaveValue('Sharp');
    const qr = await exportQR(page);
    expect(answersOf(qr, 'oc-only')).toEqual([{ valueCoding: { system: PAIN, code: 'sharp', display: 'Sharp' } }]);
  });
});

test.describe('open-choice — required and conditional items', () => {
  test('a required item passes with either a picked option or typed text', async ({ page }) => {
    await freshLoad(page);
    await expect(item(page, 'oc-req').locator('.icon-fail')).toBeVisible();
    await pick(page, 'oc-req', 'Ache');
    await expect(item(page, 'oc-req').locator('.icon-ok')).toBeVisible();
    await input(page, 'oc-req').fill('');
    await expect(item(page, 'oc-req').locator('.icon-fail')).toBeVisible();
    await input(page, 'oc-req').fill('anything');
    await expect(item(page, 'oc-req').locator('.icon-ok')).toBeVisible();
  });

  test('enableWhen answerCoding opens only for the picked option', async ({ page }) => {
    await freshLoad(page);
    const dep = item(page, 'dep');
    await expect(dep).toHaveClass(/lform-waiting/);
    await pick(page, 'oc-list', 'Sharp');
    await expect(dep).toHaveClass(/lform-waiting/);
    await pick(page, 'oc-list', 'Ache');
    await expect(dep).not.toHaveClass(/lform-waiting/);
    await input(page, 'oc-list').fill('Ache!');
    await commitInput(page);
    await expect(dep).toHaveClass(/lform-waiting/);
  });
});

test.describe('open-choice — default values', () => {
  test('a coded default is a picked option, a string default is text', async ({ page }) => {
    await freshLoad(page);
    await expect(input(page, 'oc-init-coded')).toHaveValue('Mediterranean');
    await expect(badge(page, 'oc-init-coded')).toBeVisible();
    await expect(input(page, 'oc-init-text')).toHaveValue('my own diet');
    await expect(badge(page, 'oc-init-text')).toBeHidden();
    const qr = await exportQR(page);
    expect(answersOf(qr, 'oc-init-coded')).toEqual([{ valueCoding: { system: DIET, code: 'mediterranean', display: 'Mediterranean' } }]);
    expect(answersOf(qr, 'oc-init-text')).toEqual([{ valueString: 'my own diet' }]);
  });
});

test.describe('open-choice — other renderings and read-only values', () => {
  test('shown as radio buttons, a pick is still a coded answer', async ({ page }) => {
    await freshLoad(page);
    await item(page, 'oc-radio').locator('.radio-label', { hasText: 'Sharp' }).click();
    const qr = await exportQR(page);
    expect(answersOf(qr, 'oc-radio')).toEqual([{ valueCoding: { system: PAIN, code: 'sharp', display: 'Sharp' } }]);
  });

  test('a read-only coded default shows its label, not an object', async ({ page }) => {
    await freshLoad(page);
    await expect(item(page, 'oc-readonly').getByTestId('preview-readonly-value')).toHaveText('Low Carbohydrate');
  });

  test('a calculated open-choice mirrors a picked option as readable text and as a coded answer', async ({ page }) => {
    await freshLoad(page);
    const mirror = item(page, 'oc-mirror').locator('[data-calc-id="oc-mirror"]');
    await pick(page, 'oc-list', 'Ache');
    await expect(mirror).toHaveText('Ache');
    const qr = await exportQR(page);
    expect(answersOf(qr, 'oc-mirror')).toEqual([{ valueCoding: { system: PAIN, code: 'ache', display: 'Ache' } }]);
  });
});

test.describe('open-choice — default set in the builder', () => {
  test('a default picked in the Default modal is a picked option in the preview and export', async ({ page }) => {
    await freshLoad(page);
    await page.locator('[data-node-id="oc-list"]').getByTestId('action-default').click();
    await expect(page.getByTestId('initialModal')).toBeVisible();
    await pickCustomSelect(page, 'initial-option-select', 'sharp');
    await page.getByTestId('initialModalApply').click();
    await expect(page.getByTestId('initialModal')).not.toBeVisible();

    await expect(input(page, 'oc-list')).toHaveValue('Sharp');
    await expect(badge(page, 'oc-list')).toBeVisible();
    const qr = await exportQR(page);
    expect(answersOf(qr, 'oc-list')).toEqual([{ valueCoding: { system: PAIN, code: 'sharp', display: 'Sharp' } }]);
  });
});

test.describe('open-choice — loading and re-exporting a response', () => {
  test('coded and typed answers keep their kind through import and export', async ({ page }) => {
    await freshLoad(page);
    const given = [
      { linkId: 'oc-list', answer: [{ valueCoding: { system: PAIN, code: 'sharp', display: 'Sharp' } }] },
      { linkId: 'oc-vs', answer: [{ valueString: 'my own diet' }] },
      { linkId: 'oc-ext', answer: [{ valueCoding: { system: EXT, code: 'x1', display: 'External One' } }] },
      { linkId: 'oc-only', answer: [{ valueCoding: { system: PAIN, code: 'ache', display: 'Ache' } }] },
    ];
    await loadResponse(page, responseOf(given));

    await expect(input(page, 'oc-list')).toHaveValue('Sharp');
    await expect(badge(page, 'oc-list')).toBeVisible();
    await expect(input(page, 'oc-vs')).toHaveValue('my own diet');
    await expect(badge(page, 'oc-vs')).toBeHidden();
    await expect(input(page, 'oc-ext')).toHaveValue('External One');
    await expect(badge(page, 'oc-ext')).toBeVisible();

    const qr = await exportQR(page);
    for (const g of given) expect(answersOf(qr, g.linkId)).toEqual(g.answer);
  });

  test('a repeating open-choice keeps its coded and typed answers', async ({ page }) => {
    await freshLoad(page);
    const answer = [
      { valueCoding: { system: PAIN, code: 'ache', display: 'Ache' } },
      { valueString: 'burning' },
    ];
    await loadResponse(page, responseOf([{ linkId: 'oc-rep', answer }]));
    await expect(item(page, 'oc-rep').locator('.oc-input')).toHaveCount(2);
    const qr = await exportQR(page);
    expect(answersOf(qr, 'oc-rep')).toEqual(answer);
  });

  test('the value-set sample response loads as a picked option', async ({ page }) => {
    await freshLoad(page, VS_DEMO, 'q-activity');
    await page.getByTestId('qr-file-input').setInputFiles(VS_DEMO_QR);
    await expect(input(page, 'q-activity')).toHaveValue('Moderately active (3–5 days/week)');
    await expect(badge(page, 'q-activity')).toBeVisible();
    const qr = await exportQR(page);
    expect(answersOf(qr, 'q-activity')).toEqual([{ valueCoding: {
      system: 'https://example.org/fhir/CodeSystem/activity-level', code: 'moderate', display: 'Moderately active (3–5 days/week)',
    } }]);
  });

  test('the bundled sample response still loads and re-exports its open-choice answer', async ({ page }) => {
    await freshLoad(page, BARIATRIC, 'q-preferred-surgeon');
    await page.getByTestId('qr-file-input').setInputFiles(BARIATRIC_QR);
    await expect(input(page, 'q-preferred-surgeon')).toHaveValue('University Medical Center');
    const qr = await exportQR(page);
    expect(answersOf(qr, 'q-preferred-surgeon')).toEqual([{ valueString: 'University Medical Center' }]);
  });
});
