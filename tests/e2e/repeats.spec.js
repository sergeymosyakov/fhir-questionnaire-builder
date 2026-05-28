// ── E2E: Repeatable (item.repeats) ────────────────────────────────────────────
// Tests for the "Repeatable" action toggle on item nodes and the resulting
// preview badge, plus import/export round-trip via the in-browser flow.
//
// Run: npx playwright test tests/e2e/repeats.spec.js
//
// ── data-testid used in this suite ───────────────────────────────────────────
//   add-root-group-btn      "+Add Root Group"
//   group-add-btn           "+" button on a group
//   add-menu-item           "Item" in add-child menu
//   action-repeatable       "Repeatable" action link on an item
//   preview-repeats-badge   "⇄ repeatable" badge in the preview panel
// ─────────────────────────────────────────────────────────────────────────────

import { test, expect } from '@playwright/test';

// ── Helpers ───────────────────────────────────────────────────────────────────

async function waitForLoad(page) {
  await page.waitForSelector('[data-testid="add-root-group-btn"]', { timeout: 10_000 });
}

async function freshStart(page) {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/');
  await waitForLoad(page);
}

async function addTextItem(page) {
  await page.getByTestId('add-root-group-btn').click();
  await expect(page.locator('[data-node-id="1"]')).toBeVisible();
  await page.locator('[data-node-id="1"]').getByTestId('group-add-btn').click();
  await page.locator('[data-testid="add-menu-item"]').first().click();
  await expect(page.locator('[data-node-id="1.1"]')).toBeVisible();
}

const repeatableLink  = (page) => page.locator('[data-node-id="1.1"]').getByTestId('action-repeatable');

// ── Tests ──────────────────────────────────────────────────────────────────────

test.describe('Repeatable toggle — builder', () => {
  test('"Repeatable" action link is present on an item node', async ({ page }) => {
    await freshStart(page);
    await addTextItem(page);
    await expect(repeatableLink(page)).toBeVisible();
    await expect(repeatableLink(page)).toContainText('Repeatable');
  });

  test('"Repeatable" link is inactive by default', async ({ page }) => {
    await freshStart(page);
    await addTextItem(page);
    await expect(repeatableLink(page)).not.toHaveClass(/action-edit--active/);
  });

  test('clicking "Repeatable" opens the modal', async ({ page }) => {
    await freshStart(page);
    await addTextItem(page);
    await repeatableLink(page).click();
    await expect(page.locator('[data-testid="repeatableModal"]')).toBeVisible();
    await page.locator('[data-testid="repeatableModalCancel"]').click();
    await expect(page.locator('[data-testid="repeatableModal"]')).not.toBeVisible();
  });

  test('enabling repeats in modal activates the link', async ({ page }) => {
    await freshStart(page);
    await addTextItem(page);
    await repeatableLink(page).click();
    await page.locator('[data-testid="repeat-modal-toggle"]').check();
    await page.locator('[data-testid="repeatableModalApply"]').click();
    await expect(repeatableLink(page)).toHaveClass(/action-edit--active/);
  });

  test('disabling repeats in modal deactivates the link', async ({ page }) => {
    await freshStart(page);
    await addTextItem(page);
    // Enable first
    await repeatableLink(page).click();
    await page.locator('[data-testid="repeat-modal-toggle"]').check();
    await page.locator('[data-testid="repeatableModalApply"]').click();
    await expect(repeatableLink(page)).toHaveClass(/action-edit--active/);
    // Disable
    await repeatableLink(page).click();
    await page.locator('[data-testid="repeat-modal-toggle"]').uncheck();
    await page.locator('[data-testid="repeatableModalApply"]').click();
    await expect(repeatableLink(page)).not.toHaveClass(/action-edit--active/);
  });
});

test.describe('Repeatable toggle — preview', () => {
  test('"+ Add another" button appears in preview after enabling', async ({ page }) => {
    await freshStart(page);
    await addTextItem(page);
    await expect(page.getByTestId('repeat-add-btn')).not.toBeVisible();
    await repeatableLink(page).click();
    await page.locator('[data-testid="repeat-modal-toggle"]').check();
    await page.locator('[data-testid="repeatableModalApply"]').click();
    await expect(page.getByTestId('repeat-add-btn')).toBeVisible();
  });

  test('"+ Add another" button disappears after disabling', async ({ page }) => {
    await freshStart(page);
    await addTextItem(page);
    // Enable
    await repeatableLink(page).click();
    await page.locator('[data-testid="repeat-modal-toggle"]').check();
    await page.locator('[data-testid="repeatableModalApply"]').click();
    await expect(page.getByTestId('repeat-add-btn')).toBeVisible();
    // Disable
    await repeatableLink(page).click();
    await page.locator('[data-testid="repeat-modal-toggle"]').uncheck();
    await page.locator('[data-testid="repeatableModalApply"]').click();
    await expect(page.getByTestId('repeat-add-btn')).not.toBeVisible();
  });
});

test.describe('Repeatable — import round-trip', () => {
  test('item with repeats:true loads with Repeatable link active', async ({ page }) => {
    await freshStart(page);

    const fhirJson = JSON.stringify({
      resourceType: 'Questionnaire',
      id: 'repeats-test',
      title: 'Repeats Test',
      status: 'draft',
      item: [{
        linkId: 'q1',
        text: 'How many times?',
        type: 'integer',
        repeats: true
      }]
    });

    // Inject directly via the hidden file input (same pattern as builder.spec.js)
    await page.locator('[data-testid="fhir-file-input"]').setInputFiles({
      name: 'repeats-test.json',
      mimeType: 'application/json',
      buffer: Buffer.from(fhirJson),
    });

    // After import, node q1 should exist and Repeatable must be active
    await expect(page.locator('[data-node-id="q1"]')).toBeVisible();
    const link = page.locator('[data-node-id="q1"]').getByTestId('action-repeatable');
    await expect(link).toHaveClass(/action-edit--active/);
  });
});
