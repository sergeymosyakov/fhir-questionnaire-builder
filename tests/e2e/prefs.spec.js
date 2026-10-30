// ── E2E: User preferences persistence (js/ui/prefs.js) ───────────────────────
// Settings-menu toggles are backed by localStorage; the choice must survive a
// reload. Validation toggles go through Prefs ('fhirqb.<key>'); the Tips toggle
// persists through the tooltip module ('tooltips-enabled') and gates tooltips.
//
// Run: npx playwright test tests/e2e/prefs.spec.js
//
// ── data-testid registry ─────────────────────────────────────────────────────
//   add-root-group-btn                  app-ready marker
//   tools-btn                           Settings ▾ dropdown trigger
//   settings-tips-check                 "Tips" checkbox row
//   settings-validate-local-check       "Local validation" checkbox row
//   settings-validate-external-check    "Server validation" checkbox row
//   settings-validate-audit-check       "Quality audit" checkbox row
//   rich-tooltip                        floating tooltip element (appended to <body>)
// ─────────────────────────────────────────────────────────────────────────────

import { test, expect } from '@playwright/test';
import { freshStart, addRootGroup } from './helpers/builder.js';

const ls = (page, key) => page.evaluate(k => localStorage.getItem(k), key);
const checkbox = (page, rowTestId) => page.getByTestId(rowTestId).getByRole('checkbox');

// The Settings menu is hidden until the tree has a node; open it retry-safely
// (the toggle flips, so click only while the row is hidden).
async function openSettings(page) {
  await expect(page.getByTestId('tools-btn')).toBeVisible();
  await expect(async () => {
    if (!(await page.getByTestId('settings-tips-check').isVisible())) {
      await page.getByTestId('tools-btn').click();
    }
    await expect(page.getByTestId('settings-tips-check')).toBeVisible();
  }).toPass();
}

async function reloadAndOpenSettings(page) {
  await page.reload();
  await expect(page.getByTestId('add-root-group-btn')).toBeVisible();
  await addRootGroup(page);
  await openSettings(page);
}

test.describe('Preferences persistence', () => {
  test.beforeEach(async ({ page }) => {
    // Clear only on the first navigation so a reload keeps what the test stored.
    await page.addInitScript(() => {
      if (!sessionStorage.getItem('__prefs-init')) {
        localStorage.clear();
        sessionStorage.setItem('__prefs-init', '1');
      }
    });
    await freshStart(page);
    await addRootGroup(page);
  });

  test('defaults: local validation, quality audit and tips on; server validation off', async ({ page }) => {
    await openSettings(page);
    await expect(checkbox(page, 'settings-validate-local-check')).toBeChecked();
    await expect(checkbox(page, 'settings-validate-audit-check')).toBeChecked();
    await expect(checkbox(page, 'settings-tips-check')).toBeChecked();
    await expect(checkbox(page, 'settings-validate-external-check')).not.toBeChecked();
  });

  test('validation toggles are written to localStorage and restored after reload', async ({ page }) => {
    await openSettings(page);
    await checkbox(page, 'settings-validate-external-check').check();
    await checkbox(page, 'settings-validate-audit-check').uncheck();
    await checkbox(page, 'settings-validate-local-check').uncheck();

    expect(await ls(page, 'fhirqb.validateExternal')).toBe('true');
    expect(await ls(page, 'fhirqb.validateAudit')).toBe('false');
    expect(await ls(page, 'fhirqb.validate')).toBe('false');

    await reloadAndOpenSettings(page);
    await expect(checkbox(page, 'settings-validate-external-check')).toBeChecked();
    await expect(checkbox(page, 'settings-validate-audit-check')).not.toBeChecked();
    await expect(checkbox(page, 'settings-validate-local-check')).not.toBeChecked();
  });

  test('turning Tips off hides tooltips and stays off after reload', async ({ page }) => {
    // Baseline: with tips on, hovering a tipped control shows the tooltip.
    await page.getByTestId('add-root-group-btn').hover();
    await expect(page.getByTestId('rich-tooltip')).toBeVisible();

    await openSettings(page);
    await checkbox(page, 'settings-tips-check').uncheck();
    await expect.poll(() => ls(page, 'tooltips-enabled')).toBe('false');
    await expect(page.getByTestId('rich-tooltip')).toBeHidden();

    await reloadAndOpenSettings(page);
    await expect(checkbox(page, 'settings-tips-check')).not.toBeChecked();
    await page.getByTestId('add-root-group-btn').hover();
    await expect(page.getByTestId('rich-tooltip')).toBeHidden();
  });
});
