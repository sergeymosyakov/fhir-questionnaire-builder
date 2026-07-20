// ── E2E: validation error announcements (a11y aria-live) ─────────────────────
// Screen-reader announcements for validation state:
//   • inline control errors (.ctrl-err) are role="alert" / aria-live=assertive
//   • the PASS/FAIL status badge is an aria-live=polite region
//
// data-testid registry:
//   fhir-file-input     — questionnaire file input
//   preview-panel       — preview wrapper
//   status-badge-btn    — PASS/FAIL pill in the preview header
// Preview control classes (sanctioned non-testid exception): .ctrl-err
// ─────────────────────────────────────────────────────────────────────────────

import { test, expect } from '@playwright/test';
import path from 'node:path';
import { freshStart } from './helpers/builder.js';

const REF_FIXTURE    = path.resolve('tests/fixtures/reference-profile.fhir.json');
const CHECK_FIXTURE  = path.resolve('sampledata/annual-health-check.fhir.json');

async function load(page, fixture, previewId) {
  await freshStart(page);
  await page.locator('[data-testid="fhir-file-input"]').setInputFiles(fixture);
  await expect(page.locator(`[data-preview-id="${previewId}"]`)).toBeVisible({ timeout: 8_000 });
}

test.describe('validation aria-live', () => {
  test('inline control errors are assertive alert regions', async ({ page }) => {
    await load(page, REF_FIXTURE, 'q-def');
    const err = page.locator('[data-preview-id="q-def"] .ctrl-err').first();
    await expect(err).toHaveAttribute('role', 'alert');
    await expect(err).toHaveAttribute('aria-live', 'assertive');
  });

  test('status badge is a polite live region', async ({ page }) => {
    await load(page, CHECK_FIXTURE, 'height');
    const badge = page.getByTestId('status-badge-btn');
    await expect(badge).toBeVisible();
    await expect(badge).toHaveAttribute('aria-live', 'polite');
    await expect(badge).toHaveAttribute('aria-atomic', 'true');
  });
});
