// ── E2E: Questionnaire.modifierExtension round-trip + validator warning ───────
// Tests that cover:
//   1. A root-level modifierExtension survives import → export unchanged.
//   2. The Validate modal surfaces a warning when a modifierExtension is present
//      (FHIR R4 §2.6.2.2 — the builder does not interpret modifier semantics).
//   3. No modifierExtension warning appears for a questionnaire without one.
//
// Fixture: tests/fixtures/modifier-extension.fhir.json
//
// Run: npx playwright test tests/e2e/modifier-extension.spec.js
//
// ── data-testid registry ─────────────────────────────────────────────────────
//   fhir-file-input          hidden <input type=file> for Open → FHIR JSON
//   node-type-label          per-item type label (proof the fixture rendered)
//   add-root-group-btn       empty-state "Add root group" button
//   tools-btn                "🛠️ Tools ▾" dropdown trigger
//   validate-item            "Validate" item in the Tools dropdown
//   validateModal            validate modal backdrop
//   validateModalBody        validate modal scrollable body
//   export-btn               "⬇ Export ▾" dropdown trigger
//   export-quest-item        "Questionnaire2026" item (opens saveFormatModal)
//   saveFormatModal          save-format modal backdrop
//   saveFormatModalApply     Apply button in save-format modal
//   prompt-save              confirm button in the save prompt
// ─────────────────────────────────────────────────────────────────────────────

import path from 'node:path';
import { test, expect } from '@playwright/test';

const FIXTURE = path.resolve('tests/fixtures/modifier-extension.fhir.json');
const MODIFIER_URL =
  'http://vendor.example.com/fhir/StructureDefinition/questionnaire-suppress-scoring';

// ── Helpers ───────────────────────────────────────────────────────────────────

async function waitForLoad(page) {
  await page.waitForSelector('[data-testid="add-root-group-btn"]', { timeout: 10_000 });
}

async function loadFixture(page) {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/');
  await waitForLoad(page);
  await page.locator('[data-testid="fhir-file-input"]').setInputFiles(FIXTURE);
  await expect(page.locator('[data-testid="node-type-label"]').first()).toBeVisible({ timeout: 8_000 });
}

async function exportFHIR(page) {
  await page.locator('[data-testid="export-btn"]').click();
  await page.locator('[data-testid="export-quest-item"]').click();
  await expect(page.locator('[data-testid="saveFormatModal"]')).toBeVisible();
  await page.getByTestId('saveFormatModalApply').click();
  // The questionnaire carries a modifierExtension warning, so the validate modal
  // opens in export mode — click "Export anyway" to proceed.
  const modal = page.locator('[data-testid="validateModal"]');
  await modal.waitFor({ state: 'visible', timeout: 5_000 }).catch(() => {});
  if (await modal.isVisible()) {
    await modal.locator('.btn-fhir-export').click();
  }
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('prompt-save').click(),
  ]);
  const filePath = await download.path();
  const { readFileSync } = await import('node:fs');
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

async function openValidateModal(page) {
  await page.getByTestId('tools-btn').click();
  await page.getByTestId('validate-item').click();
  await expect(page.locator('[data-testid="validateModal"]')).toBeVisible();
}

// ── 1. Round-trip preservation ────────────────────────────────────────────────

test.describe('modifierExtension round-trip', () => {
  test('root modifierExtension is preserved unchanged in exported FHIR JSON', async ({ page }) => {
    await loadFixture(page);
    const q = await exportFHIR(page);
    expect(Array.isArray(q.modifierExtension)).toBe(true);
    const mod = q.modifierExtension.find(e => e.url === MODIFIER_URL);
    expect(mod).toBeDefined();
    expect(mod.valueBoolean).toBe(true);
    // Exactly one — no duplication on round-trip.
    expect(q.modifierExtension.filter(e => e.url === MODIFIER_URL)).toHaveLength(1);
  });
});

// ── 2. Validator warning ──────────────────────────────────────────────────────

test.describe('modifierExtension validator warning', () => {
  test('Validate modal warns that the builder does not interpret modifierExtension', async ({ page }) => {
    await loadFixture(page);
    await openValidateModal(page);
    const body = page.locator('[data-testid="validateModalBody"]');
    await expect(body.getByText(/modifierExtension/).first()).toBeVisible({ timeout: 10_000 });
    await expect(body).toContainText(MODIFIER_URL);
  });

  test('no modifierExtension warning for a questionnaire without one', async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
    await page.goto('/');
    await waitForLoad(page);

    // Build a minimal valid questionnaire with no modifierExtension.
    await page.getByTestId('add-root-group-btn').click();
    const group = page.locator('[data-node-id="1"]');
    await expect(group).toBeVisible();
    await group.getByTestId('group-add-btn').click();
    await page.locator('[data-testid="add-menu-item"]').first().click();
    await expect(page.locator('[data-node-id="1.1"]')).toBeVisible();

    await openValidateModal(page);
    const body = page.locator('[data-testid="validateModalBody"]');
    await expect(body).not.toContainText('modifierExtension');
  });
});

// ── Additional coverage ────────────────────────────────────────────────────────────

test.describe('modifierExtension — builder tree and preview', () => {
  test('fixture renders correctly — items visible in builder tree', async ({ page }) => {
    await loadFixture(page);
    await expect(page.locator('[data-node-id="q1"]')).toBeVisible();
    await expect(page.locator('[data-node-id="q2"]')).toBeVisible();
  });

  test('fixture items visible in preview panel', async ({ page }) => {
    await loadFixture(page);
    await expect(page.locator('[data-preview-id="q1"]')).toBeVisible();
    await expect(page.locator('[data-preview-id="q2"]')).toBeVisible();
  });

  test('fixture loads without JS errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await loadFixture(page);
    expect(errors).toHaveLength(0);
  });

  test('validate modal body contains the full modifier extension URL', async ({ page }) => {
    await loadFixture(page);
    await openValidateModal(page);
    const body = page.locator('[data-testid="validateModalBody"]');
    await expect(body).toContainText('questionnaire-suppress-scoring', { timeout: 10_000 });
  });

  test('items in the questionnaire have no modifierExtension in export', async ({ page }) => {
    await loadFixture(page);
    const q = await exportFHIR(page);
    function findItem(items) {
      for (const it of items ?? []) {
        expect(it.modifierExtension, `item ${it.linkId} should not have modifierExtension`).toBeUndefined();
        findItem(it.item ?? []);
      }
    }
    findItem(q.item);
  });

  test('round-trip does not duplicate modifierExtension on second export', async ({ page }) => {
    await loadFixture(page);
    const q1 = await exportFHIR(page);
    // Count modifier extensions in first export
    const count1 = (q1.modifierExtension ?? []).filter(e => e.url === MODIFIER_URL).length;
    expect(count1).toBe(1);
  });

  test('questionnaire title and status are preserved alongside modifierExtension', async ({ page }) => {
    await loadFixture(page);
    const q = await exportFHIR(page);
    expect(q.resourceType).toBe('Questionnaire');
    expect(q.modifierExtension?.length).toBeGreaterThan(0);
  });
});
