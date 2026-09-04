// ── E2E: Questionnaire Documentation generator (issue #95) ────────────────────
// Tests: Save menu has Generate Docs item, opens questionnaire-docs.html in a
// new tab, key sections render, Print and Download-as-text buttons work.
//
// Tested elements:
//   generate-docs-item — menu item in Save ▾
//   qdoc-root, qdoc-title, qdoc-legend, qdoc-metadata, qdoc-variables, qdoc-contained,
//   qdoc-structure, qdoc-validation — sections
//   qdoc-print-btn, qdoc-download-btn — action buttons
//   qdoc-code — expression/JSON code blocks

import { test, expect } from '@playwright/test';
import path from 'node:path';
import { freshStart } from './helpers/builder.js';
import { openDropdownItem } from './helpers/dropdown.js';

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
