// ── E2E: extensions are written with their standard addresses; older addresses still load ──
// Fixture: tests/legacy-fixtures/legacy-extension-addresses.fhir.json (hidden, entryFormat, variable,
// preferredTerminologyServer, columnCount, answer media, answerExpression language, observationExtract code
// all written the way older versions of this builder wrote them).
//
// ── data-testid used in this suite ───────────────────────────────────────────
//   variables-card-count   number of questionnaire-level variables
//   export-btn / export-quest-item / saveFormatModal / saveFormatModalApply / prompt-save   Questionnaire export flow
// Preview elements (.preview-hidden-badge, inputs) mirror the renderer and are selected by class/attribute.
// ─────────────────────────────────────────────────────────────────────────────

import path from 'node:path';
import { test, expect } from '@playwright/test';
import { loadFixtureFile } from './helpers/load-fixture.js';
import { openDropdownItem } from './helpers/dropdown.js';

const FIXTURE = path.join(process.cwd(), 'tests/legacy-fixtures/legacy-extension-addresses.fhir.json');
const SD  = 'http://hl7.org/fhir/StructureDefinition/';
const SDC = 'http://hl7.org/fhir/uv/sdc/StructureDefinition/';

async function freshLoad(page) {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/');
  await page.waitForSelector('[data-testid="add-menu-btn"]', { timeout: 10_000 });
  await loadFixtureFile(page, FIXTURE);
  await expect(page.locator('[data-preview-id="dob"]')).toBeVisible({ timeout: 10_000 });
}

async function exportQuestionnaire(page) {
  await openDropdownItem(page, 'export-btn', 'export-quest-item');
  await expect(page.getByTestId('saveFormatModal')).toBeVisible();
  await page.getByTestId('saveFormatModalApply').click();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('prompt-save').click(),
  ]);
  const chunks = await (await download.createReadStream()).toArray();
  return JSON.parse(Buffer.concat(chunks).toString());
}

const item = (q, id) => q.item.find(i => i.linkId === id);
const exts = (owner, url) => (owner.extension || []).filter(e => e.url === url);

test.describe('older extension addresses load into the UI', () => {
  test('hidden, entry format and the variable are recognised', async ({ page }) => {
    await freshLoad(page);
    await expect(page.locator('[data-preview-id="secret"] .preview-hidden-badge')).toBeVisible();
    await expect(page.locator('[data-preview-id="dob"] input, [data-preview-id="dob"] textarea').first()).toHaveAttribute('placeholder', 'dd/mm/yyyy');
    await expect(page.getByTestId('variables-card-count')).toContainText('1');
  });
});

test.describe('export writes the standard addresses and types', () => {
  test('core addresses replace the older ones, nothing is duplicated', async ({ page }) => {
    await freshLoad(page);
    const q = await exportQuestionnaire(page);

    expect(exts(item(q, 'secret'), SD + 'questionnaire-hidden')).toEqual([{ url: SD + 'questionnaire-hidden', valueBoolean: true }]);
    expect(exts(item(q, 'secret'), SDC + 'sdc-questionnaire-hidden')).toEqual([]);
    expect(exts(item(q, 'dob'), SD + 'entryFormat')).toEqual([{ url: SD + 'entryFormat', valueString: 'dd/mm/yyyy' }]);
    expect(exts(item(q, 'dob'), SDC + 'sdc-questionnaire-entryFormat')).toEqual([]);

    expect(exts(q, SD + 'variable')).toHaveLength(1);
    expect(exts(q, SDC + 'sdc-questionnaire-variable')).toEqual([]);
    expect(exts(q, SD + 'preferredTerminologyServer')).toEqual([{ url: SD + 'preferredTerminologyServer', valueUrl: 'https://tx.example.org/r4' }]);
    expect(exts(q, SDC + 'sdc-questionnaire-preferredTerminologyServer')).toEqual([]);
  });

  test('column count is a positive integer, answer media uses its real name', async ({ page }) => {
    await freshLoad(page);
    const diet = item(await exportQuestionnaire(page), 'diet');
    expect(exts(diet, SDC + 'sdc-questionnaire-columnCount')).toEqual([{ url: SDC + 'sdc-questionnaire-columnCount', valuePositiveInt: 2 }]);
    const media = diet.answerOption[0].extension;
    expect(media).toEqual([{ url: SDC + 'sdc-questionnaire-itemAnswerMedia', valueAttachment: { contentType: 'image/png', url: 'https://example.org/veg.png' } }]);
  });

  test('the expression language and the observation relationship code are kept', async ({ page }) => {
    await freshLoad(page);
    const q = await exportQuestionnaire(page);
    const expr = exts(item(q, 'pick'), SDC + 'sdc-questionnaire-answerExpression');
    expect(expr).toEqual([{ url: SDC + 'sdc-questionnaire-answerExpression', valueExpression: { language: 'application/x-fhir-query', expression: 'Condition?patient={{%patient.id}}' } }]);
    expect(exts(item(q, 'weight'), SDC + 'sdc-questionnaire-observationExtract')).toEqual([{ url: SDC + 'sdc-questionnaire-observationExtract', valueCode: 'member' }]);
  });
});
