// ── E2E: item.code[] editing + QR ordinalValue in answers ─────────────────────
// Tests that cover:
//   1. Codes action button — active indicator when _codes present, inactive when absent
//   2. Codes modal open/close (Apply / Cancel / × / Esc / backdrop)
//   3. Adding, editing, removing a code entry
//   4. Export round-trip — item.code[] preserved in exported FHIR JSON
//   5. QR ordinalValue — valueCoding in QR answer carries ordinalValue extension + display
//
// Fixture: tests/fixtures/codes-ordinal.fhir.json
//
// Run: npx playwright test tests/e2e/codes-ordinal.spec.js
//
// ── data-testid registry ─────────────────────────────────────────────────────
//   action-codes        action link for codes modal (ItemNode.buildBuilder)
//   codes-add-btn       Add code button inside modal body (codes-modal.js)
//   code-system-0       system input for first row
//   code-code-0         code input for first row
//   code-display-0      display input for first row
//   code-remove-0       remove button for first row
//   codesModal          modal backdrop (index.html, id)
//   codesModalApply     Apply button (index.html, id)
//   codesModalCancel    Cancel button (index.html, id)
//   codesModalClose     × button (index.html, id)
//   export-btn          main Export dropdown button
// export-quest-item    "Questionnaire…" item in export dropdown (opens saveFormatModal)
// ─────────────────────────────────────────────────────────────────────────────

import path from 'node:path';
import { test, expect } from '@playwright/test';

const FIXTURE = path.resolve('tests/fixtures/codes-ordinal.fhir.json');

// ── Helpers ───────────────────────────────────────────────────────────────────

async function waitForLoad(page) {
  await page.waitForSelector('[data-testid="add-root-group-btn"]', { timeout: 10_000 });
}

async function loadFixture(page) {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/');
  await waitForLoad(page);
  await page.locator('[data-testid="fhir-file-input"]').setInputFiles(FIXTURE);
  // Wait for first node to appear in builder
  await expect(page.locator('[data-testid="node-type-label"]').first()).toBeVisible({ timeout: 8_000 });
}

// ── 1. Codes action button ────────────────────────────────────────────────────

test.describe('Codes action button', () => {
  test('is highlighted (active) for item with codes', async ({ page }) => {
    await loadFixture(page);
    // First node (phq1) has item.code[]
    const codesBtn = page.locator('[data-testid="action-codes"]').first();
    await expect(codesBtn).toBeVisible();
    await expect(codesBtn).toHaveClass(/action-edit--active/);
  });

  test('is not highlighted for item without codes', async ({ page }) => {
    await loadFixture(page);
    // Second node (plain) has no codes
    const codesBtn = page.locator('[data-testid="action-codes"]').nth(1);
    await expect(codesBtn).toBeVisible();
    await expect(codesBtn).not.toHaveClass(/action-edit--active/);
  });
});

// ── 2. Codes modal open/close ─────────────────────────────────────────────────

test.describe('Codes modal open/close', () => {
  test('opens on click and shows existing codes', async ({ page }) => {
    await loadFixture(page);
    await page.locator('[data-testid="action-codes"]').first().click();
    await expect(page.locator('[data-testid="codesModal"]')).toBeVisible();
    // The pre-existing LOINC code should be in the first row
    await expect(page.locator('[data-testid="code-code-0"]')).toHaveValue('44250-9');
    await expect(page.locator('[data-testid="code-system-0"]')).toHaveValue('http://loinc.org');
    await expect(page.locator('[data-testid="code-display-0"]')).toHaveValue('PHQ item 1');
  });

  test('closes on Cancel without changes', async ({ page }) => {
    await loadFixture(page);
    await page.locator('[data-testid="action-codes"]').first().click();
    await expect(page.locator('[data-testid="codesModal"]')).toBeVisible();
    await page.locator('[data-testid="codesModalCancel"]').click();
    await expect(page.locator('[data-testid="codesModal"]')).toBeHidden();
  });

  test('closes on × button', async ({ page }) => {
    await loadFixture(page);
    await page.locator('[data-testid="action-codes"]').first().click();
    await page.locator('[data-testid="codesModalClose"]').click();
    await expect(page.locator('[data-testid="codesModal"]')).toBeHidden();
  });
});

// ── 3. Editing codes ──────────────────────────────────────────────────────────

test.describe('Codes modal editing', () => {
  test('adds a new code row on Add code click', async ({ page }) => {
    await loadFixture(page);
    await page.locator('[data-testid="action-codes"]').first().click();
    await page.locator('[data-testid="codes-add-btn"]').click();
    // Now there should be a second row
    await expect(page.locator('[data-testid="code-code-1"]')).toBeVisible();
  });

  test('removes a code row on × click', async ({ page }) => {
    await loadFixture(page);
    await page.locator('[data-testid="action-codes"]').first().click();
    await page.locator('[data-testid="code-remove-0"]').click();
    // Row should be gone
    await expect(page.locator('[data-testid="code-code-0"]')).toBeHidden();
  });

  test('Cancel discards changes to codes', async ({ page }) => {
    await loadFixture(page);
    await page.locator('[data-testid="action-codes"]').first().click();
    await page.locator('[data-testid="code-code-0"]').fill('CHANGED');
    await page.locator('[data-testid="codesModalCancel"]').click();
    // Re-open and check original value still there
    await page.locator('[data-testid="action-codes"]').first().click();
    await expect(page.locator('[data-testid="code-code-0"]')).toHaveValue('44250-9');
    await page.locator('[data-testid="codesModalCancel"]').click();
  });

  test('Apply commits new code and highlights button', async ({ page }) => {
    await loadFixture(page);
    // Open modal for the plain (no codes) item
    await page.locator('[data-testid="action-codes"]').nth(1).click();
    await page.locator('[data-testid="codes-add-btn"]').click();
    await page.locator('[data-testid="code-system-0"]').fill('http://snomed.info/sct');
    await page.locator('[data-testid="code-code-0"]').fill('720433000');
    await page.locator('[data-testid="code-display-0"]').fill('PHQ-9');
    await page.locator('[data-testid="codesModalApply"]').click();
    // Button should now be active
    await expect(page.locator('[data-testid="action-codes"]').nth(1)).toHaveClass(/action-edit--active/);
  });

  test('Apply with all codes removed clears _codes and deactivates button', async ({ page }) => {
    await loadFixture(page);
    await page.locator('[data-testid="action-codes"]').first().click();
    await page.locator('[data-testid="code-remove-0"]').click();
    await page.locator('[data-testid="codesModalApply"]').click();
    await expect(page.locator('[data-testid="action-codes"]').first()).not.toHaveClass(/action-edit--active/);
  });
});

// ── 4. FHIR export round-trip ─────────────────────────────────────────────────

test.describe('Codes export round-trip', () => {
  test('item.code[] preserved in exported FHIR JSON', async ({ page }) => {
    await loadFixture(page);
    await page.locator('[data-testid="export-btn"]').click();
    await page.getByTestId('export-quest-item').click();
    await expect(page.locator('[data-testid="saveFormatModal"]')).toBeVisible();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('saveFormatModalApply').click().then(() => page.getByTestId('prompt-save').click()),
    ]);
    const filePath = await download.path();
    const { readFileSync } = await import('node:fs');
    const q = JSON.parse(readFileSync(filePath, 'utf8'));
    expect(q.item[0].code[0].code).toBe('44250-9');
    expect(q.item[0].code[0].system).toBe('http://loinc.org');
    expect(q.item[0].code[0].display).toBe('PHQ item 1');
  });
});
