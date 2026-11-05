// ── E2E: version handling and terminology lookups follow the specification ───
// Inline questionnaires are loaded through the hidden file input.
//
// ── data-testid registry ─────────────────────────────────────────────────────
//   fhir-file-input        hidden file <input> for Open → FHIR JSON
//   tools-btn / validate-item   Tools menu → Validate
//   validateModal / validateModalBody   validation / expansion report
// Preview controls (.oc-input) mirror the renderer and are selected by class.
// ─────────────────────────────────────────────────────────────────────────────

import { test, expect } from '@playwright/test';
import { loadFixtureFile } from './helpers/load-fixture.js';

const MARKER = { url: 'https://sergeymosyakov.github.io/fhir-questionnaire-builder/StructureDefinition/builder-target-version', valueCode: '5.0.0' };
const PROXY_HOST = 'fhir-cors-proxy.sergeymosyakov.workers.dev';
const opts = ['a', 'b'].map(code => ({ valueCoding: { system: 'http://example.org/s', code, display: code.toUpperCase() } }));

const payload = questionnaire => ({ name: 'inline.fhir.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ resourceType: 'Questionnaire', status: 'draft', title: 'Inline', ...questionnaire })) });

async function load(page, questionnaire, readyId) {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/');
  await page.waitForSelector('[data-testid="add-menu-btn"]', { timeout: 10_000 });
  await loadFixtureFile(page, payload(questionnaire));
  await expect(page.locator(`[data-preview-id="${readyId}"]`)).toBeVisible({ timeout: 10_000 });
}

test.describe('FHIR R5 documents', () => {
  test('an open-choice question carrying the version marker is still open-choice', async ({ page }) => {
    await load(page, {
      extension: [MARKER],
      item: [{ linkId: 'q', type: 'coding', text: 'Pick or type', answerConstraint: 'optionsOrString', answerOption: opts }],
    }, 'q');
    await expect(page.locator('[data-preview-id="q"] .oc-input').first()).toBeVisible();
  });
});

test.describe('Value sets', () => {
  test('a set cut off by the server is reported with the number of entries', async ({ page }) => {
    await page.route(url => url.hostname === PROXY_HOST, route => route.fulfill({
      status: 200,
      contentType: 'application/fhir+json',
      body: JSON.stringify({ resourceType: 'ValueSet', expansion: { total: 900, contains: [{ system: 'http://example.org/s', code: 'a', display: 'A' }] } }),
    }));
    await page.addInitScript(() => localStorage.clear());
    await page.goto('/');
    await page.waitForSelector('[data-testid="add-menu-btn"]', { timeout: 10_000 });
    await loadFixtureFile(page, payload({ item: [{ linkId: 'big', type: 'choice', text: 'Big', answerValueSet: 'http://example.org/ValueSet/big' }] }));
    await expect(page.getByTestId('validateModal')).toContainText('900 entries but only the first 1', { timeout: 10_000 });
  });

  test('a contained value set that filters a code system is reported as not expandable', async ({ page }) => {
    await load(page, {
      contained: [{ resourceType: 'ValueSet', id: 'vs', status: 'active', compose: { include: [{ system: 'http://example.org/s', filter: [{ property: 'p', op: '=', value: 'v' }] }] } }],
      item: [{ linkId: 'f', type: 'choice', text: 'Filtered', answerValueSet: '#vs' }],
    }, 'f');
    await page.getByTestId('tools-btn').click();
    await page.getByTestId('validate-item').click();
    await expect(page.getByTestId('validateModalBody')).toContainText('filters the concepts of http://example.org/s');
  });
});
