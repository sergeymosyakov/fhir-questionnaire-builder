// ── E2E: Contained resources — add / edit / remove via UI ─────────────────────
// The Contained panel is editable: paste a FHIR resource (raw JSON) into
// Questionnaire.contained[], edit or remove it, and reference an added ValueSet
// from a choice item's answerValueSet.
//
// Run: npx playwright test tests/e2e/contained-add.spec.js
//
// data-testid registry:
//   contained-add-btn            "+ Add" button in the Contained card header
//   containedResourceModal       editor modal backdrop
//   contained-json-input         JSON textarea
//   contained-json-error         inline validation error
//   containedResourceModalApply  Apply button
//   containedResourceModalCancel Cancel button
//   contained-edit-<i>           per-chip edit button
//   contained-remove-<i>         per-chip remove button
//   contained-empty              empty-state text

import { test, expect } from '@playwright/test';

const card   = (page) => page.locator('#containedCard');
const count  = (page) => page.locator('#containedCardCount');
const chips  = (page) => page.locator('#containedCardChips');
const modal  = (page) => page.getByTestId('containedResourceModal');

const vsJson = (id, title = 'Test VS') =>
  JSON.stringify({ resourceType: 'ValueSet', id, status: 'active', title }, null, 2);

async function freshStart(page) {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/');
  await page.waitForSelector('[data-testid="add-root-group-btn"]', { timeout: 15_000 });
}

async function newQuestionnaire(page) {
  await page.getByTestId('add-root-group-btn').click();
  await expect(page.locator('[data-node-id="1"]')).toBeVisible();
}

async function addResource(page, json) {
  await page.getByTestId('contained-add-btn').click();
  await expect(modal(page)).toBeVisible();
  await page.getByTestId('contained-json-input').fill(json);
  await page.getByTestId('containedResourceModalApply').click();
}

async function addItem(page, groupId, nodeId) {
  await page.locator(`[data-node-id="${groupId}"]`).getByTestId('group-add-btn').click();
  await page.locator('[data-testid="add-menu-item"]').first().click();
  await expect(page.locator(`[data-node-id="${nodeId}"]`).getByTestId('action-type')).toBeVisible();
}

async function setItemType(page, nodeId, typeValue) {
  await page.locator(`[data-node-id="${nodeId}"]`).getByTestId('action-type').click();
  await expect(page.getByTestId('answerTypeModal')).toBeVisible();
  await page.getByTestId('type-select').click();
  await page.locator(`[data-testid="csel-drop"] [data-val="${typeValue}"]`).click();
  await page.getByTestId('answerTypeModalApply').click();
  await expect(page.getByTestId('answerTypeModal')).toBeHidden();
}

test.describe('Contained resources — editable panel', () => {
  test('card shows with an empty state after a new questionnaire', async ({ page }) => {
    await freshStart(page);
    await expect(card(page)).not.toBeVisible();
    await newQuestionnaire(page);
    await expect(card(page)).toBeVisible();
    await expect(page.getByTestId('contained-empty')).toBeVisible();
  });

  test('adds a valid resource → chip + count; second bumps count', async ({ page }) => {
    await freshStart(page);
    await newQuestionnaire(page);

    await addResource(page, vsJson('vs-a'));
    await expect(modal(page)).toBeHidden();
    await expect(chips(page)).toContainText('ValueSet/vs-a');
    await expect(count(page)).toHaveText('1');

    await addResource(page, vsJson('vs-b'));
    await expect(count(page)).toHaveText('2');
    await expect(chips(page)).toContainText('ValueSet/vs-b');
  });

  test('rejects invalid JSON and keeps the modal open', async ({ page }) => {
    await freshStart(page);
    await newQuestionnaire(page);
    await page.getByTestId('contained-add-btn').click();
    await page.getByTestId('contained-json-input').fill('{ not valid');
    await page.getByTestId('containedResourceModalApply').click();
    await expect(page.getByTestId('contained-json-error')).toContainText('Invalid JSON');
    await expect(modal(page)).toBeVisible();
  });

  test('rejects a JSON object without resourceType', async ({ page }) => {
    await freshStart(page);
    await newQuestionnaire(page);
    await page.getByTestId('contained-add-btn').click();
    await page.getByTestId('contained-json-input').fill('{ "id": "x" }');
    await page.getByTestId('containedResourceModalApply').click();
    await expect(page.getByTestId('contained-json-error')).toContainText('resourceType');
  });

  test('rejects a duplicate id', async ({ page }) => {
    await freshStart(page);
    await newQuestionnaire(page);
    await addResource(page, vsJson('dup'));
    await expect(count(page)).toHaveText('1');

    await page.getByTestId('contained-add-btn').click();
    await page.getByTestId('contained-json-input').fill(vsJson('dup'));
    await page.getByTestId('containedResourceModalApply').click();
    await expect(page.getByTestId('contained-json-error')).toContainText('already exists');
    await expect(modal(page)).toBeVisible();
  });

  test('edits an existing resource', async ({ page }) => {
    await freshStart(page);
    await newQuestionnaire(page);
    await addResource(page, vsJson('vs-old'));

    await page.getByTestId('contained-edit-0').click();
    await expect(modal(page)).toBeVisible();
    await page.getByTestId('contained-json-input').fill(vsJson('vs-new'));
    await page.getByTestId('containedResourceModalApply').click();

    await expect(chips(page)).toContainText('ValueSet/vs-new');
    await expect(chips(page)).not.toContainText('ValueSet/vs-old');
  });

  test('removes a resource', async ({ page }) => {
    await freshStart(page);
    await newQuestionnaire(page);
    await addResource(page, vsJson('vs-gone'));
    await expect(count(page)).toHaveText('1');

    await page.getByTestId('contained-remove-0').click();
    await expect(page.getByTestId('contained-empty')).toBeVisible();
    await expect(count(page)).not.toBeVisible();
  });

  test('an added ValueSet is selectable as a choice item answerValueSet', async ({ page }) => {
    await freshStart(page);
    await newQuestionnaire(page);
    await addResource(page, vsJson('vs-diet', 'Diet options'));

    await addItem(page, '1', '1.1');
    await setItemType(page, '1.1', 'select');

    // Reopen the Answer Type modal → switch answer source to ValueSet → the
    // contained ValueSet is offered in avs-select.
    await page.locator('[data-node-id="1.1"]').getByTestId('action-type').click();
    await expect(page.getByTestId('answerTypeModal')).toBeVisible();
    await page.getByTestId('src-valueset-radio').click();
    await page.getByTestId('avs-select').click();
    await expect(page.locator('[data-testid="csel-drop"] [data-val="#vs-diet"]')).toBeVisible();
  });
});
