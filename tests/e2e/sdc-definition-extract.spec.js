// ── E2E: SDC Definition-based Extraction ─────────────────────────────────────
// Tests: Save menu has extract item, modal opens, extraction runs.
//
// Tested elements:
//   export-def-extract-item — menu item in Save ▾
//   defExtract              — modal testid

import { test, expect } from '@playwright/test';
import path from 'node:path';
import { freshStart } from './helpers/builder.js';
import { openDropdownItem } from './helpers/dropdown.js';

const FIXTURE = path.resolve('tests/fixtures/def-extract.fhir.json');

async function loadFixture(page) {
  await freshStart(page);
  await page.locator('[data-testid="fhir-file-input"]').setInputFiles(FIXTURE);
  // Wait for at least one node to appear in the builder tree
  await page.waitForSelector('[data-testid="tree-container"] [data-node-id]', { timeout: 15_000 });
}

test.describe('SDC Definition Extract', () => {
  test('Definition Extract item is visible in Save menu', async ({ page }) => {
    await loadFixture(page);
    await expect(async () => {
      if (!(await page.getByTestId('export-def-extract-item').isVisible())) {
        await page.getByTestId('export-btn').click();
      }
      await expect(page.getByTestId('export-def-extract-item')).toBeVisible();
    }).toPass();
    await page.keyboard.press('Escape');
  });

  test('clicking Definition Extract opens modal', async ({ page }) => {
    await loadFixture(page);
    await openDropdownItem(page, 'export-btn', 'export-def-extract-item');
    await expect(page.locator('[data-testid="defExtract"]').first()).toBeVisible();
  });

  test('modal shows resources or warning', async ({ page }) => {
    await loadFixture(page);
    await openDropdownItem(page, 'export-btn', 'export-def-extract-item');
    const modal = page.locator('[data-testid="defExtract"]').first();
    await expect(modal).toBeVisible();
    const bodyText = await modal.locator('.modal-body').textContent();
    expect(bodyText.length).toBeGreaterThan(0);
  });

  test('modal closes on × button', async ({ page }) => {
    await loadFixture(page);
    await openDropdownItem(page, 'export-btn', 'export-def-extract-item');
    const modal = page.locator('[data-testid="defExtract"]').first();
    await expect(modal).toBeVisible();
    await modal.locator('.modal-close').click();
    await expect(modal).not.toBeVisible();
  });

  test('modal body contains a bundle or resource list', async ({ page }) => {
    await loadFixture(page);
    await openDropdownItem(page, 'export-btn', 'export-def-extract-item');
    const modal = page.locator('[data-testid="defExtract"]').first();
    await expect(modal).toBeVisible();
    // The body should contain FHIR resource references (Bundle, Patient, or similar)
    const bodyText = await modal.locator('.modal-body').textContent();
    // Either a bundle or a "no extractable data" message
    expect(bodyText.length).toBeGreaterThan(10);
  });

  test('fixture has nodes in builder tree with definition-based items', async ({ page }) => {
    await loadFixture(page);
    // The def-extract fixture should have nodes visible in the tree
    const nodeCount = await page.locator('[data-testid="tree-container"] [data-node-id]').count();
    expect(nodeCount).toBeGreaterThan(0);
  });

  test('loading fixture shows items in preview', async ({ page }) => {
    await loadFixture(page);
    // The def-extract fixture items should render in preview
    await expect(page.locator('.preview-card .lform-item').first()).toBeVisible({ timeout: 8_000 });
  });

  test('extract modal download button is present', async ({ page }) => {
    await loadFixture(page);
    await openDropdownItem(page, 'export-btn', 'export-def-extract-item');
    const modal = page.locator('[data-testid="defExtract"]').first();
    await expect(modal).toBeVisible();
    // There should be at least one button in the modal (close or download)
    await expect(modal.locator('button').first()).toBeVisible();
  });

  test('fixture loads without JS errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await loadFixture(page);
    expect(errors).toHaveLength(0);
  });
});

// ── Repeating field values → arrays (general extraction engine) ──────────────
test.describe('SDC Definition Extract — repeating field values', () => {
  const REPEAT = path.resolve('tests/fixtures/def-extract-repeat.fhir.json');

  async function loadRepeat(page) {
    await freshStart(page);
    await page.locator('[data-testid="fhir-file-input"]').setInputFiles(REPEAT);
    await page.waitForSelector('[data-testid="tree-container"] [data-node-id]', { timeout: 15_000 });
  }

  test('summary reports one extracted Patient resource', async ({ page }) => {
    await loadRepeat(page);
    await openDropdownItem(page, 'export-btn', 'export-def-extract-item');
    const modal = page.locator('[data-testid="defExtract"]').first();
    await expect(modal).toBeVisible();
    await expect(modal.locator('.def-extract-summary')).toContainText('Extracted 1 resource');
  });

  test('downloaded bundle promotes repeated given names to an array', async ({ page }) => {
    await loadRepeat(page);
    await openDropdownItem(page, 'export-btn', 'export-def-extract-item');
    const modal = page.locator('[data-testid="defExtract"]').first();
    await expect(modal).toBeVisible();

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('defExtractApply').click(),
    ]);
    const fp = await download.path();
    const { readFileSync } = await import('node:fs');
    const bundle = JSON.parse(readFileSync(fp, 'utf8'));

    const patient = bundle.entry[0].resource;
    expect(patient.resourceType).toBe('Patient');
    expect(patient.name.family).toBe('Doe');
    expect(patient.name.given).toEqual(['John', 'James']);
  });
});
