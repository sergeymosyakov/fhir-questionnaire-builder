// ── E2E: Status badge and group icon with constraint-only / range-only items ──
//
// Covers two preview-form.js regressions fixed in the same commit:
//   1. hasCriteria fix — badge was hidden when questionnaire had only constraints
//      or only range items (no mandatory, no calc). Now includes hasConstraints
//      and hasRange in the hasCriteria check.
//   2. Group icon fix  — group .icon-ok/.icon-fail was always ✔ for groups whose
//      children had only constraints (not mandatory). Now evaluates constraints
//      in both relevantItems filter and itemOk predicate.
//
// Fixture: tests/fixtures/constraint-badge.fhir.json
//   grp-constraint  — group with one integer child "age" (constraint: >= 18, not required)
//   age             — integer item, constraint only, NOT required
//   score-range     — root integer item, minValue=0 / maxValue=100, NOT required
//
// Run: npx playwright test tests/e2e/constraint-badge.spec.js
//
// ── data-testid registry ─────────────────────────────────────────────────────
//   status-badge-btn    coloured PASS/FAIL pill in the preview header
// ─────────────────────────────────────────────────────────────────────────────

import path from 'node:path';
import { test, expect } from '@playwright/test';

const FIXTURE = path.resolve('tests/fixtures/constraint-badge.fhir.json');

async function waitForLoad(page) {
  await page.waitForSelector('[data-testid="add-root-group-btn"]', { timeout: 10_000 });
}

async function loadFixture(page) {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/');
  await waitForLoad(page);
  await page.locator('[data-testid="fhir-file-input"]').setInputFiles(FIXTURE);
  // Wait until the preview renders the group
  await expect(page.locator('[data-preview-id="grp-constraint"]')).toBeVisible({ timeout: 8_000 });
}

const badge = page => page.getByTestId('status-badge-btn');

// Click the "Questionnaire Preview" title to move focus away from the input,
// firing blur+change → BaseNode.notifyChanged() → RESPONSE_CHANGED → badge update.
// Always use this pattern to commit preview inputs — never Tab, never waitForTimeout.
async function commitInput(page, _input) {
  // Yield two rAF frames so the input value is committed to the DOM,
  // then click the preview title to fire blur → notifyChanged → RESPONSE_CHANGED.
  // Two frames mirrors _yield() in preview-form.js (_asyncRender guard).
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  await page.getByTestId('preview-panel-title').click();
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
}

// ── 1. hasCriteria — badge visibility ─────────────────────────────────────────

test.describe('hasCriteria: badge visible for constraint-only questionnaire', () => {
  test('badge is visible on load (questionnaire has only constraints, no required fields)', async ({ page }) => {
    await loadFixture(page);
    await expect(badge(page)).toBeVisible();
  });

  test('badge shows FAIL initially (constraint not yet satisfied — no answer)', async ({ page }) => {
    await loadFixture(page);
    // age has required:false → only in constraintItems, not mandatoryItems
    // score-range has required:false → rangeAllOk=true when empty (no value violates range)
    // Only the age constraint failure → 1 issue
    await expect(badge(page)).toContainText('FAIL');
    await expect(badge(page)).toContainText('1 issue');
  });

  test('badge shows PASS after filling a valid constraint value', async ({ page }) => {
    await loadFixture(page);
    const input = page.locator('[data-preview-id="age"] input[type="number"]');
    await input.fill('20');
    await commitInput(page, input);
    await expect(badge(page)).toContainText('PASS');
  });

  test('badge returns to FAIL when constraint value becomes invalid', async ({ page }) => {
    await loadFixture(page);
    const input = page.locator('[data-preview-id="age"] input[type="number"]');
    await input.fill('20');
    await commitInput(page, input);
    await expect(badge(page)).toContainText('PASS');
    await input.fill('5');
    await commitInput(page, input);
    await expect(badge(page)).toContainText('FAIL');
  });
});

// ── 2. hasCriteria — badge visible for range-only questionnaire ───────────────

test.describe('hasCriteria: badge visible for range-only (minValue/maxValue) item', () => {
  test('badge is visible (score-range item has min/max, not required)', async ({ page }) => {
    await loadFixture(page);
    await expect(badge(page)).toBeVisible();
  });

  test('range item out of range: badge shows FAIL', async ({ page }) => {
    await loadFixture(page);
    const ageInput = page.locator('[data-preview-id="age"] input[type="number"]');
    const rangeInput = page.locator('[data-preview-id="score-range"] input[type="number"]');
    // Satisfy constraint, then violate the range
    await ageInput.fill('20');
    await commitInput(page, ageInput);
    // Now violate the range — badge must show FAIL
    await rangeInput.fill('200');
    await commitInput(page, rangeInput);
    await expect(badge(page)).toContainText('FAIL');
  });

  test('all valid: constraint satisfied + range in bounds → PASS', async ({ page }) => {
    await loadFixture(page);
    const ageInput   = page.locator('[data-preview-id="age"] input[type="number"]');
    const rangeInput = page.locator('[data-preview-id="score-range"] input[type="number"]');
    await ageInput.fill('25');
    await commitInput(page, ageInput);
    await rangeInput.fill('50');
    await commitInput(page, rangeInput);
    await expect(badge(page)).toContainText('PASS');
  });
});

// ── 3. Group icon — constraint-only child items ───────────────────────────────

test.describe('group icon reflects constraint-only child state', () => {
  test('group icon shows fail (✘) when child constraint not satisfied', async ({ page }) => {
    await loadFixture(page);
    const groupIcon = page.locator('[data-preview-id="grp-constraint"] .icon-fail');
    await expect(groupIcon).toBeVisible();
  });

  test('group icon shows ok (✔) after child constraint is satisfied', async ({ page }) => {
    await loadFixture(page);
    const input     = page.locator('[data-preview-id="age"] input[type="number"]');
    const groupOk   = page.locator('[data-preview-id="grp-constraint"] .icon-ok');
    const groupFail = page.locator('[data-preview-id="grp-constraint"] .icon-fail');
    await input.fill('21');
    await commitInput(page, input);
    await expect(groupOk).toBeVisible();
    await expect(groupFail).toHaveCount(0);
  });

  test('group icon reverts to fail when value drops below constraint', async ({ page }) => {
    await loadFixture(page);
    const input   = page.locator('[data-preview-id="age"] input[type="number"]');
    const groupOk = page.locator('[data-preview-id="grp-constraint"] .icon-ok');
    await input.fill('18');
    await commitInput(page, input);
    await expect(groupOk).toBeVisible();
    await input.fill('17');
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    await commitInput(page, input);
    await expect(page.locator('[data-preview-id="grp-constraint"] .icon-fail')).toBeVisible();
  });
});
