// ── E2E: Contained Resources & Answer ValueSet panels ─────────────────────────
// Tests for the two read-only info cards that appear when an imported
// questionnaire carries Questionnaire.contained[] resources or items that use
// answerValueSet. Both cards share a single JSON-viewer modal (fhirJsonModal).
//
// Run: npx playwright test tests/e2e/contained-panel.spec.js
//
// ── data-testid registry ────────────────────────────────────────────────────
//   contained-card / -toggle / -chips / -count                  Contained Resources card + parts
//   answer-value-set-card / -toggle / -chips / -count          Answer ValueSet card + parts
//   fhirJsonModal / Title / Pre / Close / CloseBtn             read-only JSON viewer modal
//   clear-form-btn, clear-confirm-clear-btn                    clear-form flow
//   add-root-group-btn                                         builder-ready marker
// ────────────────────────────────────────────────────────────────────────────

import path from 'node:path';
import { test, expect } from '@playwright/test';
import { loadFixtureFile } from './helpers/load-fixture.js';
import { mockTerminologyExpand } from './helpers/terminology.js';

const FIXTURE = path.resolve('tests/fixtures/contained-valueset.fhir.json');

// ── Helpers ───────────────────────────────────────────────────────────────────

async function waitForLoad(page) {
  await page.waitForSelector('[data-testid="add-root-group-btn"]', { timeout: 10_000 });
}

async function freshStart(page) {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/');
  await waitForLoad(page);
}

/** Load the contained-valueset fixture; its external answerValueSet expansion is mocked so no error modal opens. */
async function loadFixture(page) {
  await mockTerminologyExpand(page);
  await loadFixtureFile(page, FIXTURE);
  await expect(page.locator('[data-node-id]').first()).toBeVisible({ timeout: 8_000 });
}

const containedCard      = (page) => page.getByTestId('contained-card');
const containedChips     = (page) => page.getByTestId('contained-card-chips');
const containedCount     = (page) => page.getByTestId('contained-card-count');
const containedToggle    = (page) => page.getByTestId('contained-card-toggle');

const avsCard            = (page) => page.getByTestId('answer-value-set-card');
const avsChips           = (page) => page.getByTestId('answer-value-set-card-chips');
const avsCount           = (page) => page.getByTestId('answer-value-set-card-count');

const jsonModal          = (page) => page.locator('[data-testid="fhirJsonModal"]');
const jsonModalTitle     = (page) => page.locator('[data-testid="fhirJsonModalTitle"]');
const jsonModalPre       = (page) => page.locator('[data-testid="fhirJsonModalPre"]');
const jsonModalClose     = (page) => page.locator('[data-testid="fhirJsonModalClose"]');
const jsonModalCloseBtn  = (page) => page.locator('[data-testid="fhirJsonModalCloseBtn"]');

// ── Contained Resources card ──────────────────────────────────────────────────

