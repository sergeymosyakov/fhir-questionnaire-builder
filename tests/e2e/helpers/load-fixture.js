// Shared fhir-file-input loader for e2e specs.
//
// Sets the file on the hidden input. The load-confirm modal only appears when
// the builder already holds content, so callers that know it will open pass
// expectConfirm: true and the helper accepts it; otherwise no modal is awaited.

import { expect } from '@playwright/test';

/** @param file path string or { name, mimeType, buffer } payload */
export async function loadFixtureFile(page, file, { expectConfirm = false } = {}) {
  await page.getByTestId('fhir-file-input').setInputFiles(file);
  if (expectConfirm) {
    await expect(page.getByTestId('loadConfirmModal')).toBeVisible();
    await page.getByTestId('load-confirm-proceed-btn').click();
  }
}
