// ── E2E: Date/time picker — year/month drill-down + scroll repositioning ──────
// Covers issue #108: fast year navigation, and the popup tracking its field
// when the containing panel scrolls.
//
// Run: npx playwright test tests/e2e/date-picker.spec.js
//
// ── data-testid registry ──────────────────────────────────────────────────────
//   add-root-group-btn   "+Add Root Group"
//   group-add-btn         "+" button on a group
//   add-menu-item         "Item" option in add-child menu
//   action-type            "Answer Type" action link
//   answerTypeModal        Answer Type modal backdrop
//   type-select             custom type dropdown inside Answer Type modal
//   answerTypeModalApply    Apply button
//   date-input               date-picker trigger (preview)
// ─────────────────────────────────────────────────────────────────────────────

import { test, expect } from '@playwright/test';

async function waitForLoad(page) {
  await page.waitForSelector('[data-testid="add-root-group-btn"]', { timeout: 10_000 });
}

async function freshStart(page) {
  await page.goto('/');
  await waitForLoad(page);
}

async function addItem(page, groupNodeId, nth) {
  const group = page.locator(`[data-node-id="${groupNodeId}"]`);
  await group.getByTestId('group-add-btn').click();
  await page.locator('[data-testid="add-menu-item"]').filter({ visible: true }).first().click();
  const nodeId = `${groupNodeId}.${nth}`;
  await expect(page.locator(`[data-node-id="${nodeId}"]`)).toBeVisible();
  return nodeId;
}

async function setDateType(page, nodeId) {
  const link = page.locator(`[data-node-id="${nodeId}"]`).getByTestId('action-type');
  await expect(async () => {
    await link.click();
    await expect(page.getByTestId('answerTypeModal')).toBeVisible();
  }).toPass();
  await page.getByTestId('type-select').click();
  await page.locator('[data-testid="csel-drop"] [data-val="date"]').click();
  await page.getByTestId('answerTypeModalApply').click();
  await expect(page.getByTestId('answerTypeModal')).not.toBeVisible();
}

// Vertical gap between two bounding boxes, regardless of which sits above the other.
function verticalGap(a, b) {
  if (a.y + a.height <= b.y) return b.y - (a.y + a.height);
  if (b.y + b.height <= a.y) return a.y - (b.y + b.height);
  return 0;
}

