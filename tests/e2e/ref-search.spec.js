// ── E2E: Reference search autocomplete (js/ui/ref-search.js) ─────────────────
// Driven through the "Fill from FHIR Server…" modal, whose patient field uses
// createRefSearchAutocomplete. The FHIR base is hapi.fhir.org (a known
// CORS-enabled host, so no proxy) and every request is mocked with page.route.
//
// Run: npx playwright test tests/e2e/ref-search.spec.js
//
// ── data-testid registry ─────────────────────────────────────────────────────
//   add-root-group-btn              app-ready marker
//   fhir-file-input                 hidden file input used to load the fixture
//   answers-btn / sdc-populate-btn  Answers menu toggle / "Fill from FHIR Server…" item
//   sdc-populate-patient-ref-input  patient search input inside the populate modal
//   ref-search-drop                 results dropdown (appended to <body>; one per populate modal)
//   ref-search-item                 one result row (name + id)
//   ref-search-empty                "No results" / "Type to search" message
//   ref-search-error                error message when the search request fails
// ─────────────────────────────────────────────────────────────────────────────

import path from 'node:path';
import { test, expect } from '@playwright/test';
import { openDropdownItem } from './helpers/dropdown.js';

const FIXTURE = path.resolve('tests/fixtures/obs-extract-e2e.fhir.json');
const FHIR_BASE = 'https://hapi.fhir.org/baseR4';
const PATIENT_URL = `${FHIR_BASE}/Patient?*`;

const bundle = patients => ({
  resourceType: 'Bundle',
  type: 'searchset',
  entry: patients.map(p => ({ resource: { resourceType: 'Patient', ...p } })),
});

const SMITHS = [
  { id: 'p1', name: [{ family: 'Smith', given: ['Anna'] }] },
  { id: 'p2', name: [{ family: 'Smythe', given: ['Bob'] }] },
];

async function openPopulateModal(page) {
  await page.addInitScript(base => {
    localStorage.clear();
    localStorage.setItem('fhirqb.server.fhirBaseUrl', base);
  }, FHIR_BASE);
  await page.goto('/');
  await expect(page.getByTestId('add-root-group-btn')).toBeVisible();
  await page.getByTestId('fhir-file-input').setInputFiles(FIXTURE);
  await expect(page.locator('[data-preview-id="vitals"]')).toBeVisible();
  await openDropdownItem(page, 'answers-btn', 'sdc-populate-btn');
  await expect(page.getByTestId('sdc-populate-patient-ref-input')).toBeVisible();
}

test.describe('Reference search autocomplete', () => {
  test('typing queries the server and lists the matching resources', async ({ page }) => {
    const requests = [];
    await page.route(PATIENT_URL, route => {
      requests.push(route.request().url());
      return route.fulfill({ json: bundle(SMITHS) });
    });
    await openPopulateModal(page);

    await page.getByTestId('sdc-populate-patient-ref-input').fill('Smi');
    const items = page.getByTestId('ref-search-item');
    await expect(items).toHaveCount(2);
    await expect(items.nth(0)).toContainText('Smith, Anna');
    await expect(items.nth(0)).toContainText('p1');
    await expect(items.nth(1)).toContainText('Smythe, Bob');

    const params = new URL(requests[0]).searchParams;
    expect(params.get('name')).toBe('Smi');
    expect(params.get('_count')).toBe('10');
  });

  test('picking a result fills the input and closes the dropdown', async ({ page }) => {
    await page.route(PATIENT_URL, route => route.fulfill({ json: bundle(SMITHS) }));
    await openPopulateModal(page);

    const input = page.getByTestId('sdc-populate-patient-ref-input');
    await input.fill('Smi');
    await page.getByTestId('ref-search-item').nth(1).click();
    await expect(input).toHaveValue('Smythe, Bob (p2)');
    await expect(page.getByTestId('ref-search-item')).toHaveCount(2);
    await expect(page.getByTestId('ref-search-item').first()).toBeHidden();
  });

  test('shows "No results" for an empty searchset', async ({ page }) => {
    await page.route(PATIENT_URL, route => route.fulfill({ json: bundle([]) }));
    await openPopulateModal(page);

    await page.getByTestId('sdc-populate-patient-ref-input').fill('Nobody');
    await expect(page.getByTestId('ref-search-empty')).toHaveText('No results');
    await expect(page.getByTestId('ref-search-item')).toHaveCount(0);
  });

  test('shows the server error message when the search fails', async ({ page }) => {
    await page.route(PATIENT_URL, route => route.fulfill({
      status: 500,
      json: { resourceType: 'OperationOutcome', issue: [{ diagnostics: 'boom' }] },
    }));
    await openPopulateModal(page);

    await page.getByTestId('sdc-populate-patient-ref-input').fill('Smi');
    await expect(page.getByTestId('ref-search-error')).toContainText('HTTP 500');
    await expect(page.getByTestId('ref-search-error')).toContainText('boom');
  });

  test('clearing the input closes the dropdown', async ({ page }) => {
    await page.route(PATIENT_URL, route => route.fulfill({ json: bundle(SMITHS) }));
    await openPopulateModal(page);

    const input = page.getByTestId('sdc-populate-patient-ref-input');
    await input.fill('Smi');
    await expect(page.getByTestId('ref-search-item').first()).toBeVisible();
    await input.fill('');
    await expect(page.getByTestId('ref-search-item').first()).toBeHidden();
  });
});
