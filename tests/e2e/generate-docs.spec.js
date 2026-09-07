// ── E2E: Questionnaire Documentation generator (issue #95) ────────────────────
// Tests: Save menu has Generate Docs item, opens questionnaire-docs.html in a
// new tab, key sections render, Print and Download-as-text buttons work.
// Also covers issue #111 (extended item/metadata field completeness).
//
// Tested elements:
//   generate-docs-item — menu item in Save ▾
//   qdoc-root, qdoc-title, qdoc-legend, qdoc-metadata, qdoc-variables, qdoc-contained,
//   qdoc-structure, qdoc-validation — sections
//   qdoc-item-<linkId> — per-item report block
//   qdoc-print-btn, qdoc-download-btn — action buttons
//   qdoc-code — expression/JSON code blocks

import { test, expect } from '@playwright/test';
import path from 'node:path';
import { freshStart } from './helpers/builder.js';
import { openDropdownItem } from './helpers/dropdown.js';
import { mockTerminologyExpand } from './helpers/terminology.js';

const FIXTURE = path.resolve('tests/fixtures/example-bariatric.fhir.json');

async function loadFixture(page) {
  await freshStart(page);
  await page.locator('[data-testid="fhir-file-input"]').setInputFiles(FIXTURE);
  await page.waitForSelector('[data-testid="tree-container"] [data-node-id]', { timeout: 15_000 });
}

async function openDocsPage(page) {
  const [docsPage] = await Promise.all([
    page.context().waitForEvent('page'),
    openDropdownItem(page, 'export-btn', 'generate-docs-item'),
  ]);
  await docsPage.waitForLoadState('domcontentloaded');
  return docsPage;
}

