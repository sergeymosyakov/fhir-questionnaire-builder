// ── E2E: Observation export modal (obs-export-modal.js + fhir/obs-export.js) ─
// Save ▾ → "Observations" opens a metadata form (file name, subject, author,
// QR id, SDC profile); Apply downloads the extracted transaction Bundle with
// that metadata flowing into each Observation.
//
// Run: npx playwright test tests/e2e/obs-export-modal.spec.js
//
// ── data-testid registry ─────────────────────────────────────────────────────
//   export-btn / export-obs-item   Save ▾ trigger / "Observations" menu item
//   obsExportModal                 modal backdrop
//   obsExportModalApply            Apply (download) button
//   obsExportModalCancel           Cancel button
//   obs-export-filename            file name input
//   obs-export-subject             Observation.subject input
//   obs-export-author              Observation.performer input
//   obs-export-qr-id               QuestionnaireResponse id input
//   obs-export-profile-chk         "Add SDC profile" checkbox
//   preview-search-input           preview search box (clicked to commit a preview input)
// ─────────────────────────────────────────────────────────────────────────────

import path from 'node:path';
import fs from 'node:fs';
import { test, expect } from '@playwright/test';
import { FHIR } from '../../js/fhir/urls/fhir.js';
import { freshStart } from './helpers/builder.js';
import { openDropdownItem } from './helpers/dropdown.js';

const FIXTURE = path.resolve('tests/fixtures/obs-extract-e2e.fhir.json');
const WEIGHT_LOINC = '29463-7';

// Same commit pattern as the other preview-input specs (see e2e.instructions.md).
async function commitInput(page) {
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  await page.getByTestId('preview-search-input').click();
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
}

async function openModalWithWeight(page) {
  await page.addInitScript(() => localStorage.clear());
  await freshStart(page);
  await page.getByTestId('fhir-file-input').setInputFiles(FIXTURE);
  const weight = page.locator('[data-preview-id="weight"] input[type="number"]');
  await expect(weight).toBeVisible();
  await weight.fill('72');
  await commitInput(page);
  await openDropdownItem(page, 'export-btn', 'export-obs-item');
  await expect(page.getByTestId('obsExportModal')).toBeVisible();
}

async function applyAndRead(page) {
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('obsExportModalApply').click(),
  ]);
  return { download, bundle: JSON.parse(fs.readFileSync(await download.path(), 'utf8')) };
}

const weightObs = bundle =>
  bundle.entry.map(e => e.resource).find(r => r.code?.coding?.some(c => c.code === WEIGHT_LOINC));

test.describe('Observation export modal', () => {
  test('opens with a suggested file name, empty metadata and the SDC profile on', async ({ page }) => {
    await openModalWithWeight(page);
    await expect(page.getByTestId('obs-export-filename')).toHaveValue(/-observations\.json$/);
    await expect(page.getByTestId('obs-export-subject')).toHaveValue('');
    await expect(page.getByTestId('obs-export-author')).toHaveValue('');
    await expect(page.getByTestId('obs-export-qr-id')).toHaveValue('');
    await expect(page.getByTestId('obs-export-profile-chk')).toBeChecked();
  });

  test('subject, author, QR id and profile flow into the downloaded Observations', async ({ page }) => {
    await openModalWithWeight(page);
    await page.getByTestId('obs-export-filename').fill('my-obs');
    await page.getByTestId('obs-export-subject').fill('Patient/123');
    await page.getByTestId('obs-export-author').fill('Practitioner/456');
    await page.getByTestId('obs-export-qr-id').fill('qr-001');

    const { download, bundle } = await applyAndRead(page);
    expect(download.suggestedFilename()).toBe('my-obs.json');
    expect(bundle.resourceType).toBe('Bundle');
    expect(bundle.type).toBe('transaction');

    const obs = weightObs(bundle);
    expect(obs).toBeDefined();
    expect(obs.status).toBe('final');
    expect(obs.valueQuantity.value).toBe(72);
    expect(obs.subject).toEqual({ reference: 'Patient/123' });
    expect(obs.performer).toEqual([{ reference: 'Practitioner/456' }]);
    expect(JSON.stringify(obs.derivedFrom)).toContain('QuestionnaireResponse/qr-001');
    expect(obs.meta.profile).toEqual([FHIR.sdcObservation]);
    await expect(page.getByTestId('obsExportModal')).toBeHidden();
  });

  test('unchecking "Add SDC profile" omits meta.profile', async ({ page }) => {
    await openModalWithWeight(page);
    await page.getByTestId('obs-export-profile-chk').uncheck();

    const { bundle } = await applyAndRead(page);
    const obs = weightObs(bundle);
    expect(obs).toBeDefined();
    expect(obs.meta?.profile).toBeUndefined();
  });

  test('Cancel closes the modal without downloading', async ({ page }) => {
    await openModalWithWeight(page);
    let downloads = 0;
    page.on('download', () => { downloads++; });
    await page.getByTestId('obsExportModalCancel').click();
    await expect(page.getByTestId('obsExportModal')).toBeHidden();
    expect(downloads).toBe(0);
  });
});
