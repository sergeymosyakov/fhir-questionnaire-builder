// ── E2E: builder tree keyboard accessibility (a11y) ──────────────────────────
// The left-panel builder nodes are operable by keyboard:
//   • node title (click-to-edit) is role="button" and opens on Enter/Space
//   • the ⚙ gear button exposes aria-haspopup/aria-expanded
//   • gear menu items are role="menuitem", keyboard-reachable (tabindex=0)
//   • Escape closes the gear menu and returns focus to the button
//
// data-testid registry:
//   fhir-file-input     — questionnaire file input
//   tree-container      — builder tree wrapper (left panel)
//   node-title-display  — read-only node title span
//   node-title-input    — inline title textarea
//   node-gear-btn       — ⚙ node actions button
// ─────────────────────────────────────────────────────────────────────────────

import { test, expect } from '@playwright/test';
import path from 'node:path';
import { freshStart } from './helpers/builder.js';

const FIXTURE = path.resolve('sampledata/annual-health-check.fhir.json');

async function load(page) {
  await freshStart(page);
  await page.locator('[data-testid="fhir-file-input"]').setInputFiles(FIXTURE);
  await page.waitForSelector('[data-testid="tree-container"] [data-node-id]', { timeout: 15_000 });
}

test.describe('builder tree keyboard accessibility', () => {
  test('node title is a keyboard-activatable button', async ({ page }) => {
    await load(page);
    const node = page.locator('[data-node-id="height"]');
    const title = node.getByTestId('node-title-display').first();
    await expect(title).toHaveAttribute('role', 'button');

    // A re-render right after load can swallow the key; retry until edit engages.
    await expect(async () => {
      await title.press('Enter');
      await expect(node.getByTestId('node-title-input').first()).toBeVisible({ timeout: 1000 });
    }).toPass();
  });

  test('gear button exposes menu ARIA; items are keyboard-reachable; Escape closes', async ({ page }) => {
    await load(page);
    const node = page.locator('[data-node-id="height"]');
    const gear = node.getByTestId('node-gear-btn').first();
    await expect(gear).toHaveAttribute('aria-haspopup', 'menu');
    await expect(gear).toHaveAttribute('aria-expanded', 'false');

    await gear.click();
    await expect(gear).toHaveAttribute('aria-expanded', 'true');

    const menu = node.locator('.node-gear-menu').first();
    await expect(menu).toHaveAttribute('role', 'menu');
    const item = menu.locator('[role="menuitem"]').first();
    await expect(item).toBeVisible();
    await expect(item).toHaveAttribute('tabindex', '0');

    await page.keyboard.press('Escape');
    await expect(gear).toHaveAttribute('aria-expanded', 'false');
  });
});
