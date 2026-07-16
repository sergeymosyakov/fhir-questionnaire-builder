// ── E2E: individual collapse/expand toggle in the preview ────────────────────
// Regression: after the fast-path render optimisation, clicking a single group's
// ▼/▶ collapse toggle in the preview had no effect — toggling _previewCollapsed
// only dispatched RESPONSE_CHANGED, but the fast-path signature (nodesSig) did
// not include the collapse state, so the values-only fast path was taken and the
// DOM was never rebuilt. Collapse All / Expand All still worked (they force a
// full rebuild). This test proves the per-group toggle hides/shows its child.
//
// Run: npx playwright test tests/e2e/preview-collapse-toggle.spec.js
//
// data-testid / selector registry:
//   add-root-group-btn      "+ Add Root Group" button
//   group-add-btn           "+" add-child button on a group
//   add-menu-item           "Item" option in the add-child menu
//   [data-preview-id="…"]   a rendered preview row
//   .preview-collapse-toggle ▼/▶ toggle inserted as first child of a group row

import { test, expect } from '@playwright/test';
import { freshStart, addRootGroup, addItemToGroup } from './helpers/builder.js';

test.describe('Preview — individual collapse/expand toggle', () => {
  test('clicking a group toggle hides its child, clicking again shows it', async ({ page }) => {
    await freshStart(page);
    await addRootGroup(page);          // group "1"
    await addItemToGroup(page, '1');   // item "1.1" (asserts preview row visible)

    const groupRow = page.locator('[data-preview-id="1"]');
    const childRow = page.locator('[data-preview-id="1.1"]');
    const toggle   = groupRow.locator('.preview-collapse-toggle');

    await expect(groupRow).toBeVisible();
    await expect(toggle).toBeVisible();
    await expect(childRow).toBeVisible();

    // Collapse: child must disappear (full rebuild forced by collapse-aware signature)
    await toggle.click();
    await expect(childRow).toHaveCount(0);
    // The group row itself stays; the toggle now shows the expand glyph.
    await expect(groupRow).toBeVisible();
    await expect(groupRow.locator('.preview-collapse-toggle')).toHaveText('\u25B6');

    // Expand: child comes back
    await groupRow.locator('.preview-collapse-toggle').click();
    await expect(page.locator('[data-preview-id="1.1"]')).toBeVisible();
    await expect(page.locator('[data-preview-id="1"] .preview-collapse-toggle')).toHaveText('\u25BC');
  });
});
