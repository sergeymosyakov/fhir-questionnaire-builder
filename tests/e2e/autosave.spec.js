// ── E2E: Autosave + Storage persistence ───────────────────────────────────────
// Tests user-visible storage behaviours:
//   • Autosave — "Recent draft" item appears when a draft is stored; loads it
//   • Autosave toggle — button state persists across reload
//   • Tooltip toggle — enabled/disabled persists across reload
//   • Panel width — restores saved width on reload
//
// Run: npx playwright test tests/e2e/autosave.spec.js
//
// ── element IDs / testids ────────────────────────────────────────────────────
//   tools-btn           Settings menu trigger (data-testid)
//   autosave-row        Autosave toggle row in Settings menu (data-testid)
//   tips-row            Tips toggle row in Settings menu (data-testid)
//   loadFhirBtn         "Questionnaires ▾" dropdown trigger
//   loadRecentItem      "Recent draft…" item (hidden when no draft)
//   loadRecentSep       separator above recent item
// ─────────────────────────────────────────────────────────────────────────────

import { test, expect } from '@playwright/test';
import { freshStart, addRootGroup, waitForLoad } from './helpers/builder.js';

/** freshStart + add one root group so the Settings menu button becomes visible. */
async function freshStartWithGroup(page) {
  await freshStart(page);
  await addRootGroup(page);
}

const AUTOSAVE_KEY_PREFIX = 'autosave:';
const META_KEY_PREFIX     = 'autosave-meta:';

/** Seed a draft into localStorage before page load. */
function seedDraft(key, title = 'Seeded Draft') {
  return {
    [AUTOSAVE_KEY_PREFIX + key]: JSON.stringify({
      resourceType: 'Questionnaire',
      status: 'draft',
      title,
      item: [{ linkId: '1', type: 'group', text: 'Draft Group' }],
    }),
    [META_KEY_PREFIX + key]: JSON.stringify({
      savedAt: new Date().toISOString(),
      title,
      key,
    }),
  };
}

// ── Autosave draft — load-menu "Recent" entry ─────────────────────────────────

test.describe('Autosave draft', () => {
  test('"Recent draft" item is hidden when no draft exists', async ({ page }) => {
    await freshStart(page);

    await page.locator('#loadFhirBtn').click();
    await expect(page.locator('[data-testid="load-recent-item"]')).not.toBeVisible();
  });

  test('"Recent draft" item is visible when a draft is stored', async ({ page }) => {
    const key   = 'e2e-test-draft-key';
    const items = seedDraft(key, 'E2E Draft');
    await page.addInitScript((data) => {
      localStorage.clear();
      for (const [k, v] of Object.entries(data)) localStorage.setItem(k, v);
    }, items);

    await page.goto('/');
    await waitForLoad(page);

    await page.locator('#loadFhirBtn').click();
    await expect(page.locator('[data-testid="load-recent-item"]')).toBeVisible();
    await expect(page.locator('[data-testid="load-recent-item"]')).toContainText('E2E Draft');
  });

  test('clicking "Recent draft" loads the questionnaire', async ({ page }) => {
    const key   = 'e2e-test-draft-key';
    const items = seedDraft(key, 'E2E Draft');
    await page.addInitScript((data) => {
      localStorage.clear();
      for (const [k, v] of Object.entries(data)) localStorage.setItem(k, v);
    }, items);

    await page.goto('/');
    await waitForLoad(page);

    await page.locator('#loadFhirBtn').click();
    await page.locator('[data-testid="load-recent-item"]').click();

    await expect(
      page.locator('[data-testid="tree-container"] [data-node-id]').first()
    ).toBeVisible({ timeout: 8_000 });
  });
});

// ── Helpers: Settings menu ────────────────────────────────────────────────────

/** Open Settings menu and return the Autosave toggle row. */
async function openSettingsAutosave(page) {
  await page.getByTestId('tools-btn').click();
  const row = page.locator('.settings-toggle-row').filter({ hasText: 'Autosave' });
  await expect(row).toBeVisible({ timeout: 5_000 });
  return row;
}

/** Open Settings menu and return the Tips toggle row. */
async function openSettingsTips(page) {
  await page.getByTestId('tools-btn').click();
  const row = page.locator('.settings-toggle-row').filter({ hasText: 'Tips' });
  await expect(row).toBeVisible({ timeout: 5_000 });
  return row;
}

/** Whether the toggle row currently shows ✓ (active). */
async function isToggleActive(row) {
  const check = await row.locator('[data-role="check"]').textContent();
  return check.trim() === '✓';
}

// ── Autosave toggle ───────────────────────────────────────────────────────────

