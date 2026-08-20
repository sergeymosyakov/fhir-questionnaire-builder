// ── E2E: boolean segmented control (Yes / No / Not Answered) ─────────────────
// Tests that boolean items render as a 3-segment pill control instead of a
// checkbox, with correct value mapping and mobile full-width behaviour.
//
// Fixture: tests/fixtures/boolean-segmented.fhir.json
// Run: npx playwright test tests/e2e/boolean-segmented.spec.js

import path from 'node:path';
import { test, expect } from '@playwright/test';

const FIXTURE = path.resolve('tests/fixtures/boolean-segmented.fhir.json');

async function loadFixture(page) {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/');
  await page.waitForSelector('[data-testid="add-root-group-btn"]', { timeout: 10_000 });
  await page.locator('[data-testid="fhir-file-input"]').setInputFiles(FIXTURE);
  await expect(page.locator('.bool-seg').first()).toBeVisible({ timeout: 8_000 });
}

// ── Rendering ─────────────────────────────────────────────────────────────────

test.describe('boolean — segmented control rendering', () => {
  test('each boolean item renders a .bool-seg container', async ({ page }) => {
    await loadFixture(page);
    await expect(page.locator('.bool-seg')).toHaveCount(3);
  });

  test('each segment group has three buttons', async ({ page }) => {
    await loadFixture(page);
    const firstSeg = page.locator('.bool-seg').first();
    await expect(firstSeg.locator('.bool-seg__btn')).toHaveCount(3);
  });

  test('button labels are Yes / No / Not Answered', async ({ page }) => {
    await loadFixture(page);
    const btns = page.locator('.bool-seg').first().locator('.bool-seg__btn');
    await expect(btns.nth(0)).toHaveText('Yes');
    await expect(btns.nth(1)).toHaveText('No');
    await expect(btns.nth(2)).toHaveText('Not Answered');
  });

  test('item with initial=true shows Yes active', async ({ page }) => {
    await loadFixture(page);
    const smokerSeg = page.locator('[data-preview-id="smoker"] .bool-seg');
    await expect(smokerSeg.locator('.bool-seg__btn--active')).toHaveText('Yes');
  });

  test('item with initial=false shows No active', async ({ page }) => {
    await loadFixture(page);
    const diabeticSeg = page.locator('[data-preview-id="diabetic"] .bool-seg');
    await expect(diabeticSeg.locator('.bool-seg__btn--active')).toHaveText('No');
  });

  test('unanswered item shows Not Answered active', async ({ page }) => {
    await loadFixture(page);
    const consentSeg = page.locator('[data-preview-id="consent"] .bool-seg');
    await expect(consentSeg.locator('.bool-seg__btn--active')).toHaveText('Not Answered');
  });
});

// ── Interaction ───────────────────────────────────────────────────────────────

test.describe('boolean — segmented control interaction', () => {
  test('clicking Yes activates it and deactivates others', async ({ page }) => {
    await loadFixture(page);
    const seg = page.locator('[data-preview-id="consent"] .bool-seg');
    await seg.locator('.bool-seg__btn').nth(0).click();
    await expect(seg.locator('.bool-seg__btn--active')).toHaveText('Yes');
    await expect(seg.locator('.bool-seg__btn--active')).toHaveCount(1);
  });

  test('clicking No activates it', async ({ page }) => {
    await loadFixture(page);
    const seg = page.locator('[data-preview-id="consent"] .bool-seg');
    await seg.locator('.bool-seg__btn').nth(1).click();
    await expect(seg.locator('.bool-seg__btn--active')).toHaveText('No');
  });

  test('clicking Not Answered clears the answer (returns to default state)', async ({ page }) => {
    await loadFixture(page);
    const seg = page.locator('[data-preview-id="smoker"] .bool-seg');
    // smoker starts Yes; click Not Answered
    await expect(seg.locator('.bool-seg__btn--active')).toHaveText('Yes');
    await seg.locator('.bool-seg__btn').nth(2).click();
    await expect(seg.locator('.bool-seg__btn--active')).toHaveText('Not Answered');
  });

  test('aria-pressed reflects active state', async ({ page }) => {
    await loadFixture(page);
    const seg = page.locator('[data-preview-id="consent"] .bool-seg');
    await seg.locator('.bool-seg__btn').nth(1).click(); // No
    const btns = seg.locator('.bool-seg__btn');
    await expect(btns.nth(0)).toHaveAttribute('aria-pressed', 'false');
    await expect(btns.nth(1)).toHaveAttribute('aria-pressed', 'true');
    await expect(btns.nth(2)).toHaveAttribute('aria-pressed', 'false');
  });
});

// ── No checkbox fallback ──────────────────────────────────────────────────────

test.describe('boolean — no legacy checkbox', () => {
  test('no <input type=checkbox> rendered for boolean items', async ({ page }) => {
    await loadFixture(page);
    // scope to preview pane — builder sidebar has its own checkboxes
    await expect(page.locator('#lform input[type="checkbox"]')).toHaveCount(0);
  });
});
