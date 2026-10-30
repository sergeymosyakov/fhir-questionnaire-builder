// ── E2E: enableWhen on date / dateTime / time answers ─────────────────────────
// Dependent items in the preview must switch between dimmed (condition unmet)
// and active (condition met) according to the entered date/time. Answers are
// loaded through a QuestionnaireResponse so exact values can be set directly.
//
// Fixture: tests/fixtures/enable-when-date.fhir.json
//   dob       date      dep-gt  enableWhen dob >  2024-06-15
//                       dep-eq  enableWhen dob =  2024-06-15
//                       dep-le  enableWhen dob <= 2024-06-15
//   appt      dateTime  dep-appt enableWhen appt >= 2024-06-15T10:00:00Z
//   tm        time      dep-tm   enableWhen tm   >= 10:00:00
//
// Run: npx playwright test tests/e2e/enable-when-date.spec.js
//
// ── data-testid registry ─────────────────────────────────────────────────────
//   fhir-file-input   hidden file <input> for Open → FHIR JSON
//   qr-file-input     hidden file <input> for Answers → QuestionnaireResponse
// ─────────────────────────────────────────────────────────────────────────────

import path from 'node:path';
import { test, expect } from '@playwright/test';
import { freshStart } from './helpers/builder.js';

const FIXTURE = path.resolve('tests/fixtures/enable-when-date.fhir.json');

async function loadFixture(page) {
  await freshStart(page);
  await page.getByTestId('fhir-file-input').setInputFiles(FIXTURE);
  await expect(page.locator('[data-preview-id="dob"]')).toBeVisible({ timeout: 8_000 });
}

async function loadAnswers(page, linkId, valueKey, value) {
  const qr = {
    resourceType: 'QuestionnaireResponse',
    status: 'in-progress',
    item: [{ linkId, answer: [{ [valueKey]: value }] }],
  };
  await page.getByTestId('qr-file-input').setInputFiles({
    name: 'answers.qr.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(qr)),
  });
}

const dep = (page, id) => page.locator(`[data-preview-id="${id}"]`);

async function expectActive(page, id, active) {
  await expect(dep(page, id)).toBeVisible();
  if (active) await expect(dep(page, id)).not.toHaveClass(/lform-waiting/);
  else await expect(dep(page, id)).toHaveClass(/lform-waiting/);
}

test.describe('enableWhen answerDate / answerDateTime / answerTime', () => {
  test('all dependents are dimmed while the answers are empty', async ({ page }) => {
    await loadFixture(page);
    for (const id of ['dep-gt', 'dep-eq', 'dep-le', 'dep-appt', 'dep-tm']) {
      await expectActive(page, id, false);
    }
  });

  test('date operators > = <= follow the entered date', async ({ page }) => {
    await loadFixture(page);
    await loadAnswers(page, 'dob', 'valueDate', '2024-06-16');
    await expectActive(page, 'dep-gt', true);
    await expectActive(page, 'dep-eq', false);
    await expectActive(page, 'dep-le', false);

    await loadAnswers(page, 'dob', 'valueDate', '2024-06-15');
    await expectActive(page, 'dep-eq', true);
    await expectActive(page, 'dep-le', true);
    await expectActive(page, 'dep-gt', false);

    await loadAnswers(page, 'dob', 'valueDate', '2024-06-14');
    await expectActive(page, 'dep-le', true);
    await expectActive(page, 'dep-gt', false);
    await expectActive(page, 'dep-eq', false);
  });

  test('dateTime >= activates at/after the threshold and dims before it', async ({ page }) => {
    await loadFixture(page);
    await loadAnswers(page, 'appt', 'valueDateTime', '2024-06-15T11:00:00Z');
    await expectActive(page, 'dep-appt', true);
    await loadAnswers(page, 'appt', 'valueDateTime', '2024-06-15T09:00:00Z');
    await expectActive(page, 'dep-appt', false);
  });

  test('time >= activates at/after the threshold and dims before it', async ({ page }) => {
    await loadFixture(page);
    await loadAnswers(page, 'tm', 'valueTime', '11:30:00');
    await expectActive(page, 'dep-tm', true);
    await loadAnswers(page, 'tm', 'valueTime', '09:15:00');
    await expectActive(page, 'dep-tm', false);
  });
});
