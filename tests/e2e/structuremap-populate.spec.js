// ── E2E: SDC StructureMap-based Population ───────────────────────────────────
// Tests: Answers menu item hidden/visible, modal opens with patient search
// input, cancel doesn't dispatch, apply dispatches the request event, bare
// ID auto-prefixes, Properties modal exposes the sourceStructureMap field.
//
// Tested elements:
//   structuremap-populate-btn                 — menu item in Answers ▾
//   structureMapPopulate                      — modal testid
//   structuremap-populate-patient-ref-input    — patient ref input in modal
//   meta-source-structure-map                 — Properties modal field

import { test, expect } from '@playwright/test';
import path from 'node:path';
import { openDropdownItem } from './helpers/dropdown.js';
import { freshStart } from './helpers/builder.js';
import { openModal } from './helpers/metadata.js';

const FIXTURE = path.resolve('tests/fixtures/structuremap-populate.fhir.json');

async function setFhirBaseUrl(page, url) {
  await page.addInitScript(u => localStorage.setItem('fhirqb.server.fhirBaseUrl', u), url);
}

async function clearFhirBaseUrl(page) {
  await page.addInitScript(() => localStorage.removeItem('fhirqb.server.fhirBaseUrl'));
}

async function loadFixture(page) {
  await freshStart(page);
  await page.locator('[data-testid="fhir-file-input"]').setInputFiles(FIXTURE);
  await expect(page.getByTestId('quest-meta-card')).toBeVisible({ timeout: 8_000 });
}

test.describe('StructureMap Population', () => {
  test.beforeEach(async ({ page }) => {
    await clearFhirBaseUrl(page);
  });

  test('menu item hidden in Answers menu when no FHIR base server configured', async ({ page }) => {
    await loadFixture(page);
    await page.getByTestId('answers-btn').click();
    await expect(page.getByTestId('structuremap-populate-btn')).toBeHidden();
    await page.keyboard.press('Escape');
  });

  test('menu item visible in Answers menu when fhirBaseUrl set and questionnaire loaded', async ({ page }) => {
    await setFhirBaseUrl(page, 'https://hapi.fhir.org/baseR4');
    await loadFixture(page);
    await page.getByTestId('answers-btn').click();
    await expect(page.getByTestId('structuremap-populate-btn')).toBeVisible();
    await page.keyboard.press('Escape');
  });

  test('clicking menu item opens modal with patient search input', async ({ page }) => {
    await setFhirBaseUrl(page, 'https://hapi.fhir.org/baseR4');
    await loadFixture(page);
    await openDropdownItem(page, 'answers-btn', 'structuremap-populate-btn');
    await expect(page.locator('[data-testid="structureMapPopulate"]').first()).toBeVisible();
    await expect(page.getByTestId('structuremap-populate-patient-ref-input')).toBeVisible();
  });

  test('modal cancel closes without dispatching event', async ({ page }) => {
    await setFhirBaseUrl(page, 'https://hapi.fhir.org/baseR4');
    await loadFixture(page);
    await page.evaluate(() => {
      document.addEventListener('sdc:structuremap-populate-requested', () => { window.__smPopulateFired = true; }, { once: true });
    });
    await openDropdownItem(page, 'answers-btn', 'structuremap-populate-btn');
    await page.getByTestId('structuremap-populate-patient-ref-input').waitFor();
    await page.keyboard.press('Escape');
    const fired = await page.evaluate(() => window.__smPopulateFired ?? false);
    expect(fired).toBe(false);
  });

  test('Apply dispatches STRUCTUREMAP_POPULATE_REQUESTED with patientRef', async ({ page }) => {
    await setFhirBaseUrl(page, 'https://hapi.fhir.org/baseR4');
    await loadFixture(page);
    await page.evaluate(() => {
      document.addEventListener('sdc:structuremap-populate-requested', e => {
        window.__smPopulateDetail = e.detail;
      }, { once: true });
    });
    await openDropdownItem(page, 'answers-btn', 'structuremap-populate-btn');
    const input = page.getByTestId('structuremap-populate-patient-ref-input');
    await input.fill('Patient/test-123');
    await page.locator('[data-testid="structureMapPopulate"] .modal-btn--apply').click();
    const detail = await page.evaluate(() => window.__smPopulateDetail);
    expect(detail?.patientRef).toBe('Patient/test-123');
  });

  test('bare ID auto-prefixes with Patient/', async ({ page }) => {
    await setFhirBaseUrl(page, 'https://hapi.fhir.org/baseR4');
    await loadFixture(page);
    await page.evaluate(() => {
      document.addEventListener('sdc:structuremap-populate-requested', e => {
        window.__smPopulateDetail = e.detail;
      }, { once: true });
    });
    await openDropdownItem(page, 'answers-btn', 'structuremap-populate-btn');
    const input = page.getByTestId('structuremap-populate-patient-ref-input');
    await input.fill('98765');
    await page.locator('[data-testid="structureMapPopulate"] .modal-btn--apply').click();
    const detail = await page.evaluate(() => window.__smPopulateDetail);
    expect(detail?.patientRef).toBe('Patient/98765');
  });

  test('Properties modal shows the imported sourceStructureMap canonical reference', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await expect(page.getByTestId('meta-source-structure-map')).toHaveValue('#patient-to-qr-demo');
    await page.getByTestId('metadataModalCancel').click();
  });
});
