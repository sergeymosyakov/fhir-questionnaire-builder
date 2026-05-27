// ── E2E: sdc-questionnaire-preferredTerminologyServer ─────────────────────────
//
// Verifies the Terminology modal (per-item) and the Questionnaire Properties
// "Default Terminology Server" field (questionnaire-level), including
// import round-trip and export JSON validation.
//
// Fixture: tests/fixtures/terminology-server.fhir.json
//   q-item-server — per-item server: https://r4.ontoserver.csiro.au/fhir
//   q-no-server   — no per-item server (uses questionnaire default)
//   q-text        — plain string item (no answerValueSet)
//   Questionnaire.extension[preferredTerminologyServer] = https://tx.fhir.org/r4
//
// Run: npx playwright test tests/e2e/terminology-server.spec.js
//
// ── data-testid registry ──────────────────────────────────────────────────────
//   add-root-group-btn            "+Add Root Group"
//   group-add-btn                 "+" button on a group
//   add-menu-item                 "Item" option in add-child menu
//   action-terminology            "Terminology" action link on an item row
//   terminologyModal              modal backdrop
//   terminologyModalTitle         <span> inside modal header
//   terminologyModalApply         Apply button
//   terminologyModalCancel        Cancel button
//   terminologyModalClose         × close button
//   terminology-server-url-input  URL input inside modal
//   meta-preferred-term-server    URL input inside Properties modal
// ─────────────────────────────────────────────────────────────────────────────

import path from 'node:path';
import { test, expect } from '@playwright/test';

const FIXTURE = path.resolve('tests/fixtures/terminology-server.fhir.json');

async function loadFixture(page) {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/');
  await page.waitForSelector('[data-testid="add-root-group-btn"]', { timeout: 10_000 });
  await page.locator('#fhirFileInput').setInputFiles(FIXTURE);
  await expect(page.locator('[data-node-id]').first()).toBeVisible({ timeout: 8_000 });
}

async function freshStart(page) {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/');
  await page.waitForSelector('[data-testid="add-root-group-btn"]', { timeout: 10_000 });
}

async function addItem(page) {
  await page.getByTestId('add-root-group-btn').click();
  await expect(page.locator('[data-node-id="1"]')).toBeVisible();
  await page.locator('[data-node-id="1"]').getByTestId('group-add-btn').click();
  await page.locator('[data-testid="add-menu-item"]').first().click();
  await expect(page.locator('[data-node-id="1.1"]')).toBeVisible();
  return page.locator('[data-node-id="1.1"]');
}

const modal       = (page) => page.locator('[data-testid="terminologyModal"]');
const urlInput    = (page) => page.getByTestId('terminology-server-url-input');
const applyBtn    = (page) => page.locator('[data-testid="terminologyModalApply"]');
const cancelBtn   = (page) => page.locator('[data-testid="terminologyModalCancel"]');

// ── Modal open / close ────────────────────────────────────────────────────────

test.describe('Terminology modal — open / close', () => {
  test('every item has a "Terminology" action link', async ({ page }) => {
    await freshStart(page);
    const item = await addItem(page);
    await expect(item.getByTestId('action-terminology')).toBeVisible();
  });

  test('clicking "Terminology" opens the modal', async ({ page }) => {
    await freshStart(page);
    const item = await addItem(page);
    await item.getByTestId('action-terminology').click();
    await expect(modal(page)).toBeVisible();
  });

  test('modal title contains "Terminology Server"', async ({ page }) => {
    await freshStart(page);
    const item = await addItem(page);
    await item.getByTestId('action-terminology').click();
    await expect(page.locator('[data-testid="terminologyModalTitle"]')).toContainText('Terminology Server');
  });

  test('Cancel closes the modal without saving', async ({ page }) => {
    await freshStart(page);
    const item = await addItem(page);
    await item.getByTestId('action-terminology').click();
    await urlInput(page).fill('https://tx.fhir.org/r4');
    await cancelBtn(page).click();
    await expect(modal(page)).not.toBeVisible();
    // Re-open: value must still be empty
    await item.getByTestId('action-terminology').click();
    await expect(urlInput(page)).toHaveValue('');
    await cancelBtn(page).click();
  });

  test('× button closes the modal', async ({ page }) => {
    await freshStart(page);
    const item = await addItem(page);
    await item.getByTestId('action-terminology').click();
    await page.locator('[data-testid="terminologyModalClose"]').click();
    await expect(modal(page)).not.toBeVisible();
  });
});

// ── Per-item round-trip ───────────────────────────────────────────────────────

test.describe('Terminology modal — per-item set / clear', () => {
  test('entering a URL and applying activates the action link', async ({ page }) => {
    await freshStart(page);
    const item = await addItem(page);
    await item.getByTestId('action-terminology').click();
    await urlInput(page).fill('https://tx.fhir.org/r4');
    await applyBtn(page).click();
    await expect(modal(page)).not.toBeVisible();
    // action link becomes active (has action-edit--active class)
    await expect(item.getByTestId('action-terminology')).toHaveClass(/action-edit--active/);
  });

  test('clearing the URL deactivates the action link', async ({ page }) => {
    await freshStart(page);
    const item = await addItem(page);
    // Set
    await item.getByTestId('action-terminology').click();
    await urlInput(page).fill('https://tx.fhir.org/r4');
    await applyBtn(page).click();
    // Clear
    await item.getByTestId('action-terminology').click();
    await urlInput(page).fill('');
    await applyBtn(page).click();
    await expect(item.getByTestId('action-terminology')).not.toHaveClass(/action-edit--active/);
  });

  test('applied value is re-shown when modal is re-opened', async ({ page }) => {
    await freshStart(page);
    const item = await addItem(page);
    await item.getByTestId('action-terminology').click();
    await urlInput(page).fill('https://ontoserver.csiro.au/r4');
    await applyBtn(page).click();
    await item.getByTestId('action-terminology').click();
    await expect(urlInput(page)).toHaveValue('https://ontoserver.csiro.au/r4');
    await cancelBtn(page).click();
  });
});

