// ── E2E: Patient View mode ────────────────────────────────────────────────────
//
// Verifies the Patient View toggle:
//   - button appears only after a questionnaire is loaded
//   - toggling on adds `patient-view` CSS class to #lform
//   - nav (↗) buttons are hidden in patient mode
//   - linkId badges are absent in patient mode
//   - enableWhen-dimmed items are excluded in patient mode
//   - toggling off restores builder chrome
//
// Fixture: tests/fixtures/patient-view.fhir.json
//   q1  — boolean, always visible
//   q2  — string, enableWhen q1 = true (starts dimmed)
//   q3  — string, always visible
//
// Run: npx playwright test tests/e2e/patient-view.spec.js
//
// ── data-testid registry ─────────────────────────────────────────────────────
//   patient-view-btn    toggle button in preview header
//   preview-nav-btn     ↗ nav button on each visible preview row
//   preview-linkid      linkId badge on each visible preview row
// ─────────────────────────────────────────────────────────────────────────────

import path from 'node:path';
import { test, expect } from '@playwright/test';

const FIXTURE = path.resolve('tests/fixtures/patient-view.fhir.json');

async function waitForLoad(page) {
  await page.waitForSelector('[data-testid="add-root-group-btn"]', { timeout: 10_000 });
}

async function loadFixture(page) {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/');
  await waitForLoad(page);
  await page.locator('#fhirFileInput').setInputFiles(FIXTURE);
  await expect(page.locator('[data-preview-id="q1"]')).toBeVisible({ timeout: 8_000 });
}

const pvBtn   = page => page.getByTestId('patient-view-btn');
const lform   = page => page.locator('#lform');

// ── 1. Button visibility ──────────────────────────────────────────────────────

test.describe('patient-view-btn visibility', () => {
  test('button is hidden before a questionnaire is loaded', async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
    await page.goto('/');
    await waitForLoad(page);
    await expect(pvBtn(page)).toBeHidden();
  });

  test('button appears after loading a questionnaire', async ({ page }) => {
    await loadFixture(page);
    await expect(pvBtn(page)).toBeVisible();
  });
});

// ── 2. Toggle on ──────────────────────────────────────────────────────────────

test.describe('toggling patient view ON', () => {
  test('lform gains patient-view class after click', async ({ page }) => {
    await loadFixture(page);
    await pvBtn(page).click();
    await expect(lform(page)).toHaveClass(/patient-view/);
  });

  test('nav buttons are not visible in patient mode', async ({ page }) => {
    await loadFixture(page);
    await pvBtn(page).click();
    // All nav buttons should be gone
    await expect(page.getByTestId('preview-nav-btn').first()).not.toBeVisible();
  });

  test('linkId badges are absent in patient mode', async ({ page }) => {
    await loadFixture(page);
    // showLinkId is true by default — badges are present in builder mode
    await expect(page.getByTestId('preview-linkid').first()).toBeVisible();
    await pvBtn(page).click();
    // In patient mode no linkId badges should exist in DOM
    await expect(page.getByTestId('preview-linkid')).toHaveCount(0);
  });

  test('enableWhen-dimmed item (q2) is absent in patient mode', async ({ page }) => {
    await loadFixture(page);
    // q2 starts dimmed (q1 = false) — visible as dim row in builder mode
    await expect(page.locator('[data-preview-id="q2"]')).toBeVisible();
    await pvBtn(page).click();
    // Patient mode hides dimmed items
    await expect(page.locator('[data-preview-id="q2"]')).not.toBeAttached();
  });

  test('always-visible items (q1, q3) remain shown in patient mode', async ({ page }) => {
    await loadFixture(page);
    await pvBtn(page).click();
    await expect(page.locator('[data-preview-id="q1"]')).toBeVisible();
    await expect(page.locator('[data-preview-id="q3"]')).toBeVisible();
  });
});

// ── 3. Toggle off ─────────────────────────────────────────────────────────────

test.describe('toggling patient view OFF', () => {
  test('lform loses patient-view class after second click', async ({ page }) => {
    await loadFixture(page);
    await pvBtn(page).click();
    await expect(lform(page)).toHaveClass(/patient-view/);
    await pvBtn(page).click();
    await expect(lform(page)).not.toHaveClass(/patient-view/);
  });

  test('nav buttons reappear after toggling off', async ({ page }) => {
    await loadFixture(page);
    await pvBtn(page).click();
    await pvBtn(page).click();
    await expect(page.getByTestId('preview-nav-btn').first()).toBeVisible();
  });

  test('dimmed item (q2) returns after toggling off', async ({ page }) => {
    await loadFixture(page);
    await pvBtn(page).click();
    await expect(page.locator('[data-preview-id="q2"]')).not.toBeAttached();
    await pvBtn(page).click();
    await expect(page.locator('[data-preview-id="q2"]')).toBeVisible();
  });
});
