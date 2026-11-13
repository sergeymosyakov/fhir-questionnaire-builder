// ── E2E: shipped templates (real templates/ files, nothing mocked) ────────────
// Inserts each scale from the Add menu, answers it in the preview and checks the
// calculated total / severity and the license shown in the modal.
//
// data-testid registry:
//   add-menu-btn / add-template-btn        Add menu trigger / "From template…"
//   tpl-row-<id>, tpl-detail, templatesModalApply   templates modal
//   tpl-cat-<id> / tpl-group-<id>        category filter chips / group headings in the list
//   tpl-search / tpl-empty               search box / empty state
//   rg-add-btn                           "+ Add another entry" on a repeating group
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
  for (const id of ['phq-9', 'phq-2', 'gad-7', 'gad-2', 'audit-c', 'demographics', 'allergies', 'medications', 'pain', 'glasgow-coma-scale', 'apgar-score', 'qsofa', 'cha2ds2-vasc', 'charlson-comorbidity-index', 'pc-ptsd-5', 'gds-15']) await expect(page.getByTestId('tpl-row-' + id)).toBeVisible();
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

test('PHQ-2 flags a positive screen at 3 or more', async ({ page }) => {
  await insert(page, 'phq-2');
  await pick(page, 'phq2-q1', 1);
  await pick(page, 'phq2-q2', 1);
  await expect(page.locator('[data-preview-id="phq2-total"]')).toContainText('2');
  await expect(page.locator('[data-preview-id="phq2-result"]')).toContainText('Negative screen');
  await pick(page, 'phq2-q2', 2);
  await expect(page.locator('[data-preview-id="phq2-total"]')).toContainText('3');
  await expect(page.locator('[data-preview-id="phq2-result"]')).toContainText('Positive screen');
});

test('GAD-2 flags a positive screen at 3 or more', async ({ page }) => {
  await insert(page, 'gad-2');
  await pick(page, 'gad2-q1', 3);
  await expect(page.locator('[data-preview-id="gad2-total"]')).toBeVisible();
  await expect(page.locator('[data-preview-id="gad2-result"]')).not.toContainText('screen');
  await pick(page, 'gad2-q2', 0);
  await expect(page.locator('[data-preview-id="gad2-total"]')).toContainText('3');
  await expect(page.locator('[data-preview-id="gad2-result"]')).toContainText('Positive screen');
});

test('intake fragments insert as groups with their fields', async ({ page }) => {
  await insert(page, 'demographics');
  for (const id of ['demo-first-name', 'demo-birth-date', 'demo-sex', 'demo-email']) {
    await expect(page.locator(`[data-preview-id="${id}"]`)).toBeVisible();
  }
  await insert(page, 'pain');
  await expect(page.locator('[data-preview-id="pain-severity"]')).toBeVisible();
});

test('Allergies and Medications rows can be added', async ({ page }) => {
  await insert(page, 'allergies');
  await expect(page.locator('[data-preview-id="allergy-substance"]')).toHaveCount(1);
  await page.getByTestId('rg-add-btn').click();
  await expect(page.locator('[data-preview-id="allergy-substance"]')).toHaveCount(2);
  await insert(page, 'medications');
  await expect(page.locator('[data-preview-id="meds-name"]')).toHaveCount(1);
  await page.getByTestId('rg-add-btn').last().click();
  await expect(page.locator('[data-preview-id="meds-name"]')).toHaveCount(2);
});

test('ticking "No known allergies" disables the allergy rows', async ({ page }) => {
  await insert(page, 'allergies');
  await expect(page.locator('[data-preview-id="allergy-substance"]')).toBeVisible();
  await page.locator('[data-preview-id="allergy-none"] .bool-seg__btn').nth(0).click();
  await expect(page.locator('.preview-card').getByText('«allergy-none» ≠ Yes')).toBeVisible();
  await expect(page.locator('input[data-preview-id="allergy-substance"], textarea[data-preview-id="allergy-substance"]')).toHaveCount(0);
  await page.locator('[data-preview-id="allergy-none"] .bool-seg__btn').nth(1).click();
  await expect(page.locator('[data-preview-id="allergy-substance"]')).toBeVisible();
});

test('ticking "Not taking any medications" disables the medication rows', async ({ page }) => {
  await insert(page, 'medications');
  await expect(page.locator('[data-preview-id="meds-name"]')).toBeVisible();
  await page.locator('[data-preview-id="meds-none"] .bool-seg__btn').nth(0).click();
  await expect(page.locator('.preview-card').getByText('«meds-none» ≠ Yes')).toBeVisible();
  await page.locator('[data-preview-id="meds-none"] .bool-seg__btn').nth(1).click();
  await expect(page.locator('[data-preview-id="meds-name"]')).toBeVisible();
});

