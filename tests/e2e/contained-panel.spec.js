// ── E2E: Contained Resources & Answer ValueSet panels ─────────────────────────
// Tests for the two read-only info cards that appear when an imported
// questionnaire carries Questionnaire.contained[] resources or items that use
// answerValueSet. Both cards share a single JSON-viewer modal (fhirJsonModal).
//
// Run: npx playwright test tests/e2e/contained-panel.spec.js
//
// ── element IDs ──────────────────────────────────────────────────────────────
//   containedCard            collapsible card (shown when contained[] is non-empty)
//   containedCardToggle      collapse/expand button
//   containedCardChips       chip list container
//   containedCardCount       resource count badge
//   answerValueSetCard       collapsible card (shown when any item has answerValueSet)
//   answerValueSetCardToggle collapse/expand button
//   answerValueSetCardChips  chip list container
//   answerValueSetCardCount  URL count badge
//   fhirJsonModal            read-only JSON viewer modal backdrop
//   fhirJsonModalTitle       modal title <span>
//   fhirJsonModalPre         <pre> with formatted JSON
//   fhirJsonModalClose       × close button (header)
//   fhirJsonModalCloseBtn    "Close" button (footer)
// ─────────────────────────────────────────────────────────────────────────────

import path from 'node:path';
import { test, expect } from '@playwright/test';

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

/** Load the contained-valueset fixture via the hidden file input.
 *  The fixture has an external answerValueSet URL that always fails expansion
 *  (fake domain). We wait for and dismiss the resulting error modal so tests
 *  that cover the contained panel are not blocked by it. */
async function loadFixture(page) {
  await page.locator('[data-testid="fhir-file-input"]').setInputFiles(FIXTURE);
  await expect(page.locator('[data-node-id]').first()).toBeVisible({ timeout: 8_000 });
  // Async expansion fires after render; wait up to 5 s for the error modal.
  const validateBackdrop = page.locator('[data-testid="validateModal"]');
  await validateBackdrop.waitFor({ state: 'visible', timeout: 5_000 }).catch(() => {});
  if (await validateBackdrop.isVisible()) {
    await page.locator('[data-testid="validateModalClose"]').click();
    await validateBackdrop.waitFor({ state: 'hidden', timeout: 3_000 });
  }
}

const containedCard      = (page) => page.locator('#containedCard');
const containedChips     = (page) => page.locator('#containedCardChips');
const containedCount     = (page) => page.locator('#containedCardCount');
const containedToggle    = (page) => page.locator('#containedCardToggle');

const avsCard            = (page) => page.locator('#answerValueSetCard');
const avsChips           = (page) => page.locator('#answerValueSetCardChips');
const avsCount           = (page) => page.locator('#answerValueSetCardCount');

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
