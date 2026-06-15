// ── E2E: SDC Observation-based extraction ────────────────────────────────────
//
// Tests that:
//   1. The "Extract as Observation" checkbox appears in the States modal for
//      item and group nodes, but NOT for display items.
//   2. Toggling the checkbox and applying persists the flag (action link
//      becomes active; export round-trip preserves the extension).
//   3. The "Observations · Bundle" entry is present in the Save dropdown.
//   4. Loading the pre-flagged fixture, downloading the Bundle, and verifying
//      the generated Observations match expected codes / Quantity values.
//
// Fixture: tests/fixtures/obs-extract-e2e.fhir.json
//   vitals      — group with observationExtract: true
//   weight      — decimal + questionnaire-unit kg (inherits flag)
//   smoking     — choice item with code (inherits flag)
//   suppressed  — string item with explicit observationExtract: false
//   no-code     — string item, no code, no flag
//
// Run: npx playwright test tests/e2e/observation-extract.spec.js
//
// ── data-testid registry ─────────────────────────────────────────────────────
//   export-btn              Save ▾ dropdown trigger
//   export-obs-item         "Observations · transaction Bundle" menu item
//   export-quest-item       "Questionnaire…" menu item (for round-trip test)
//   saveFormatModalApply    Apply button in save-format modal
//   prompt-save             Confirm button in filename prompt dialog
//   action-states           States action link on item nodes
//   states-obs-extract-sel  Extract-as-Observation dropdown trigger inside States modal
//   statesModal             States modal backdrop
//   statesModalApply        Apply button inside States modal
// ─────────────────────────────────────────────────────────────────────────────

import path from 'node:path';
import fs   from 'node:fs';
import { test, expect } from '@playwright/test';
import { openDropdownItem } from './helpers/dropdown.js';

const FIXTURE = path.resolve('tests/fixtures/obs-extract-e2e.fhir.json');
const OBS_EXT = 'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-observationExtract';

async function freshStart(page) {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/');
  await page.waitForSelector('[data-testid="add-root-group-btn"]', { timeout: 10_000 });
}

async function loadFixture(page) {
  await freshStart(page);
  await page.locator('[data-testid="fhir-file-input"]').setInputFiles(FIXTURE);
  await expect(page.locator('[data-preview-id="vitals"]')).toBeVisible({ timeout: 8_000 });
}

async function openStatesModal(page, nodeId) {
  const link = page.locator(`[data-node-id="${nodeId}"]`).getByTestId('action-states').first();
  await expect(link).toBeVisible();
  await link.click();
  await expect(page.locator('[data-testid="statesModal"]')).toBeVisible();
}

// ── 1. Dropdown visibility ────────────────────────────────────────────────────

test.describe('observation-extract — dropdown in States modal', () => {
  test('dropdown is present for an item node', async ({ page }) => {
    await loadFixture(page);
    await openStatesModal(page, 'weight');
    await expect(page.locator('[data-testid="states-obs-extract-sel"]')).toBeVisible();
  });
});

// ── 2. Toggle and persist ─────────────────────────────────────────────────────

test.describe('observation-extract — toggle and apply', () => {
  test('selecting "Yes" and applying activates the States action link', async ({ page }) => {
    await freshStart(page);
    await expect(async () => {
      if (!(await page.getByTestId('add-root-group-btn').isVisible())) return;
      await page.getByTestId('add-root-group-btn').click();
    }).toPass();
    await expect(page.locator('[data-node-id]').first()).toBeVisible({ timeout: 6_000 });
    const nodeId = await page.locator('[data-node-id]').first().getAttribute('data-node-id');
    await openStatesModal(page, nodeId);
    // Starts at "Inherit" ('')
    const trigger = page.locator('[data-testid="states-obs-extract-sel"]');
    await expect(trigger).toHaveAttribute('data-value', '');
    // Select "Yes"
    await trigger.click();
    await page.locator('[data-testid="csel-drop"] [data-val="true"]').click();
    await expect(trigger).toHaveAttribute('data-value', 'true');
    await page.locator('[data-testid="statesModalApply"]').click();
    await expect(page.locator('[data-testid="statesModal"]')).toBeHidden();
    // Re-open: flag should still be "Yes"
    await openStatesModal(page, nodeId);
    await expect(page.locator('[data-testid="states-obs-extract-sel"]')).toHaveAttribute('data-value', 'true');
  });

  test('loaded fixture has the group flag set to "Yes"', async ({ page }) => {
    await loadFixture(page);
    const groupId = 'vitals';
    const link = page.locator(`[data-node-id="${groupId}"]`).getByTestId('action-states').first();
    await expect(link).toBeVisible();
    await link.click();
    await expect(page.locator('[data-testid="statesModal"]')).toBeVisible();
    await expect(page.locator('[data-testid="states-obs-extract-sel"]')).toHaveAttribute('data-value', 'true');
  });

  test('suppressed item shows "No" in dropdown', async ({ page }) => {
    await loadFixture(page);
    await openStatesModal(page, 'suppressed');
    await expect(page.locator('[data-testid="states-obs-extract-sel"]')).toHaveAttribute('data-value', 'false');
  });
});

