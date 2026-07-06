// ── E2E: sdc-questionnaire-isSubject ──────────────────────────────────────────
// Tests import, States modal editing, preview SUBJECT badge, and export
// round-trip of the SDC isSubject extension. isSubject marks the item whose
// answer identifies the QuestionnaireResponse subject.
//
// Run: npx playwright test tests/e2e/is-subject.spec.js
//
// Fixture: tests/fixtures/is-subject.fhir.json
//   q-subject — reference item WITH isSubject
//   q-plain   — reference item WITHOUT isSubject (control group)
//
// data-testid registry:
//   action-states           States action link on item nodes
//   statesModal             States modal backdrop
//   statesModalApply        Apply button inside States modal
//   states-issubject-chk    "Is subject" checkbox inside States modal
//   preview-subject-badge   SUBJECT badge in the builder preview row

import { test, expect } from '@playwright/test';
import { openDropdownItem } from './helpers/dropdown.js';
import path from 'node:path';

const FIXTURE = path.join(process.cwd(), 'tests/fixtures/is-subject.fhir.json');
const IS_URL  = 'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-isSubject';

async function loadFixture(page) {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/');
  await page.waitForSelector('[data-testid="add-root-group-btn"]', { timeout: 10_000 });
  await page.locator('[data-testid="fhir-file-input"]').setInputFiles(FIXTURE);
  await expect(page.locator('[data-preview-id="q-subject"]')).toBeVisible({ timeout: 8_000 });
}

async function openStatesModal(page, nodeId) {
  const link = page.locator(`[data-node-id="${nodeId}"]`).getByTestId('action-states').first();
  await expect(link).toBeVisible();
  await link.click();
  await expect(page.locator('[data-testid="statesModal"]')).toBeVisible();
}

async function readDownload(download) {
  return download.createReadStream().then(s => new Promise((res, rej) => {
    let d = '';
    s.on('data', c => d += c);
    s.on('end', () => res(d));
    s.on('error', rej);
  }));
}

// ── Import + preview badge ────────────────────────────────────────────────────

test.describe('is-subject — import & preview badge', () => {
  test('subject item shows a SUBJECT badge in preview', async ({ page }) => {
    await loadFixture(page);
    await expect(
      page.locator('[data-preview-id="q-subject"]').getByTestId('preview-subject-badge')
    ).toBeVisible();
  });

  test('non-subject item has no SUBJECT badge', async ({ page }) => {
    await loadFixture(page);
    await expect(
      page.locator('[data-preview-id="q-plain"]').getByTestId('preview-subject-badge')
    ).toHaveCount(0);
  });
});

// ── States modal ──────────────────────────────────────────────────────────────

test.describe('is-subject — States modal', () => {
  test('Is subject checkbox is checked for the subject item', async ({ page }) => {
    await loadFixture(page);
    await openStatesModal(page, 'q-subject');
    await expect(page.getByTestId('states-issubject-chk')).toBeChecked();
  });

  test('Is subject checkbox is unchecked for the plain item', async ({ page }) => {
    await loadFixture(page);
    await openStatesModal(page, 'q-plain');
    await expect(page.getByTestId('states-issubject-chk')).not.toBeChecked();
  });

  test('checking Is subject adds the SUBJECT badge in preview', async ({ page }) => {
    await loadFixture(page);
    await openStatesModal(page, 'q-plain');
    await page.getByTestId('states-issubject-chk').check();
    await page.getByTestId('statesModalApply').click();
    await expect(page.locator('[data-testid="statesModal"]')).toBeHidden();
    await expect(
      page.locator('[data-preview-id="q-plain"]').getByTestId('preview-subject-badge')
    ).toBeVisible();
  });

  test('unchecking Is subject removes the SUBJECT badge in preview', async ({ page }) => {
    await loadFixture(page);
    await openStatesModal(page, 'q-subject');
    await page.getByTestId('states-issubject-chk').uncheck();
    await page.getByTestId('statesModalApply').click();
    await expect(page.locator('[data-testid="statesModal"]')).toBeHidden();
    await expect(
      page.locator('[data-preview-id="q-subject"]').getByTestId('preview-subject-badge')
    ).toHaveCount(0);
  });
});

// ── Export round-trip ─────────────────────────────────────────────────────────

test.describe('is-subject — export round-trip', () => {
  test('exported JSON contains isSubject extension for q-subject only', async ({ page }) => {
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
    const subj  = q.item.find(i => i.linkId === 'q-subject');
    const plain = q.item.find(i => i.linkId === 'q-plain');
    expect((subj.extension || []).find(e => e.url === IS_URL)?.valueBoolean).toBe(true);
    expect((plain.extension || []).find(e => e.url === IS_URL)).toBeUndefined();
  });
});