test.describe('Date picker', () => {
  test('drill-down: day view -> months -> years -> pick year -> pick month -> pick day', async ({ page }) => {
    await freshStart(page);
    await page.getByTestId('add-root-group-btn').click();
    const itemId = await addItem(page, '1', 1);
    await setDateType(page, itemId);

    const trigger = page.locator(`[data-preview-id="${itemId}"]`).getByTestId('date-input');
    await trigger.click();

    const cal = page.locator('.dp-cal');
    await expect(cal).toBeVisible();

    // Day view -> click header -> months view (12 cells)
    await cal.locator('.dp-month-lbl').click();
    await expect(cal.locator('.dp-grid--4col .dp-cell')).toHaveCount(12);

    // Months view -> click year header -> years view (12 cells)
    await cal.locator('.dp-month-lbl').click();
    const yearCells = cal.locator('.dp-grid--4col .dp-cell');
    await expect(yearCells).toHaveCount(12);
    const pickedYear = (await yearCells.first().textContent()).trim();
    await yearCells.first().click();

    // Back in months view, header shows the picked year
    await expect(cal.locator('.dp-month-lbl')).toHaveText(pickedYear);
    await cal.locator('.dp-grid--4col .dp-cell').first().click(); // January

    // Back in day view, header shows "January <year>"
    await expect(cal.locator('.dp-month-lbl')).toHaveText(`January ${pickedYear}`);

    await cal.locator('.dp-day').filter({ hasText: /^15$/ }).click();
    await expect(cal).not.toBeVisible();
    await expect(trigger).toHaveAttribute('data-value', `${pickedYear}-01-15`);
  });

  test('can select a specific month from the months grid', async ({ page }) => {
    await freshStart(page);
    await page.getByTestId('add-root-group-btn').click();
    const itemId = await addItem(page, '1', 1);
    await setDateType(page, itemId);

    const trigger = page.locator(`[data-preview-id="${itemId}"]`).getByTestId('date-input');
    await trigger.click();
    const cal = page.locator('.dp-cal');
    await cal.locator('.dp-month-lbl').click(); // -> months view

    const monthCells = cal.locator('.dp-grid--4col .dp-cell');
    await expect(monthCells).toHaveCount(12);
    const yearLabel = (await cal.locator('.dp-month-lbl').textContent()).trim();
    await monthCells.nth(5).click(); // June

    // Back in day view, header shows "June <year>"
    await expect(cal.locator('.dp-month-lbl')).toHaveText(`June ${yearLabel}`);

    await cal.locator('.dp-day').filter({ hasText: /^10$/ }).click();
    await expect(cal).not.toBeVisible();
    await expect(trigger).toHaveAttribute('data-value', `${yearLabel}-06-10`);
  });

  test('can select a specific year from the years grid', async ({ page }) => {
    await freshStart(page);
    await page.getByTestId('add-root-group-btn').click();
    const itemId = await addItem(page, '1', 1);
    await setDateType(page, itemId);

    const trigger = page.locator(`[data-preview-id="${itemId}"]`).getByTestId('date-input');
    await trigger.click();
    const cal = page.locator('.dp-cal');
    await cal.locator('.dp-month-lbl').click(); // -> months
    await cal.locator('.dp-month-lbl').click(); // -> years

    const yearCells = cal.locator('.dp-grid--4col .dp-cell');
    await expect(yearCells).toHaveCount(12);
    const pickedYear = (await yearCells.nth(11).textContent()).trim(); // last cell in the grid
    await yearCells.nth(11).click();

    // Back in months view, header shows the exact picked year
    await expect(cal.locator('.dp-month-lbl')).toHaveText(pickedYear);

    await cal.locator('.dp-grid--4col .dp-cell').nth(2).click(); // March
    await expect(cal.locator('.dp-month-lbl')).toHaveText(`March ${pickedYear}`);

    await cal.locator('.dp-day').filter({ hasText: /^5$/ }).click();
    await expect(cal).not.toBeVisible();
    await expect(trigger).toHaveAttribute('data-value', `${pickedYear}-03-05`);
  });

  test('years view pages by 12 years with the prev/next buttons', async ({ page }) => {
    await freshStart(page);
    await page.getByTestId('add-root-group-btn').click();
    const itemId = await addItem(page, '1', 1);
    await setDateType(page, itemId);

    const trigger = page.locator(`[data-preview-id="${itemId}"]`).getByTestId('date-input');
    await trigger.click();
    const cal = page.locator('.dp-cal');
    await cal.locator('.dp-month-lbl').click(); // -> months
    await cal.locator('.dp-month-lbl').click(); // -> years

    const rangeBefore = (await cal.locator('.dp-month-lbl').textContent()).trim();
    await cal.locator('.dp-nav-btn').first().click(); // prev 12 years
    const rangeAfter = (await cal.locator('.dp-month-lbl').textContent()).trim();
    expect(rangeAfter).not.toBe(rangeBefore);
  });

  test('popup stays anchored to its field when the panel scrolls', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 500 });
    await freshStart(page);
    await page.getByTestId('add-root-group-btn').click();
    let lastId = '1';
    for (let i = 1; i <= 8; i++) {
      lastId = await addItem(page, '1', i);
    }
    await setDateType(page, lastId);

    const panel = page.locator('.right-panel-body');
    await panel.evaluate(el => { el.scrollTop = el.scrollHeight; });

    const trigger = page.locator(`[data-preview-id="${lastId}"]`).getByTestId('date-input');
    await trigger.click();
    const cal = page.locator('.dp-cal');
    await expect(cal).toBeVisible();

    const triggerBefore = await trigger.boundingBox();
    const calBefore     = await cal.boundingBox();
    expect(verticalGap(calBefore, triggerBefore)).toBeLessThan(10);

    await panel.evaluate(el => { el.scrollTop -= 200; });

    const triggerAfter = await trigger.boundingBox();
    const calAfter     = await cal.boundingBox();
    expect(Math.abs(triggerAfter.y - triggerBefore.y)).toBeGreaterThan(50); // sanity: scroll actually moved it
    expect(verticalGap(calAfter, triggerAfter)).toBeLessThan(10);           // popup followed
  });
});