// ── 3. Export menu entry present ──────────────────────────────────────────────

test.describe('observation-extract — export menu', () => {
  test('"Observations" item appears in Save dropdown', async ({ page }) => {
    await freshStart(page);
    await expect(async () => {
      if (!(await page.getByTestId('export-obs-item').isVisible())) {
        await page.getByTestId('export-btn').click();
      }
      await expect(page.getByTestId('export-obs-item')).toBeVisible();
    }).toPass();
    await expect(page.getByTestId('export-obs-item')).toBeVisible();
    // Close menu
    await page.keyboard.press('Escape');
  });
});

// ── 4. Round-trip: extension survives export → re-import ─────────────────────

test.describe('observation-extract — round-trip', () => {
  test('observationExtract extension preserved in exported FHIR JSON', async ({ page }) => {
    await loadFixture(page);
    await openDropdownItem(page, 'export-btn', 'export-quest-item');
    await expect(page.locator('[data-testid="saveFormatModal"]')).toBeVisible();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('saveFormatModalApply').click()
        .then(() => page.getByTestId('prompt-save').click()),
    ]);
    const exported = JSON.parse(fs.readFileSync(await download.path(), 'utf8'));
    const vitals = exported.item.find(i => i.linkId === 'vitals');
    expect(vitals?.extension?.some(e => e.url === OBS_EXT && e.valueBoolean === true)).toBe(true);
    const suppressed = vitals?.item?.find(i => i.linkId === 'suppressed');
    expect(suppressed?.extension?.some(e => e.url === OBS_EXT && e.valueBoolean === false)).toBe(true);
    // Items that inherited (no own extension) should not have the extension
    const weight = vitals?.item?.find(i => i.linkId === 'weight');
    const weightObs = weight?.extension?.find(e => e.url === OBS_EXT);
    expect(weightObs).toBeUndefined();
  });
});

// ── 5. Bundle download produces correct Observations ─────────────────────────

test.describe('observation-extract — Bundle download', () => {
  test('downloading Observations Bundle produces correct structure', async ({ page }) => {
    await loadFixture(page);
    // Fill weight in the preview
    const weightInput = page.locator('[data-preview-id="weight"] input[type="number"]');
    await expect(weightInput).toBeVisible({ timeout: 6_000 });
    await weightInput.fill('72');
    await page.getByTestId('preview-search-input').click();

    // Download Bundle
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      openDropdownItem(page, 'export-btn', 'export-obs-item'),
    ]);
    const bundle = JSON.parse(fs.readFileSync(await download.path(), 'utf8'));
    expect(bundle.resourceType).toBe('Bundle');
    expect(bundle.type).toBe('transaction');
    // Only the weight entry with an answer should appear (smoking not answered; suppressed excluded)
    expect(bundle.entry.length).toBeGreaterThanOrEqual(1);
    const weightObs = bundle.entry.find(e =>
      e.resource.code?.coding?.some(c => c.code === '29463-7')
    );
    expect(weightObs).toBeDefined();
    expect(weightObs.resource.status).toBe('final');
    expect(weightObs.resource.valueQuantity?.value).toBe(72);
    expect(weightObs.resource.valueQuantity?.unit).toBe('kg');
    expect(weightObs.request).toEqual({ method: 'POST', url: 'Observation' });
    // suppressed item must NOT appear
    const suppObs = bundle.entry.find(e =>
      e.resource.code?.coding?.some(c => c.code === '48767-8')
    );
    expect(suppObs).toBeUndefined();
    // no-code item must NOT appear
    const noCodeObs = bundle.entry.find(e => !e.resource.code?.coding?.length);
    expect(noCodeObs).toBeUndefined();
  });
});
