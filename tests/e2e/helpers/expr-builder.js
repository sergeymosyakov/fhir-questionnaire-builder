// Shared helpers for specs that build calculations in the Expression Builder from scratch.
import { expect } from '@playwright/test';
import { clickAddRootGroup } from './builder.js';
import { pickCustomSelect } from './dropdown.js';

export const modal = (page) => page.getByTestId('expressionBuilderModal');

async function setTitle(page, nodeId, title) {
  const item = page.locator(`[data-node-id="${nodeId}"]`);
  await expect(item.getByTestId('node-title-display')).toBeVisible();
  await expect(async () => {
    await item.getByTestId('node-title-display').click();
    await expect(item.getByTestId('node-title-input')).toBeVisible();
  }).toPass();
  await item.getByTestId('node-title-input').fill(title);
  await item.getByTestId('node-title-input').blur();
}

async function addItem(page, nodeId, title) {
  await page.locator('[data-node-id="1"]').getByTestId('group-add-btn').first().click();
  await page.getByTestId('add-menu-item').first().click();
  await setTitle(page, nodeId, title);
}

async function setType(page, nodeId, type) {
  await page.locator(`[data-node-id="${nodeId}"]`).getByTestId('action-type').click();
  await expect(page.getByTestId('answerTypeModal')).toBeVisible();
  await pickCustomSelect(page, 'type-select', type);
  await page.getByTestId('answerTypeModalApply').click();
  await expect(page.getByTestId('answerTypeModal')).toBeHidden();
}

// One group "1" holding `fields` ([{ title, type }]) as 1.1, 1.2, …
export async function makeForm(page, fields) {
  await clickAddRootGroup(page);
  await expect(page.locator('[data-node-id="1"]')).toBeVisible();
  for (const [i, f] of fields.entries()) await addItem(page, `1.${i + 1}`, f.title);
  for (const [i, f] of fields.entries()) await setType(page, `1.${i + 1}`, f.type);
}

export async function openBuilder(page, nodeId) {
  await page.locator(`[data-node-id="${nodeId}"]`).getByTestId('action-expr').click();
  await expect(page.getByTestId('expressionModal')).toBeVisible();
  await page.getByTestId('expr-calc-ta-build-btn').click();
  await expect(modal(page)).toBeVisible();
  await page.getByTestId('eb-choose-number').click();
}

export const applyAndSave = async (page) => {
  await page.getByTestId('expressionBuilderModalApply').click();
  await page.getByTestId('expressionModalApply').click();
  await expect(page.getByTestId('expressionModal')).toBeHidden();
};

// Fill a preview input and commit it (blur through the real search input).
export async function answer(page, nodeId, value) {
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await page.locator(`[data-preview-id="${nodeId}"] input`).fill(String(value));
  await page.getByTestId('preview-search-input').click();
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
}

// ── Building blocks by hand ─────────────────────────────────────────────────
// A chain is the element holding operands and the operators between them as direct children.
export const topChain = (page) => modal(page).getByTestId('eb-chain');
export const operandOf = (chain, i) => chain.locator(':scope > [data-testid="eb-operand"]').nth(i);
export const operatorOf = (chain, i) => chain.locator(':scope > [data-testid="eb-arith-op"]').nth(i);

export const pickKind = (page, operand, kind) => pickCustomSelect(page, operand.getByTestId('eb-operand-kind').first(), kind);
export const pickQuestion = (page, operand, id) => pickCustomSelect(page, operand.getByTestId('eb-operand-item').first(), id);
export const setNumber = (operand, n) => operand.getByTestId('eb-operand-num').first().fill(String(n));

// Pick the 15th of the month the date picker opens on; returns the chosen date (YYYY-MM-DD).
export async function answerDate(page, nodeId) {
  const trigger = page.locator(`[data-preview-id="${nodeId}"]`).getByTestId('date-input');
  const cal = page.getByTestId('dp-cal');
  await expect(async () => { // a re-render right after the form is built can swallow the first click
    await trigger.click();
    await expect(cal).toBeVisible({ timeout: 2_000 });
    await cal.getByTestId('dp-day').filter({ hasText: /^15$/ }).click();
    await expect(trigger).toHaveAttribute('data-value', /^\d{4}-\d\d-\d\d$/, { timeout: 2_000 });
  }).toPass();
  return trigger.getAttribute('data-value');
}

// `date` (YYYY-MM-DD) moved by `days`.
export const addDays = (date, days) => {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
};

// A calculated date shows as a value only on a read-only field (as the templates set it).
export async function makeReadOnly(page, nodeId) {
  await page.locator(`[data-node-id="${nodeId}"]`).getByTestId('action-states').first().click();
  await expect(page.getByTestId('statesModal')).toBeVisible();
  await page.getByTestId('states-readonly-chk').check();
  await page.getByTestId('statesModalApply').click();
  await expect(page.getByTestId('statesModal')).toBeHidden();
}

// A new field at the end of the group `groupId` of a loaded template; returns its node id.
export async function addField(page, groupId, title, type) {
  const ids = () => page.locator('[data-node-id]').evaluateAll((els) => els.map((e) => e.dataset.nodeId));
  const before = new Set(await ids());
  await page.locator(`[data-node-id="${groupId}"]`).getByTestId('group-add-btn').first().click();
  await page.getByTestId('add-menu-item').first().click();
  // a new field is numbered "<group>.<n>"; template fields keep their own linkIds, even if the group was collapsed before
  const fresh = async () => (await ids()).filter((id) => !before.has(id) && id.startsWith(groupId + '.'));
  await expect.poll(async () => (await fresh()).length).toBe(1);
  const nodeId = (await fresh())[0];
  await setTitle(page, nodeId, title);
  await setType(page, nodeId, type);
  return nodeId;
}

// Marks a group or question repeatable (Repeatable action → toggle → Apply).
export async function makeRepeatable(page, id) {
  await page.locator(`[data-node-id="${id}"]`).getByTestId('action-repeatable').first().click();
  await page.getByTestId('repeat-modal-toggle').check();
  await page.getByTestId('repeatableModalApply').click();
  await expect(page.getByTestId('repeatableModal')).toBeHidden();
}