test('the modal groups templates by category and filters by chip and search', async ({ page }) => {
  await openDropdownItem(page, 'add-menu-btn', 'add-template-btn');
  for (const id of ['scales', 'calculators', 'intake']) await expect(page.getByTestId('tpl-group-' + id)).toBeVisible();
  await page.getByTestId('tpl-cat-calculators').click();
  await expect(page.getByTestId('tpl-row-kidney-function')).toBeVisible();
  await expect(page.getByTestId('tpl-row-phq-9')).toHaveCount(0);
  await expect(page.getByTestId('tpl-cat-calculators')).toHaveAttribute('aria-pressed', 'true');
  await page.getByTestId('tpl-cat-intake').click();
  await page.getByTestId('tpl-search').fill('pain');
  await expect(page.getByTestId('tpl-row-pain')).toBeVisible();
  await expect(page.getByTestId('tpl-row-allergies')).toHaveCount(0);
  await page.getByTestId('tpl-cat-scales').click();
  await expect(page.getByTestId('tpl-empty')).toBeVisible();
  await page.getByTestId('tpl-cat-all').click();
  await expect(page.getByTestId('tpl-row-pain')).toBeVisible();
});

test('a selection hidden by a filter is cleared, and chips keep keyboard focus', async ({ page }) => {
  await openDropdownItem(page, 'add-menu-btn', 'add-template-btn');
  await page.getByTestId('tpl-row-phq-9').click();
  await expect(page.getByTestId('tpl-detail')).toBeVisible();
  await expect(page.getByTestId('templatesModalApply')).toBeEnabled();
  await page.getByTestId('tpl-cat-calculators').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('tpl-cat-calculators')).toBeFocused();
  await expect(page.getByTestId('tpl-detail')).toBeHidden();
  await expect(page.getByTestId('templatesModalApply')).toBeDisabled();
});

test('Glasgow Coma Scale totals the three responses and names the severity', async ({ page }) => {
  await insert(page, 'glasgow-coma-scale');
  await pick(page, 'gcs-eye', 3);
  await pick(page, 'gcs-verbal', 4);
  await pick(page, 'gcs-motor', 5);
  await expect(page.locator('[data-preview-id="gcs-total"]')).toContainText('15');
  await expect(page.locator('[data-preview-id="gcs-severity"]')).toContainText('Mild (GCS 13–15)');
  await pick(page, 'gcs-motor', 0);
  await expect(page.locator('[data-preview-id="gcs-total"]')).toContainText('10');
  await expect(page.locator('[data-preview-id="gcs-severity"]')).toContainText('Moderate (GCS 9–12)');
});

test('Apgar scores the 1-minute and 5-minute sets independently', async ({ page }) => {
  await insert(page, 'apgar-score');
  for (const k of ['color', 'heart-rate', 'tone', 'reflex', 'respiration']) {
    await pick(page, `apgar1-${k}`, 2);
    await pick(page, `apgar5-${k}`, 0);
  }
  await expect(page.locator('[data-preview-id="apgar1-total"]')).toContainText('10');
  await expect(page.locator('[data-preview-id="apgar1-band"]')).toContainText('Reassuring (7–10)');
  await expect(page.locator('[data-preview-id="apgar5-total"]')).toContainText('0');
  await expect(page.locator('[data-preview-id="apgar5-band"]')).toContainText('Low (0–3)');
});

test('PC-PTSD-5 asks the follow-ups only after an event and flags a positive screen at 4 or more', async ({ page }) => {
  await insert(page, 'pc-ptsd-5');
  await expect(page.locator('[data-preview-id="pcptsd5-q1"]')).toBeHidden();
  await pick(page, 'pcptsd5-exposure', 1); // No
  await expect(page.locator('[data-preview-id="pcptsd5-total"]')).toContainText('0');
  await expect(page.locator('[data-preview-id="pcptsd5-result"]')).toContainText('Negative screen');
  await pick(page, 'pcptsd5-exposure', 0); // Yes
  await expect(page.locator('[data-preview-id="pcptsd5-q1"]')).toBeVisible();
  for (let i = 1; i <= 3; i++) await pick(page, `pcptsd5-q${i}`, 0);
  await pick(page, 'pcptsd5-q4', 1);
  await pick(page, 'pcptsd5-q5', 1);
  await expect(page.locator('[data-preview-id="pcptsd5-total"]')).toContainText('3');
  await expect(page.locator('[data-preview-id="pcptsd5-result"]')).toContainText('Negative screen');
  await pick(page, 'pcptsd5-q4', 0);
  await expect(page.locator('[data-preview-id="pcptsd5-total"]')).toContainText('4');
  await expect(page.locator('[data-preview-id="pcptsd5-result"]')).toContainText('Positive screen');
});

test('GDS-15 scores the depressive answers and suggests depression above 5', async ({ page }) => {
  await insert(page, 'gds-15');
  for (let i = 1; i <= 15; i++) await pick(page, `gds15-q${i}`, 1); // all No: only questions 1, 5, 7, 11, 13 score
  await expect(page.locator('[data-preview-id="gds15-total"]')).toContainText('5');
  await expect(page.locator('[data-preview-id="gds15-result"]')).toContainText('Within normal range');
  await pick(page, 'gds15-q2', 0); // Yes on a Yes-keyed question
  await expect(page.locator('[data-preview-id="gds15-total"]')).toContainText('6');
  await expect(page.locator('[data-preview-id="gds15-result"]')).toContainText('Suggests depression');
});
