// ── E2E: Sample library modal (js/ui/modals/library-modal.js) ────────────────
// Open → "From Library…" lists grouped samples (sampledata/library.json), the
// focused group is expanded, headers toggle, a type filter limits the groups,
// and picking a sample loads it into the builder.
//
// Run: npx playwright test tests/e2e/library-modal.spec.js
//
// ── data-testid registry ─────────────────────────────────────────────────────
//   load-fhir-btn / load-library-item       Questionnaires ▾ trigger / "From Library…" item
//   libraryModal / libraryModalBody         library modal backdrop / body
//   libraryModalTitle / libraryModalCancel  modal title / "Close" button
//   lib-group-<id>                          group container (id from library.json)
//   lib-group-hdr-<id>                      clickable group header (expands/collapses)
//   lib-item-<groupId>-<index>              one sample row
//   tree-container                          builder tree (loaded questionnaire nodes)
// ─────────────────────────────────────────────────────────────────────────────

import { test, expect } from '@playwright/test';
import { freshStart } from './helpers/builder.js';
import { openDropdownItem } from './helpers/dropdown.js';

const firstItem = page => page.getByTestId('lib-item-fhir-r4-0');

async function openLibrary(page) {
  await openDropdownItem(page, 'load-fhir-btn', 'load-library-item');
  await expect(page.getByTestId('libraryModal')).toBeVisible();
  await expect(firstItem(page)).toBeVisible();
}

test.describe('Library modal', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
    await freshStart(page);
  });

  test('opens from the Questionnaires menu with the R4 group expanded', async ({ page }) => {
    await openLibrary(page);
    await expect(page.getByTestId('libraryModalTitle')).toHaveText('Load from Library');
    await expect(firstItem(page)).toContainText('Annual Health Check');
    // Other groups are listed but collapsed.
    await expect(page.getByTestId('lib-group-hdr-fhir-stu3')).toBeVisible();
    await expect(page.getByTestId('lib-item-fhir-stu3-0')).toBeHidden();
  });

  test('type filter keeps only questionnaire and StructureDefinition samples', async ({ page }) => {
    await openLibrary(page);
    await expect(page.getByTestId('lib-group-fhir-r4')).toBeVisible();
    await expect(page.getByTestId('lib-group-qr-responses')).toHaveCount(0);
    await expect(page.getByTestId('libraryModalBody').locator('[data-type="redcap"], [data-type="qr"]')).toHaveCount(0);
  });

  test('clicking a group header expands and collapses it', async ({ page }) => {
    await openLibrary(page);
    const stu3Item = page.getByTestId('lib-item-fhir-stu3-0');
    await page.getByTestId('lib-group-hdr-fhir-stu3').click();
    await expect(stu3Item).toBeVisible();
    await page.getByTestId('lib-group-hdr-fhir-stu3').click();
    await expect(stu3Item).toBeHidden();
  });

  test('Close dismisses the modal without loading anything', async ({ page }) => {
    await openLibrary(page);
    await page.getByTestId('libraryModalCancel').click();
    await expect(page.getByTestId('libraryModal')).toBeHidden();
    await expect(page.locator('[data-testid="tree-container"] [data-node-id]')).toHaveCount(0);
  });

  test('selecting a sample closes the modal and loads the questionnaire', async ({ page }) => {
    await openLibrary(page);
    await firstItem(page).click();
    await expect(page.getByTestId('libraryModal')).toBeHidden();
    await expect(page.locator('[data-testid="tree-container"] [data-node-id]').first()).toBeVisible();
    await expect(page.locator('[data-testid="preview-panel"] [data-preview-id]').first()).toBeVisible();
  });
});