test.describe('Questionnaire Documentation generator', () => {
  test('Generate Docs item is visible in Save menu', async ({ page }) => {
    await loadFixture(page);
    await expect(async () => {
      if (!(await page.getByTestId('generate-docs-item').isVisible())) {
        await page.getByTestId('export-btn').click();
      }
      await expect(page.getByTestId('generate-docs-item')).toBeVisible();
    }).toPass();
    await page.keyboard.press('Escape');
  });

  test('clicking Generate Docs opens the documentation page in a new tab', async ({ page }) => {
    await loadFixture(page);
    const docsPage = await openDocsPage(page);
    expect(docsPage.url()).toContain('questionnaire-docs');
    await expect(docsPage.getByTestId('qdoc-root')).toBeVisible();
    await docsPage.close();
  });

  test('documentation page renders all six sections and the questionnaire title', async ({ page }) => {
    await loadFixture(page);
    const docsPage = await openDocsPage(page);
    await expect(docsPage.getByTestId('qdoc-title')).not.toBeEmpty();
    await expect(docsPage.getByTestId('qdoc-legend')).toBeVisible();
    await expect(docsPage.getByTestId('qdoc-metadata')).toBeVisible();
    await expect(docsPage.getByTestId('qdoc-variables')).toBeVisible();
    await expect(docsPage.getByTestId('qdoc-contained')).toBeVisible();
    await expect(docsPage.getByTestId('qdoc-structure')).toBeVisible();
    await expect(docsPage.getByTestId('qdoc-validation')).toBeVisible();
    await docsPage.close();
  });

  test('Variables section shows the SDC variable as formatted JSON', async ({ page }) => {
    await loadFixture(page);
    const docsPage = await openDocsPage(page);
    const section = docsPage.getByTestId('qdoc-variables').locator('xpath=following-sibling::*[1]');
    await expect(section).toContainText('"name": "bmi"');
    await expect(section).toContainText('"expression": "%patient.weight');
    await docsPage.close();
  });

  test('Contained Resources section labels and JSON-formats the contained ValueSet', async ({ page }) => {
    await loadFixture(page);
    const docsPage = await openDocsPage(page);
    await expect(docsPage.getByText('ValueSet/bmi-criteria-vs')).toBeVisible();
    const section = docsPage.getByTestId('qdoc-contained').locator('xpath=following-sibling::*[1]');
    await expect(section).toContainText('"resourceType": "ValueSet"');
    await docsPage.close();
  });

  test('an item bound to a local #contained ValueSet names it and links to Contained Resources', async ({ page }) => {
    await loadFixture(page);
    const docsPage = await openDocsPage(page);
    const link = docsPage.getByRole('link', { name: 'USSG Family Health History' });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', '#qdoc-contained-ussg-fhh');
    await expect(docsPage.locator('#qdoc-contained-ussg-fhh')).toHaveText('ValueSet/ussg-fhh');
    await docsPage.close();
  });

  test('an item with a dynamic answerExpression shows the computed-options label and raw FHIRPath', async ({ page }) => {
    await loadFixture(page);
    const docsPage = await openDocsPage(page);
    await expect(docsPage.getByText(/Answer options \(computed dynamically via answerExpression\)/)).toBeVisible();
    await expect(docsPage.getByText(/q-bmi-criterion/).first()).toBeVisible();
    await docsPage.close();
  });

  test('shortText and openLabel appear in the extended properties list', async ({ page }) => {
    await loadFixture(page);
    const docsPage = await openDocsPage(page);
    await expect(docsPage.getByText('Short text: Family Hx')).toBeVisible();
    await expect(docsPage.getByText('Open label: Other condition, please specify')).toBeVisible();
    await docsPage.close();
  });

  test('an item with rendering-xhtml shows the Appearance note and the raw xhtml source verbatim', async ({ page }) => {
    await loadFixture(page);
    const docsPage = await openDocsPage(page);
    await expect(docsPage.getByText(/Appearance: custom XHTML formatting/)).toBeVisible();
    await expect(docsPage.getByText('<div xmlns="http://www.w3.org/1999/xhtml">Please review <b>before</b> proceeding.</div>')).toBeVisible();
    await docsPage.close();
  });

  test('a hidden item shows the Hidden flag and its design note', async ({ page }) => {
    await loadFixture(page);
    const docsPage = await openDocsPage(page);
    await expect(docsPage.getByTestId('qdoc-item-q-hidden-audit-marker')).toContainText('\uD83D\uDE48');
    await expect(docsPage.getByText(/Design note: Internal use only/)).toBeVisible();
    await docsPage.close();
  });

  test('documentation page shows a visibility condition in plain English', async ({ page }) => {
    await loadFixture(page);
    const docsPage = await openDocsPage(page);
    await expect(docsPage.getByText(/This item is shown only when this condition is true/).first()).toBeVisible();
    await docsPage.close();
  });

  test('documentation page shows a constraint with its human-readable text', async ({ page }) => {
    await loadFixture(page);
    const docsPage = await openDocsPage(page);
    await expect(docsPage.getByText(/Constraint \[/).first()).toBeVisible();
    await docsPage.close();
  });

  test('expressions render in a monospace code block', async ({ page }) => {
    await loadFixture(page);
    const docsPage = await openDocsPage(page);
    await expect(docsPage.getByTestId('qdoc-code').first()).toBeVisible();
    await docsPage.close();
  });

  test('Print button is present and Download as Text triggers a .txt download', async ({ page }) => {
    await loadFixture(page);
    const docsPage = await openDocsPage(page);
    await expect(docsPage.getByTestId('qdoc-print-btn')).toBeVisible();

    const [download] = await Promise.all([
      docsPage.waitForEvent('download'),
      docsPage.getByTestId('qdoc-download-btn').click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/-documentation\.txt$/);
    await docsPage.close();
  });
});

// ── Coverage for issue #111: fields previously missing from the report ────────
test.describe('Questionnaire Documentation generator — extended field coverage', () => {
  const COMPLETENESS_FIXTURE = path.resolve('tests/fixtures/generate-docs-completeness.fhir.json');

  // item-quantity's unitValueSet is external - mockTerminologyExpand() keeps
  // import from racing a real network round-trip (see helpers/terminology.js).
  async function loadCompletenessFixture(page) {
    await mockTerminologyExpand(page);
    await freshStart(page);
    await page.locator('[data-testid="fhir-file-input"]').setInputFiles(COMPLETENESS_FIXTURE);
    await page.waitForSelector('[data-testid="tree-container"] [data-node-id]', { timeout: 15_000 });
  }

  test('item-level fields: regex, terminology server, definition/baseType/fhirType, usage mode, signature, support link, custom extension', async ({ page }) => {
    await loadCompletenessFixture(page);
    const docsPage = await openDocsPage(page);
    const item = docsPage.getByTestId('qdoc-item-item-multi');
    await expect(item).toContainText('Regex pattern: ^[A-Z]{2}\\d{4}$');
    await expect(item).toContainText('Preferred terminology server: https://tx.example.org/fhir');
    await expect(item).toContainText('Definition: http://hl7.org/fhir/StructureDefinition/Patient#Patient.birthDate');
    await expect(item).toContainText('Base type: Patient');
    await expect(item).toContainText('FHIR type: date');
    await expect(item).toContainText('Usage mode: capture-display');
    await expect(item).toContainText("Signature required: Author's Signature");
    await expect(item).toContainText('Support links: https://example.org/help/item-multi');
    await expect(item).toContainText('Other extensions: 1 preserved (round-trip only)');
    await docsPage.close();
  });

  test('item-level fields: min/max value and slider step', async ({ page }) => {
    await loadCompletenessFixture(page);
    const docsPage = await openDocsPage(page);
    const item = docsPage.getByTestId('qdoc-item-item-integer');
    await expect(item).toContainText('Min value: 0');
    await expect(item).toContainText('Max value: 100');
    await expect(item).toContainText('Slider step: 5');
    await docsPage.close();
  });

  test('item-level fields: choice orientation and initially-selected option', async ({ page }) => {
    await loadCompletenessFixture(page);
    const docsPage = await openDocsPage(page);
    const item = docsPage.getByTestId('qdoc-item-item-choice');
    await expect(item).toContainText('Choice orientation: horizontal');
    await expect(item).toContainText('y = Yes (initially selected)');
    await docsPage.close();
  });

  test('item-level fields: display category', async ({ page }) => {
    await loadCompletenessFixture(page);
    const docsPage = await openDocsPage(page);
    await expect(docsPage.getByTestId('qdoc-item-item-display')).toContainText('Display category: instructions');
    await docsPage.close();
  });

  test('item-level fields: attachment max size and allowed file types', async ({ page }) => {
    await loadCompletenessFixture(page);
    const docsPage = await openDocsPage(page);
    const item = docsPage.getByTestId('qdoc-item-item-attachment');
    await expect(item).toContainText('Max file size (MB): 5');
    await expect(item).toContainText('Allowed file types: image/png, application/pdf');
    await docsPage.close();
  });

  test('item-level fields: reference resource type, profile, and filter', async ({ page }) => {
    await loadCompletenessFixture(page);
    const docsPage = await openDocsPage(page);
    const item = docsPage.getByTestId('qdoc-item-item-reference');
    await expect(item).toContainText('Reference resource type: Practitioner');
    await expect(item).toContainText('Reference profiles: http://example.org/fhir/StructureDefinition/my-practitioner');
    await expect(item).toContainText('Reference filter: active=true');
    await docsPage.close();
  });

  test('item-level fields: quantity unit and unit ValueSet', async ({ page }) => {
    await loadCompletenessFixture(page);
    const docsPage = await openDocsPage(page);
    const item = docsPage.getByTestId('qdoc-item-item-quantity');
    await expect(item).toContainText('Unit: kg');
    await expect(item).toContainText('Unit options: kg');
    await expect(item).toContainText('Unit ValueSet: http://example.org/fhir/ValueSet/weight-units');
    await docsPage.close();
  });

  test('questionnaire-level metadata: identifiers, codes, derived from, replaces, resource meta, tags, security', async ({ page }) => {
    await loadCompletenessFixture(page);
    const docsPage = await openDocsPage(page);
    const meta = docsPage.getByTestId('qdoc-metadata').locator('xpath=following-sibling::*[1]');
    await expect(meta).toContainText('Identifiers: GDOC-001');
    await expect(meta).toContainText('Codes: http://loinc.org|12345-6');
    await expect(meta).toContainText('Derived from: http://example.org/Questionnaire/v1');
    await expect(meta).toContainText('Replaces: http://example.org/Questionnaire/old');
    await expect(meta).toContainText('Resource version: 3');
    await expect(meta).toContainText('Resource source: http://example.org/source-system');
    await expect(meta).toContainText('Tags: Demo tag');
    await expect(meta).toContainText('Security labels: Restricted');
    await docsPage.close();
  });

  test('questionnaire-level metadata: terminology server, structure maps, launch context, signature', async ({ page }) => {
    await loadCompletenessFixture(page);
    const docsPage = await openDocsPage(page);
    const meta = docsPage.getByTestId('qdoc-metadata').locator('xpath=following-sibling::*[1]');
    await expect(meta).toContainText('Preferred terminology server: https://tx.example.org/fhir');
    await expect(meta).toContainText('Target StructureMap: http://example.org/StructureMap/target');
    await expect(meta).toContainText('Source StructureMap: http://example.org/StructureMap/source');
    await expect(meta).toContainText('Launch context: patient');
    await expect(meta).toContainText("Signature required: Author's Signature");
    await docsPage.close();
  });

  test('Download as Text includes the same extended fields as the HTML report', async ({ page }) => {
    await loadCompletenessFixture(page);
    const docsPage = await openDocsPage(page);
    const [download] = await Promise.all([
      docsPage.waitForEvent('download'),
      docsPage.getByTestId('qdoc-download-btn').click(),
    ]);
    const streamPath = await download.path();
    const fs = await import('node:fs');
    const text = fs.readFileSync(streamPath, 'utf-8');
    expect(text).toContain('Regex pattern: ^[A-Z]{2}\\d{4}$');
    expect(text).toContain('Min value: 0');
    expect(text).toContain('Choice orientation: horizontal');
    expect(text).toContain('Derived from: http://example.org/Questionnaire/v1');
    await docsPage.close();
  });
});
