// ── E2E: SDC $populate button ─────────────────────────────────────────────────
// Tests: button hidden/visible, modal opens with patient input,
// populate dispatches event, error handling.
//
// Tested elements:
//   sdc-populate-btn            — populate button in preview toolbar
//   sdc-populate-patient-ref-input — patient ref input in modal

import { test, expect } from '@playwright/test';
import { freshStart } from './helpers/builder.js';
import { openDropdownItem } from './helpers/dropdown.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

async function setFhirBaseUrl(page, url) {
  await page.addInitScript(u => localStorage.setItem('fhirqb.server.fhirBaseUrl', u), url);
}

async function clearFhirBaseUrl(page) {
  await page.addInitScript(() => localStorage.removeItem('fhirqb.server.fhirBaseUrl'));
}

async function loadBariatric(page) {
  await openDropdownItem(page, 'load-fhir-btn', 'load-library-item');
  await page.locator('[data-sample="example-bariatric.fhir.json"]').waitFor({ timeout: 10_000 });
  await page.click('[data-sample="example-bariatric.fhir.json"]');
  await page.waitForFunction(
    () => document.querySelector('[data-mount="progress-wrap"]')?.style.display === 'none',
    { timeout: 20_000 }
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe('SDC $populate button', () => {
  test.beforeEach(async ({ page }) => {
    await clearFhirBaseUrl(page);
  });

  test('populate item hidden in Answers menu when no FHIR base server configured', async ({ page }) => {
    await freshStart(page);
    await loadBariatric(page);
    // Open Answers menu — populate item should not be visible
    await page.getByTestId('answers-btn').click();
    await expect(page.getByTestId('sdc-populate-btn')).toBeHidden();
    await page.keyboard.press('Escape');
  });

  test('populate item hidden when no questionnaire loaded', async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
    await setFhirBaseUrl(page, 'https://hapi.fhir.org/baseR4');
    await page.goto('/');
    await page.waitForSelector('[data-testid="add-root-group-btn"]');
    // No questionnaire — Answers menu itself should be hidden (tree empty)
    await expect(page.getByTestId('answers-btn')).toBeHidden();
  });

  test('populate item visible in Answers menu when fhirBaseUrl set and questionnaire loaded', async ({ page }) => {
    await setFhirBaseUrl(page, 'https://hapi.fhir.org/baseR4');
    await page.goto('/');
    await page.waitForSelector('[data-testid="add-root-group-btn"]');
    await loadBariatric(page);
    await page.getByTestId('answers-btn').click();
    await expect(page.getByTestId('sdc-populate-btn')).toBeVisible();
    await page.keyboard.press('Escape');
  });

  test('clicking populate button opens modal with patient ref input', async ({ page }) => {
    await setFhirBaseUrl(page, 'https://hapi.fhir.org/baseR4');
    await page.goto('/');
    await page.waitForSelector('[data-testid="add-root-group-btn"]');
    await loadBariatric(page);

    await openDropdownItem(page, 'answers-btn', 'sdc-populate-btn');

    // Modal should open
    const input = page.getByTestId('sdc-populate-patient-ref-input');
    await expect(input).toBeVisible();
    // Input starts empty (search field, no pre-fill)
  });

  test('modal cancel closes without dispatching event', async ({ page }) => {
    await setFhirBaseUrl(page, 'https://hapi.fhir.org/baseR4');
    await page.goto('/');
    await page.waitForSelector('[data-testid="add-root-group-btn"]');
    await loadBariatric(page);

    await page.evaluate(() => {
      document.addEventListener('sdc:populate-requested', () => { window.__populateFired = true; }, { once: true });
    });

    await openDropdownItem(page, 'answers-btn', 'sdc-populate-btn');
    await page.getByTestId('sdc-populate-patient-ref-input').waitFor();

    // Press Escape to cancel
    await page.keyboard.press('Escape');

    const fired = await page.evaluate(() => window.__populateFired ?? false);
    expect(fired).toBe(false);
  });

  test('Apply dispatches SDC_POPULATE_REQUESTED with patientRef', async ({ page }) => {
    await setFhirBaseUrl(page, 'https://hapi.fhir.org/baseR4');
    await page.goto('/');
    await page.waitForSelector('[data-testid="add-root-group-btn"]');
    await loadBariatric(page);

    await page.evaluate(() => {
      document.addEventListener('sdc:populate-requested', e => {
        window.__populateDetail = e.detail;
      }, { once: true });
    });

    await openDropdownItem(page, 'answers-btn', 'sdc-populate-btn');
    const input = page.getByTestId('sdc-populate-patient-ref-input');
    await input.fill('Patient/test-123');
    await page.locator('[data-testid="sdcPopulate"] .modal-btn--apply').click();

    const detail = await page.evaluate(() => window.__populateDetail);
    expect(detail?.patientRef).toBe('Patient/test-123');
  });

  test('bare ID auto-prefixes with Patient/', async ({ page }) => {
    await setFhirBaseUrl(page, 'https://hapi.fhir.org/baseR4');
    await page.goto('/');
    await page.waitForSelector('[data-testid="add-root-group-btn"]');
    await loadBariatric(page);

    await page.evaluate(() => {
      document.addEventListener('sdc:populate-requested', e => {
        window.__populateDetail = e.detail;
      }, { once: true });
    });

    await openDropdownItem(page, 'answers-btn', 'sdc-populate-btn');
    const input = page.getByTestId('sdc-populate-patient-ref-input');
    await input.fill('98765');
    await page.locator('[data-testid="sdcPopulate"] .modal-btn--apply').click();

    const detail = await page.evaluate(() => window.__populateDetail);
    expect(detail?.patientRef).toBe('Patient/98765');
  });
});
