// ── E2E: shipped templates (real templates/ files, nothing mocked) ────────────
// Inserts each scale from the Add menu, answers it in the preview and checks the
// calculated total / severity and the license shown in the modal.
//
// data-testid registry:
//   add-menu-btn / add-template-btn        Add menu trigger / "From template…"
//   tpl-row-<id>, tpl-detail, templatesModalApply   templates modal
// Preview radio rows (.radio-label) are the sanctioned non-testid exception.
// ─────────────────────────────────────────────────────────────────────────────

import { test, expect } from '@playwright/test';
import { freshStart } from './helpers/builder.js';
import { openDropdownItem } from './helpers/dropdown.js';

async function insert(page, id) {
  await openDropdownItem(page, 'add-menu-btn', 'add-template-btn');
  await page.getByTestId('tpl-row-' + id).click();
  await page.getByTestId('templatesModalApply').click();
  await expect(page.getByTestId('templatesModal')).toBeHidden();
}

// Pick the option with the given 0-based index for a choice question.
async function pick(page, previewId, index) {
  await page.locator(`[data-preview-id="${previewId}"] .radio-label`).nth(index).click();
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
  await freshStart(page);
});

test('library lists the shipped scales with source and license', async ({ page }) => {
  await openDropdownItem(page, 'add-menu-btn', 'add-template-btn');
  for (const id of ['phq-9', 'gad-7', 'audit-c']) await expect(page.getByTestId('tpl-row-' + id)).toBeVisible();
  await page.getByTestId('tpl-row-phq-9').click();
  await expect(page.getByTestId('tpl-detail')).toContainText('Kroenke, Spitzer & Williams 2001');
  await expect(page.getByTestId('tpl-detail')).toContainText('No permission required to reproduce');
  await page.getByTestId('tpl-row-audit-c').click();
  await expect(page.getByTestId('tpl-detail')).toContainText('No restrictions on use');
});

test('PHQ-9 totals the answers and names the severity band', async ({ page }) => {
  await insert(page, 'phq-9');
  for (let i = 1; i <= 9; i++) await pick(page, `phq9-q${i}`, 3); // "Nearly every day" = 3 each
  await expect(page.locator('[data-preview-id="phq9-total"]')).toContainText('27');
  await expect(page.locator('[data-preview-id="phq9-severity"]')).toContainText('Severe depression');
  await pick(page, 'phq9-q1', 0);
  await pick(page, 'phq9-q2', 0);
  await expect(page.locator('[data-preview-id="phq9-total"]')).toContainText('21');
});

test('PHQ-9 shows no total until every scored question is answered', async ({ page }) => {
  await insert(page, 'phq-9');
  await pick(page, 'phq9-q1', 2);
  await expect(page.locator('[data-preview-id="phq9-severity"]')).not.toContainText('depression');
});

test('GAD-7 totals the answers and names the severity band', async ({ page }) => {
  await insert(page, 'gad-7');
  for (let i = 1; i <= 7; i++) await pick(page, `gad7-q${i}`, 2); // 2 each = 14
  await expect(page.locator('[data-preview-id="gad7-total"]')).toContainText('14');
  await expect(page.locator('[data-preview-id="gad7-severity"]')).toContainText('Moderate anxiety');
});

test('AUDIT-C totals its three answers', async ({ page }) => {
  await insert(page, 'audit-c');
  await pick(page, 'auditc-q1', 4);
  await pick(page, 'auditc-q2', 2);
  await pick(page, 'auditc-q3', 1);
  await expect(page.locator('[data-preview-id="auditc-total"]')).toContainText('7');
});

test('a second PHQ-9 gets fresh ids and scores from its own answers', async ({ page }) => {
  await insert(page, 'phq-9');
  await insert(page, 'phq-9');
  const q1s = page.locator('[data-preview-id^="phq9-q1"]');
  await expect(q1s).toHaveCount(2);
  const ids = await q1s.evaluateAll(els => els.map(e => e.dataset.previewId));
  const suffix = ids.find(id => id !== 'phq9-q1').slice('phq9-q1'.length);
  for (let i = 1; i <= 9; i++) await pick(page, `phq9-q${i}`, 0);
  for (let i = 1; i <= 9; i++) await pick(page, `phq9-q${i}${suffix}`, 3);
  await expect(page.locator('[data-preview-id="phq9-total"]')).toContainText('0');
  await expect(page.locator(`[data-preview-id="phq9-total${suffix}"]`)).toContainText('27');
  await expect(page.locator(`[data-preview-id="phq9-severity${suffix}"]`)).toContainText('Severe depression');
});
