// ── E2E: minLength / regex validation in the preview ──────────────────────────
// An optional text item with minLength / regex must show the invalid state in
// both the inline error and the ✓/✗ completion icon; a valid value clears it.
// A mandatory item with minLength also drives the PASS/FAIL status badge.
//
// Fixture: tests/fixtures/preview-validation-length-regex.fhir.json
//   opt-min    optional text, minLength 5
//   opt-regex  optional text, regex ^[0-9]+$
//   req-min    required text, minLength 5
//
// Run: npx playwright test tests/e2e/preview-validation-length-regex.spec.js
//
// ── data-testid registry ─────────────────────────────────────────────────────
//   fhir-file-input      hidden file <input> for Open → FHIR JSON
//   preview-search-input preview search <input> (focus target to commit a value)
//   minlength-err        inline "Min N chars" error under a text control
//   regex-err            inline "Does not match pattern" error under a text control
//   status-badge-btn     PASS/FAIL pill in the preview header
// ─────────────────────────────────────────────────────────────────────────────

import path from 'node:path';
import { test, expect } from '@playwright/test';
import { freshStart } from './helpers/builder.js';

const FIXTURE = path.resolve('tests/fixtures/preview-validation-length-regex.fhir.json');

async function loadFixture(page) {
  await freshStart(page);
  await page.getByTestId('fhir-file-input').setInputFiles(FIXTURE);
  await expect(page.locator('[data-preview-id="opt-min"]')).toBeVisible({ timeout: 8_000 });
}

async function commitInput(page) {
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  await page.getByTestId('preview-search-input').click();
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
}

async function enter(page, id, value) {
  const ta = page.locator(`[data-preview-id="${id}"] textarea`);
  await ta.fill(value);
  await commitInput(page);
}

const item = (page, id) => page.locator(`[data-preview-id="${id}"]`);

test.describe('Optional text — minLength', () => {
  test('too-short value shows the error and the fail icon; long enough is ok', async ({ page }) => {
    await loadFixture(page);
    await enter(page, 'opt-min', 'abc');
    await expect(item(page, 'opt-min').getByTestId('minlength-err')).toBeVisible();
    await expect(item(page, 'opt-min').locator('.icon-fail')).toBeVisible();
    await expect(item(page, 'opt-min').locator('.icon-ok')).not.toBeVisible();

    await enter(page, 'opt-min', 'abcdef');
    await expect(item(page, 'opt-min').getByTestId('minlength-err')).not.toBeVisible();
    await expect(item(page, 'opt-min').locator('.icon-ok')).toBeVisible();
    await expect(item(page, 'opt-min').locator('.icon-fail')).not.toBeVisible();
  });

  test('clearing the value returns an optional item to ok', async ({ page }) => {
    await loadFixture(page);
    await enter(page, 'opt-min', 'abc');
    await expect(item(page, 'opt-min').locator('.icon-fail')).toBeVisible();
    await enter(page, 'opt-min', '');
    await expect(item(page, 'opt-min').locator('.icon-fail')).not.toBeVisible();
    await expect(item(page, 'opt-min').locator('.icon-ok')).toBeVisible();
  });
});

test.describe('Optional text — regex', () => {
  test('non-matching value shows the error and the fail icon; matching is ok', async ({ page }) => {
    await loadFixture(page);
    await enter(page, 'opt-regex', 'abc');
    await expect(item(page, 'opt-regex').getByTestId('regex-err')).toBeVisible();
    await expect(item(page, 'opt-regex').locator('.icon-fail')).toBeVisible();

    await enter(page, 'opt-regex', '12345');
    await expect(item(page, 'opt-regex').getByTestId('regex-err')).not.toBeVisible();
    await expect(item(page, 'opt-regex').locator('.icon-ok')).toBeVisible();
    await expect(item(page, 'opt-regex').locator('.icon-fail')).not.toBeVisible();
  });
});

test.describe('Mandatory text — minLength', () => {
  test('too-short fails icon and badge; valid value passes both', async ({ page }) => {
    await loadFixture(page);
    await enter(page, 'req-min', 'abc');
    await expect(item(page, 'req-min').locator('.icon-fail')).toBeVisible();
    await expect(page.getByTestId('status-badge-btn')).toContainText('FAIL');

    await enter(page, 'req-min', 'abcdef');
    await expect(item(page, 'req-min').locator('.icon-fail')).not.toBeVisible();
    await expect(item(page, 'req-min').locator('.icon-ok')).toBeVisible();
    // opt-min / opt-regex are empty so they do not block the badge
    await expect(page.getByTestId('status-badge-btn')).toContainText('PASS');
  });
});