// ── Import fixture round-trip ─────────────────────────────────────────────────

test.describe('Terminology server — import fixture round-trip', () => {
  test('per-item server URL is loaded from fixture into modal', async ({ page }) => {
    await loadFixture(page);
    const itemRow = page.locator('[data-node-id]').filter({ has: page.locator('[data-testid="action-terminology"]') }).first();
    await itemRow.getByTestId('action-terminology').click();
    await expect(modal(page)).toBeVisible();
    await expect(urlInput(page)).toHaveValue('https://r4.ontoserver.csiro.au/fhir');
    await cancelBtn(page).click();
  });

  test('per-item action link is active for item with server extension', async ({ page }) => {
    await loadFixture(page);
    const itemRow = page.locator('[data-node-id]').filter({ has: page.locator('[data-testid="action-terminology"]') }).first();
    await expect(itemRow.getByTestId('action-terminology')).toHaveClass(/action-edit--active/);
  });

  test('questionnaire-level server is loaded into Properties modal field', async ({ page }) => {
    await loadFixture(page);
    await page.locator('[data-testid="properties-btn"]').click();
    await expect(page.locator('[data-testid="metadataModal"]')).toBeVisible();
    await expect(page.getByTestId('meta-preferred-term-server')).toHaveValue('https://tx.fhir.org/r4');
    await page.locator('[data-testid="metadataModalCancel"]').click();
  });
});

// ── Export round-trip ─────────────────────────────────────────────────────────

test.describe('Terminology server — export JSON', () => {
  test('per-item extension appears in exported JSON', async ({ page }) => {
    await freshStart(page);
    const item = await addItem(page);
    await item.getByTestId('action-terminology').click();
    await urlInput(page).fill('https://tx.fhir.org/r4');
    await applyBtn(page).click();

    await page.getByTestId('preview-mode-btn').click();
    await page.getByTestId('preview-mode-json').click();
    await expect(page.locator('#fhirJsonView')).toBeVisible();
    const json = await page.locator('#fhirJsonView').textContent();
    const q = JSON.parse(json);
    const ext = (q.item?.[0]?.item?.[0]?.extension || []).find(
      e => e.url === 'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-preferredTerminologyServer'
    );
    expect(ext?.valueUrl).toBe('https://tx.fhir.org/r4');
  });

  test('questionnaire-level extension appears in exported JSON', async ({ page }) => {
    await loadFixture(page);
    await page.getByTestId('preview-mode-btn').click();
    await page.getByTestId('preview-mode-json').click();
    await expect(page.locator('#fhirJsonView')).toBeVisible();
    const json = await page.locator('#fhirJsonView').textContent();
    const q = JSON.parse(json);
    const ext = (q.extension || []).find(
      e => e.url === 'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-preferredTerminologyServer'
    );
    expect(ext?.valueUrl).toBe('https://tx.fhir.org/r4');
  });
});

// ── Test connection button ────────────────────────────────────────────────────
test.describe('Terminology modal — Test connection button', () => {
  test('Test connection button is present in the modal', async ({ page }) => {
    await freshStart(page);
    const item = await addItem(page);
    await item.getByTestId('action-terminology').click();
    await expect(modal(page)).toBeVisible();
    await expect(page.getByTestId('terminology-test-btn')).toBeVisible();
  });

  test('clicking Test connection shows a status result', async ({ page }) => {
    await freshStart(page);
    const item = await addItem(page);
    await item.getByTestId('action-terminology').click();
    await urlInput(page).fill('https://tx.fhir.org/r4');
    await page.getByTestId('terminology-test-btn').click();
    // Status element should become non-empty (either ok or error — network may be unavailable in CI)
    await expect(page.getByTestId('terminology-test-status')).not.toBeEmpty({ timeout: 20_000 });
  });

  test('status resets when modal is reopened', async ({ page }) => {
    await freshStart(page);
    const item = await addItem(page);
    await item.getByTestId('action-terminology').click();
    await urlInput(page).fill('https://tx.fhir.org/r4');
    await cancelBtn(page).click();
    await item.getByTestId('action-terminology').click();
    // On reopen, status should be empty (no stale result)
    await expect(page.getByTestId('terminology-test-status')).toBeEmpty();
  });
});

// ── Properties modal section order ───────────────────────────────────────────
test.describe('Properties modal — section order', () => {
  test('Terminology Server field appears before any collapsible section', async ({ page }) => {
    await freshStart(page);
    await page.getByTestId('add-root-group-btn').click();
    await page.getByTestId('properties-btn').click();
    await expect(page.locator('[data-testid="metadataModal"]')).toBeVisible();

    const termPos = await page.evaluate(() => {
      const inp = document.querySelector('[data-testid="meta-preferred-term-server"]');
      const collapsible = document.querySelector('[data-testid="meta-advanced-toggle"]');
      if (!inp || !collapsible) return null;
      return inp.compareDocumentPosition(collapsible) & Node.DOCUMENT_POSITION_FOLLOWING ? 'before' : 'after';
    });
    expect(termPos).toBe('before');
  });
});
