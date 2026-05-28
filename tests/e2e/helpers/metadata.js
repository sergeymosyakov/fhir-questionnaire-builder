// Shared page helpers for metadata e2e specs.
// Imported by: metadata-card, metadata-core, metadata-codes,
//              metadata-resource-meta, metadata-identifiers,
//              metadata-narrative-replaces.

import path from 'node:path';
import { expect } from '@playwright/test';

export const FIXTURE = path.resolve('tests/fixtures/meta-test.fhir.json');

export async function waitForLoad(page) {
  await page.waitForSelector('[data-testid="add-root-group-btn"]', { timeout: 10_000 });
}

export async function freshStart(page) {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/');
  await waitForLoad(page);
}

export async function loadFixture(page) {
  await freshStart(page);
  await page.locator('[data-testid="fhir-file-input"]').setInputFiles(FIXTURE);
  await expect(page.getByTestId('quest-meta-card')).toBeVisible({ timeout: 8_000 });
}

export async function openModal(page) {
  await page.getByTestId('properties-btn').click();
  await expect(page.locator('[data-testid="metadataModal"]')).toBeVisible();
}

export async function exportFHIR(page) {
  await page.getByTestId('export-btn').click();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('export-fhir-item').click().then(() => page.getByTestId('prompt-save').click()),
  ]);
  const fp = await download.path();
  const { readFileSync } = await import('node:fs');
  return JSON.parse(readFileSync(fp, 'utf8'));
}