test.describe('Contained Resources card', () => {
  test('hidden before questionnaire loaded', async ({ page }) => {
    await freshStart(page);
    await expect(containedCard(page)).not.toBeVisible();
  });

  test('visible after loading fixture with contained resources', async ({ page }) => {
    await freshStart(page);
    await loadFixture(page);
    await expect(containedCard(page)).toBeVisible();
  });

  test('shows correct resource count (2)', async ({ page }) => {
    await freshStart(page);
    await loadFixture(page);
    await expect(containedCount(page)).toHaveText('2');
  });

  test('shows chip for each contained resource', async ({ page }) => {
    await freshStart(page);
    await loadFixture(page);
    await expect(containedChips(page)).toContainText('ValueSet/vs-diet');
    await expect(containedChips(page)).toContainText('CodeSystem/cs-assessment');
  });

  test('click chip opens JSON viewer modal', async ({ page }) => {
    await freshStart(page);
    await loadFixture(page);
    await containedChips(page).locator('button').first().click();
    await expect(jsonModal(page)).toBeVisible();
  });

  test('modal pre shows resource JSON content', async ({ page }) => {
    await freshStart(page);
    await loadFixture(page);
    await containedChips(page).locator('button').first().click();
    await expect(jsonModalPre(page)).toContainText('ValueSet');
    await expect(jsonModalPre(page)).toContainText('vs-diet');
  });

  test('× button closes the JSON modal', async ({ page }) => {
    await freshStart(page);
    await loadFixture(page);
    await containedChips(page).locator('button').first().click();
    await expect(jsonModal(page)).toBeVisible();
    await jsonModalClose(page).click();
    await expect(jsonModal(page)).not.toBeVisible();
  });

  test('Close button (footer) closes the JSON modal', async ({ page }) => {
    await freshStart(page);
    await loadFixture(page);
    await containedChips(page).locator('button').first().click();
    await expect(jsonModal(page)).toBeVisible();
    await jsonModalCloseBtn(page).click();
    await expect(jsonModal(page)).not.toBeVisible();
  });

  test('Escape closes the JSON modal', async ({ page }) => {
    await freshStart(page);
    await loadFixture(page);
    await containedChips(page).locator('button').first().click();
    await expect(jsonModal(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(jsonModal(page)).not.toBeVisible();
  });

  test('backdrop click closes the JSON modal', async ({ page }) => {
    await freshStart(page);
    await loadFixture(page);
    await containedChips(page).locator('button').first().click();
    await expect(jsonModal(page)).toBeVisible();
    // Click the backdrop area (top-left corner, outside the modal box)
    await jsonModal(page).click({ position: { x: 5, y: 5 } });
    await expect(jsonModal(page)).not.toBeVisible();
  });

  test('toggle collapses and expands the chip list', async ({ page }) => {
    await freshStart(page);
    await loadFixture(page);
    await expect(containedChips(page)).toBeVisible();
    await containedToggle(page).click();
    await expect(containedChips(page)).not.toBeVisible();
    await containedToggle(page).click();
    await expect(containedChips(page)).toBeVisible();
  });

  test('hidden after form is cleared', async ({ page }) => {
    await freshStart(page);
    await loadFixture(page);
    await expect(containedCard(page)).toBeVisible();
    await page.getByTestId('clear-form-btn').click();
    await page.getByTestId('clear-confirm-clear-btn').click();
    await expect(containedCard(page)).not.toBeVisible();
  });
});

// ── Answer ValueSet card ──────────────────────────────────────────────────────

test.describe('Answer ValueSet card', () => {
  test('hidden before questionnaire loaded', async ({ page }) => {
    await freshStart(page);
    await expect(avsCard(page)).not.toBeVisible();
  });

  test('visible after loading fixture with answerValueSet items', async ({ page }) => {
    await freshStart(page);
    await loadFixture(page);
    await expect(avsCard(page)).toBeVisible();
  });

  test('shows correct URL count (2)', async ({ page }) => {
    await freshStart(page);
    await loadFixture(page);
    await expect(avsCount(page)).toHaveText('2');
  });

  test('shows chip for each unique answerValueSet URL', async ({ page }) => {
    await freshStart(page);
    await loadFixture(page);
    // Fixture has "#vs-diet" (label = "#vs-diet") and "…/external" (label = "external")
    await expect(avsChips(page)).toContainText('#vs-diet');
    await expect(avsChips(page)).toContainText('external');
  });

  test('click chip opens JSON modal with answerValueSet info', async ({ page }) => {
    await freshStart(page);
    await loadFixture(page);
    await avsChips(page).locator('button').first().click();
    await expect(jsonModal(page)).toBeVisible();
    await expect(jsonModalPre(page)).toContainText('answerValueSet');
  });

  test('modal title matches clicked chip label', async ({ page }) => {
    await freshStart(page);
    await loadFixture(page);
    const firstChip = avsChips(page).locator('button').first();
    const chipText  = await firstChip.textContent();
    await firstChip.click();
    await expect(jsonModalTitle(page)).toHaveText(chipText.trim());
  });

  test('hidden after form is cleared', async ({ page }) => {
    await freshStart(page);
    await loadFixture(page);
    await expect(avsCard(page)).toBeVisible();
    await page.getByTestId('clear-form-btn').click();
    await page.getByTestId('clear-confirm-clear-btn').click();
    await expect(avsCard(page)).not.toBeVisible();
  });
});