test.describe('Autosave toggle', () => {
  test('autosave is active (enabled) on first load', async ({ page }) => {
    await freshStartWithGroup(page);
    const row = await openSettingsAutosave(page);
    expect(await isToggleActive(row)).toBe(true);
  });

  test('clicking autosave toggle disables it', async ({ page }) => {
    await freshStartWithGroup(page);
    const row = await openSettingsAutosave(page);
    await row.click();
    expect(await isToggleActive(row)).toBe(false);
  });

  test('autosave disabled state persists across reload', async ({ page }) => {
    await freshStartWithGroup(page);

    // Disable autosave via Settings menu
    let row = await openSettingsAutosave(page);
    await row.click();
    expect(await isToggleActive(row)).toBe(false);
    await page.keyboard.press('Escape');

    // Reload and check state was remembered
    await page.reload();
    await waitForLoad(page);
    await addRootGroup(page);
    row = await openSettingsAutosave(page);
    expect(await isToggleActive(row)).toBe(false);
  });
});

// ── Tooltip toggle ────────────────────────────────────────────────────────────

test.describe('Tooltip toggle', () => {
  test('tips toggle is active on first load', async ({ page }) => {
    await freshStartWithGroup(page);
    const row = await openSettingsTips(page);
    expect(await isToggleActive(row)).toBe(true);
  });

  test('tips disabled state persists across reload', async ({ page }) => {
    await freshStartWithGroup(page);

    let row = await openSettingsTips(page);
    await row.click();
    expect(await isToggleActive(row)).toBe(false);
    await page.keyboard.press('Escape');

    await page.reload();
    await waitForLoad(page);
    await addRootGroup(page);
    row = await openSettingsTips(page);
    expect(await isToggleActive(row)).toBe(false);
  });
});

// ── Panel width ───────────────────────────────────────────────────────────────

test.describe('Panel width persistence', () => {
  test('panel width is restored from storage on reload', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.clear();
      localStorage.setItem('leftPanelWidth', '380');
    });
    await page.goto('/');
    await waitForLoad(page);

    const width = await page.locator('.left-panel').evaluate(
      el => parseInt(window.getComputedStyle(el).width)
    );
    expect(width).toBeCloseTo(380, -1); // within ±10 px
  });
});

// ── Load confirm dialog ───────────────────────────────────────────────────────
// data-testid:
//   load-confirm-proceed-btn   "Load anyway" button
//   load-confirm-cancel-btn    "Cancel" button

test.describe('Load confirm dialog', () => {
  test('no confirm shown when tree is empty (loads immediately)', async ({ page }) => {
    await freshStart(page);
    await page.locator('#loadFhirBtn').click();
    await page.locator('[data-testid="load-library-item"]').click();
    // library modal opens — confirm dialog should NOT appear
    await expect(page.getByTestId('load-confirm-proceed-btn')).not.toBeVisible();
  });

  test('confirm shown when tree has items and library load is triggered', async ({ page }) => {
    await freshStart(page);
    await addRootGroup(page);

    await page.locator('#loadFhirBtn').click();
    await page.locator('[data-testid="load-library-item"]').click();
    await expect(page.getByTestId('load-confirm-proceed-btn')).toBeVisible();
  });

  test('cancel closes confirm and keeps current tree', async ({ page }) => {
    await freshStart(page);
    await addRootGroup(page);
    const before = await page.locator('[data-testid="tree-container"] [data-node-id]').count();

    await page.locator('#loadFhirBtn').click();
    await page.locator('[data-testid="load-library-item"]').click();
    await page.getByTestId('load-confirm-cancel-btn').click();

    await expect(page.getByTestId('load-confirm-proceed-btn')).not.toBeVisible();
    expect(await page.locator('[data-testid="tree-container"] [data-node-id]').count()).toBe(before);
  });

  test('Escape closes confirm and keeps current tree', async ({ page }) => {
    await freshStart(page);
    await addRootGroup(page);
    const before = await page.locator('[data-testid="tree-container"] [data-node-id]').count();

    await page.locator('#loadFhirBtn').click();
    await page.locator('[data-testid="load-library-item"]').click();
    await page.keyboard.press('Escape');

    await expect(page.getByTestId('load-confirm-proceed-btn')).not.toBeVisible();
    expect(await page.locator('[data-testid="tree-container"] [data-node-id]').count()).toBe(before);
  });

  test('proceed dismisses confirm and loads the new questionnaire', async ({ page }) => {
    await freshStart(page);
    await addRootGroup(page);

    await page.locator('#loadFhirBtn').click();
    await page.locator('[data-testid="load-library-item"]').click();
    await page.getByTestId('load-confirm-proceed-btn').click();

    // library modal should now be open
    await expect(page.locator('[data-sample]').first()).toBeVisible({ timeout: 8_000 });
  });
});
