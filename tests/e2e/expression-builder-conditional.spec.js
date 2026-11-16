// ── E2E: Expression Builder — conditional values ("If … then … otherwise") ────
// A calculation that picks a value by a condition, or counts several conditions, is edited as blocks
// instead of text: the condition, the value when it holds and the value otherwise ("No value" included).
// The pure parse/emit round-trips live in tests/expr-blocks.test.js; this asserts the UI.
//
// ── data-testid used ──────────────────────────────────────────────────────────
//   add-root-group-btn / group-add-btn / add-menu-item / node-title-*        builder
//   action-type / answerTypeModal / type-select / answerTypeModalApply       item type
//   action-expr / expressionModal(+Apply) / expr-calc-ta-build-btn            value host
//   eb-choose-number / expressionBuilderModal(+Apply) / eb-preview-str|chip   builder modal
//   eb-operand-kind / eb-operand-num / eb-add-operand / eb-remove-operand     value operands
//   eb-if / eb-if-cond / eb-if-then / eb-if-else / eb-if-branch / eb-if-add-else / eb-if-remove-else / eb-no-value   conditional block
//   eb-branch-add                                                            "+ Add operand" inside a branch
//   eb-if-elseif-cond / eb-if-elseif-then / eb-if-add-elseif / eb-if-remove-elseif   "otherwise if" rows
//   eb-leaf-kind-value-compare / eb-leaf-kind-value-exists / eb-calc-text / eb-calc-edit / eb-calc-done / eb-calc-op / eb-calc-value / eb-calc-mode   calculated-value conditions
//   eb-add-condition / eb-group-type / eb-leaf-item / eb-leaf-kind-any-answered / eb-leaf-kind-back
//   eb-any-mode / eb-any-item / eb-any-add / eb-any-remove                   several-questions condition
//   eb-wrap-fn / eb-wrap-arg                                                  rounding of the whole result
//   eb-math / eb-math-fn / eb-math-arg / eb-operand-text / eb-group / eb-group-add / eb-arith-op   round-of, text and group operands
//   eb-scale-item / eb-scale-add / eb-scale-remove / eb-scale-total-note / eb-scores-fn / eb-scores-item / eb-scores-add   scale total and score-sum operands
//   expressionBuilderModalCancel / eb-body                                    builder modal cancel / its body
//   eb-edit-as-text / eb-raw-note / eb-switch-visual                          text ↔ blocks
//   add-menu-btn / add-template-btn / tpl-row-<id> / templatesModalApply     templates (qSOFA)
// Preview answers ([data-preview-id], .bool-seg__btn) are the sanctioned non-testid exception.
// ─────────────────────────────────────────────────────────────────────────────

import { test, expect } from '@playwright/test';
import { clickAddRootGroup } from './helpers/builder.js';
import { openDropdownItem, pickCustomSelect } from './helpers/dropdown.js';

async function freshStart(page) {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/');
  await page.waitForSelector('[data-testid="add-menu-btn"]', { timeout: 10_000 });
}

async function addItem(page, groupId, nodeId, title) {
  await page.locator(`[data-node-id="${groupId}"]`).getByTestId('group-add-btn').click();
  await page.locator('[data-testid="add-menu-item"]').first().click();
  const item = page.locator(`[data-node-id="${nodeId}"]`);
  await expect(item.getByTestId('action-vis')).toBeVisible();
  await expect(item.getByTestId('node-title-display')).toBeVisible();
  await expect(async () => {
    await item.getByTestId('node-title-display').click();
    await expect(item.getByTestId('node-title-input')).toBeVisible();
  }).toPass();
  await item.getByTestId('node-title-input').fill(title);
  await item.getByTestId('node-title-input').blur();
}

async function setItemType(page, nodeId, typeValue) {
  await page.locator(`[data-node-id="${nodeId}"]`).getByTestId('action-type').click();
  await expect(page.getByTestId('answerTypeModal')).toBeVisible();
  await pickCustomSelect(page, 'type-select', typeValue);
  await page.getByTestId('answerTypeModalApply').click();
  await expect(page.getByTestId('answerTypeModal')).toBeHidden();
}

// A group with a number field (1.1) and two yes/no questions (1.2, 1.3) to build conditions on.
async function makeForm(page) {
  await clickAddRootGroup(page);
  await expect(page.locator('[data-node-id="1"]')).toBeVisible();
  await addItem(page, '1', '1.1', 'Score');
  await addItem(page, '1', '1.2', 'Fever');
  await addItem(page, '1', '1.3', 'Cough');
  await setItemType(page, '1.1', 'integer');
  await setItemType(page, '1.2', 'checkbox');
  await setItemType(page, '1.3', 'checkbox');
}

async function openBuilderForNumber(page, nodeId = '1.1') {
  await page.locator(`[data-node-id="${nodeId}"]`).getByTestId('action-expr').click();
  await expect(page.getByTestId('expressionModal')).toBeVisible();
  await page.getByTestId('expr-calc-ta-build-btn').click();
  await expect(page.getByTestId('expressionBuilderModal')).toBeVisible();
  await page.getByTestId('eb-choose-number').click();
}

async function reopenBuilder(page) {
  await page.getByTestId('expr-calc-ta-build-btn').click();
  await expect(page.getByTestId('expressionBuilderModal')).toBeVisible();
}

const modal = (page) => page.getByTestId('expressionBuilderModal');
const preview = (page) => page.getByTestId('eb-preview-str');
// Apply in the builder hands the expression to the field; Apply in the expression window saves it.
const apply = (page) => page.getByTestId('expressionBuilderModalApply').click();
const saveField = async (page) => { await page.getByTestId('expressionModalApply').click(); await expect(page.getByTestId('expressionModal')).toBeHidden(); };

async function insertQsofa(page) {
  await openDropdownItem(page, 'add-menu-btn', 'add-template-btn');
  await page.getByTestId('tpl-row-qsofa').click();
  await page.getByTestId('templatesModalApply').click();
  await expect(page.getByTestId('templatesModal')).toBeHidden();
}

// The qSOFA total is the deepest node whose title is "qSOFA score".
async function openQsofaBuilder(page) {
  const node = page.locator('[data-node-id]').filter({ has: page.getByTestId('node-title-display').filter({ hasText: 'qSOFA score' }) }).last();
  await node.getByTestId('action-expr').click();
  await expect(page.getByTestId('expressionModal')).toBeVisible();
  await page.getByTestId('expr-calc-ta-build-btn').click();
  await expect(modal(page)).toBeVisible();
}

const answerYes = (page, id) => page.locator(`[data-preview-id="${id}"] .bool-seg__btn`).first().click();

test.describe('Expression Builder — conditional value', () => {
  test('builds "if Fever is Yes then 5 otherwise 1" from scratch and reopens it as blocks', async ({ page }) => {
    await freshStart(page);
    await makeForm(page);
    await openBuilderForNumber(page);

    await pickCustomSelect(page, 'eb-operand-kind', 'iif');
    const box = modal(page).getByTestId('eb-if');
    await expect(box).toBeVisible();
    await pickCustomSelect(page, box.getByTestId('eb-if-cond').getByTestId('eb-leaf-item'), '1.2');
    await box.getByTestId('eb-if-then').getByTestId('eb-operand-num').fill('5');
    await pickCustomSelect(page, box.getByTestId('eb-if-else').getByTestId('eb-operand-kind'), 'num');
    await box.getByTestId('eb-if-else').getByTestId('eb-operand-num').fill('1');

    await expect(preview(page)).toHaveText(/^iif\(%resource(\.item\.where\(linkId='[^']+'\))+\.answer\.valueBoolean = true, 5, 1\)$/);
    await expect(page.getByTestId('eb-preview-chip')).toHaveText('= [1]'); // nothing answered yet → otherwise branch

    await apply(page);
    await reopenBuilder(page);
    await expect(modal(page).getByTestId('eb-raw-note')).toHaveCount(0);
    await expect(modal(page).getByTestId('eb-if')).toHaveCount(1);
    await expect(modal(page).getByTestId('eb-if-then').getByTestId('eb-operand-num')).toHaveValue('5');
    await expect(modal(page).getByTestId('eb-if-else').getByTestId('eb-operand-num')).toHaveValue('1');
  });

  test('"No value" as the otherwise keeps the result empty; it is offered only inside a branch', async ({ page }) => {
    await freshStart(page);
    await makeForm(page);
    await openBuilderForNumber(page);

    await expect(async () => {
      await page.getByTestId('eb-operand-kind').first().click();
      await expect(page.locator('[data-testid="csel-drop"] [data-val="iif"]')).toBeVisible();
    }).toPass();
    await expect(page.locator('[data-testid="csel-drop"] [data-val="empty"]')).toHaveCount(0);
    await page.locator('[data-testid="csel-drop"] [data-val="iif"]').click();

    const box = modal(page).getByTestId('eb-if');
    await pickCustomSelect(page, box.getByTestId('eb-if-cond').getByTestId('eb-leaf-item'), '1.2');
    await box.getByTestId('eb-if-then').getByTestId('eb-operand-num').fill('5');
    await expect(box.getByTestId('eb-if-else').getByTestId('eb-no-value')).toBeVisible(); // the default otherwise
    await expect(preview(page)).toHaveText(/, 5, \{\}\)$/);
    await expect(page.getByTestId('eb-preview-chip')).toHaveText('= []'); // empty result

    await apply(page);
    await reopenBuilder(page);
    await expect(modal(page).getByTestId('eb-if-else').getByTestId('eb-no-value')).toBeVisible();
  });

  test('a condition can be "at least one of several questions has an answer"', async ({ page }) => {
    await freshStart(page);
    await makeForm(page);
    await openBuilderForNumber(page);
    await pickCustomSelect(page, 'eb-operand-kind', 'iif');

    const cond = modal(page).getByTestId('eb-if').getByTestId('eb-if-cond');
    await cond.getByTestId('eb-leaf-kind-any-answered').click();
    await pickCustomSelect(page, cond.getByTestId('eb-any-item').nth(0), '1.2');
    await pickCustomSelect(page, cond.getByTestId('eb-any-item').nth(1), '1.3');
    await modal(page).getByTestId('eb-if').getByTestId('eb-if-then').getByTestId('eb-operand-num').fill('2');
    await expect(preview(page)).toHaveText(/^iif\(\(%resource(\.item\.where\(linkId='[^']+'\))+\.answer\.valueBoolean \| %resource(\.item\.where\(linkId='[^']+'\))+\.answer\.valueBoolean\)\.exists\(\), 2, \{\}\)$/);

    await cond.getByTestId('eb-any-add').click();
    await expect(cond.getByTestId('eb-any-item')).toHaveCount(3);
    await cond.getByTestId('eb-any-remove').last().click();
    await expect(cond.getByTestId('eb-any-item')).toHaveCount(2);
    await expect(cond.getByTestId('eb-any-remove')).toHaveCount(0); // at least two questions stay

    await pickCustomSelect(page, cond.getByTestId('eb-any-mode'), 'none');
    await expect(preview(page)).toContainText('.empty()');
  });

  test('the "otherwise" can be left out and added again', async ({ page }) => {
    await freshStart(page);
    await makeForm(page);
    await openBuilderForNumber(page);
    await pickCustomSelect(page, 'eb-operand-kind', 'iif');
    const box = modal(page).getByTestId('eb-if');
    await pickCustomSelect(page, box.getByTestId('eb-if-cond').getByTestId('eb-leaf-item'), '1.2');
    await box.getByTestId('eb-if-then').getByTestId('eb-operand-num').fill('5');
    await apply(page);

    // Hand-edit to the two-argument form, then open it as blocks.
    await page.getByTestId('expr-calc-ta').fill((await page.getByTestId('expr-calc-ta').inputValue()).replace(/,\s*\{\}\)\s*$/, ')'));
    await reopenBuilder(page);
    await expect(modal(page).getByTestId('eb-if-else')).toHaveCount(0);
    await expect(preview(page)).toHaveText(/, 5\)$/);
    await modal(page).getByTestId('eb-if-add-else').click();
    await expect(modal(page).getByTestId('eb-if-else')).toBeVisible();
    await expect(preview(page)).toHaveText(/, 5, \{\}\)$/);
  });

  test('a branch can hold several operands: add one with "+ Add operand", then remove it', async ({ page }) => {
    await freshStart(page);
    await makeForm(page);
    await openBuilderForNumber(page);
    await pickCustomSelect(page, 'eb-operand-kind', 'iif');
    const box = modal(page).getByTestId('eb-if');
    await pickCustomSelect(page, box.getByTestId('eb-if-cond').getByTestId('eb-leaf-item'), '1.2');
    const then = box.getByTestId('eb-if-then');
    await then.getByTestId('eb-operand-num').fill('5');
    await then.getByTestId('eb-branch-add').click();
    await then.getByTestId('eb-operand-num').nth(1).fill('2');
    await expect(preview(page)).toContainText(', 5 + 2, {})');
    await then.getByTestId('eb-remove-operand').nth(1).click();
    await expect(then.getByTestId('eb-operand-num')).toHaveCount(1);
    await expect(preview(page)).toContainText(', 5, {})');
  });

  test('"No value" is offered only while the branch has a single value', async ({ page }) => {
    await freshStart(page);
    await makeForm(page);
    await openBuilderForNumber(page);
    await pickCustomSelect(page, 'eb-operand-kind', 'iif');
    const then = modal(page).getByTestId('eb-if').getByTestId('eb-if-then');
    const openKinds = async (nth) => {
      await expect(async () => {
        await then.getByTestId('eb-operand-kind').nth(nth).click();
        await expect(page.locator('[data-testid="csel-drop"] [data-val="num"]')).toBeVisible();
      }).toPass();
    };
    await openKinds(0);
    await expect(page.locator('[data-testid="csel-drop"] [data-val="empty"]')).toHaveCount(1);
    await page.keyboard.press('Escape');
    await then.getByTestId('eb-branch-add').click();
    await openKinds(0);
    await expect(page.locator('[data-testid="csel-drop"] [data-val="empty"]')).toHaveCount(0);
  });

  test('a condition can combine several rules, and two conditionals can be added up', async ({ page }) => {
    await freshStart(page);
    await makeForm(page);
    await openBuilderForNumber(page);
    await pickCustomSelect(page, 'eb-operand-kind', 'iif');
    const first = modal(page).getByTestId('eb-if').first();
    await pickCustomSelect(page, first.getByTestId('eb-if-cond').getByTestId('eb-leaf-item'), '1.2');
    await first.getByTestId('eb-if-cond').getByTestId('eb-add-condition').first().click();
    await pickCustomSelect(page, first.getByTestId('eb-if-cond').getByTestId('eb-leaf-item').nth(1), '1.3');
    await first.getByTestId('eb-if-then').getByTestId('eb-operand-num').fill('1');
    await expect(preview(page)).toContainText(' and ');

    await modal(page).getByTestId('eb-add-operand').click();
    await pickCustomSelect(page, modal(page).getByTestId('eb-operand-kind').last(), 'iif');
    await expect(modal(page).getByTestId('eb-if')).toHaveCount(2);
    const second = modal(page).getByTestId('eb-if').nth(1);
    await pickCustomSelect(page, second.getByTestId('eb-if-cond').getByTestId('eb-leaf-item'), '1.3');
    await second.getByTestId('eb-if-then').getByTestId('eb-operand-num').fill('2');
    await expect(preview(page)).toContainText(', 1, {}) + iif(');
    await expect(preview(page)).toHaveText(/, 2, \{\}\)$/);
  });

  test('the "several questions" condition can go back to one question and keeps the first one', async ({ page }) => {
    await freshStart(page);
    await makeForm(page);
    await openBuilderForNumber(page);
    await pickCustomSelect(page, 'eb-operand-kind', 'iif');
    const cond = modal(page).getByTestId('eb-if').getByTestId('eb-if-cond');
    await pickCustomSelect(page, cond.getByTestId('eb-leaf-item'), '1.3');
    await cond.getByTestId('eb-leaf-kind-any-answered').click();
    await expect(cond.getByTestId('eb-any-item').first()).toContainText('Cough'); // the chosen question is carried over
    await cond.getByTestId('eb-leaf-kind-back').click();
    await expect(cond.getByTestId('eb-leaf-item')).toContainText('Cough');
    await expect(cond.getByTestId('eb-any-item')).toHaveCount(0);
  });

  test('rounding applies to the whole result, not to one branch', async ({ page }) => {
    await freshStart(page);
    await makeForm(page);
    await openBuilderForNumber(page);
    await pickCustomSelect(page, 'eb-operand-kind', 'iif');
    const box = modal(page).getByTestId('eb-if');
    await pickCustomSelect(page, box.getByTestId('eb-if-cond').getByTestId('eb-leaf-item'), '1.2');
    await box.getByTestId('eb-if-then').getByTestId('eb-operand-num').fill('5');
    await expect(modal(page).getByTestId('eb-wrap-row')).toContainText('Round the result');
    await pickCustomSelect(page, 'eb-wrap-fn', 'round');
    await modal(page).getByTestId('eb-wrap-arg').fill('1');
    await expect(preview(page)).toHaveText(/\)\.round\(1\)$/);
    await expect(preview(page)).toHaveText(/^iif\(/); // the rounding wraps the conditional, not a value inside it
  });

  test('choosing the operand kind that is already chosen changes nothing', async ({ page }) => {
    await freshStart(page);
    await makeForm(page);
    await openBuilderForNumber(page);
    await pickCustomSelect(page, 'eb-operand-kind', 'iif');
    const box = modal(page).getByTestId('eb-if');
    await pickCustomSelect(page, box.getByTestId('eb-if-cond').getByTestId('eb-leaf-item'), '1.2');
    await box.getByTestId('eb-if-then').getByTestId('eb-operand-num').fill('5');

    await pickCustomSelect(page, modal(page).getByTestId('eb-operand-kind').first(), 'iif');
    await expect(modal(page).getByTestId('eb-if-then').getByTestId('eb-operand-num')).toHaveValue('5');
    await expect(preview(page)).toContainText(', 5, {})');
  });

  test('no "+ Add operand" is offered next to "No value"; choosing another kind brings it back', async ({ page }) => {
    await freshStart(page);
    await makeForm(page);
    await openBuilderForNumber(page);
    await pickCustomSelect(page, 'eb-operand-kind', 'iif');
    const otherwise = modal(page).getByTestId('eb-if').getByTestId('eb-if-else');
    await expect(otherwise.getByTestId('eb-no-value')).toBeVisible();
    await expect(otherwise.getByTestId('eb-branch-add')).toHaveCount(0);
    await pickCustomSelect(page, otherwise.getByTestId('eb-operand-kind'), 'num');
    await expect(otherwise.getByTestId('eb-branch-add')).toBeVisible();
    await otherwise.getByTestId('eb-branch-add').click();
    await expect(otherwise.getByTestId('eb-operand')).toHaveCount(2);
  });

  test('the otherwise can be taken away again', async ({ page }) => {
    await freshStart(page);
    await makeForm(page);
    await openBuilderForNumber(page);
    await pickCustomSelect(page, 'eb-operand-kind', 'iif');
    const box = modal(page).getByTestId('eb-if');
    await pickCustomSelect(page, box.getByTestId('eb-if-cond').getByTestId('eb-leaf-item'), '1.2');
    await box.getByTestId('eb-if-then').getByTestId('eb-operand-num').fill('5');
    await box.getByTestId('eb-if-remove-else').click();
    await expect(box.getByTestId('eb-if-else')).toHaveCount(0);
    await expect(box.getByTestId('eb-if-add-else')).toBeVisible();
    await expect(preview(page)).toHaveText(/, 5\)$/);
  });

  test('a value can be rounded inside a branch with "Round / abs / … of ( … )"', async ({ page }) => {
    await freshStart(page);
    await makeForm(page);
    await openBuilderForNumber(page);
    await pickCustomSelect(page, 'eb-operand-kind', 'iif');
    const box = modal(page).getByTestId('eb-if');
    await pickCustomSelect(page, box.getByTestId('eb-if-cond').getByTestId('eb-leaf-item'), '1.2');
    const then = box.getByTestId('eb-if-then');
    await pickCustomSelect(page, then.getByTestId('eb-operand-kind'), 'math');
    const math = then.getByTestId('eb-math');
    await math.getByTestId('eb-operand-num').fill('5');
    await math.getByTestId('eb-branch-add').click();
    await math.getByTestId('eb-operand-num').nth(1).fill('2');
    await math.getByTestId('eb-math-arg').fill('1');
    await expect(preview(page)).toHaveText(/, \(5 \+ 2\)\.round\(1\), \{\}\)$/);

    await pickCustomSelect(page, math.getByTestId('eb-math-fn'), 'abs');
    await expect(math.getByTestId('eb-math-arg')).toHaveCount(0); // only round takes decimals
    await expect(preview(page)).toHaveText(/, \(5 \+ 2\)\.abs\(\), \{\}\)$/);

    await apply(page);
    await reopenBuilder(page);
    await expect(modal(page).getByTestId('eb-math')).toBeVisible();
    await expect(modal(page).getByTestId('eb-math-fn')).toHaveAttribute('data-value', 'abs');
  });

  test('a branch can give a piece of text, and it is kept when reopened', async ({ page }) => {
    await freshStart(page);
    await makeForm(page);
    await openBuilderForNumber(page);
    await pickCustomSelect(page, 'eb-operand-kind', 'iif');
    const box = modal(page).getByTestId('eb-if');
    await pickCustomSelect(page, box.getByTestId('eb-if-cond').getByTestId('eb-leaf-item'), '1.2');
    await pickCustomSelect(page, box.getByTestId('eb-if-then').getByTestId('eb-operand-kind'), 'text');
    await box.getByTestId('eb-if-then').getByTestId('eb-operand-text').fill('High risk');
    await pickCustomSelect(page, box.getByTestId('eb-if-else').getByTestId('eb-operand-kind'), 'text');
    await box.getByTestId('eb-if-else').getByTestId('eb-operand-text').fill("It's low");
    await expect(preview(page)).toHaveText(/, 'High risk', 'It\\'s low'\)$/); // the quote is escaped

    await apply(page);
    await reopenBuilder(page);
    await expect(modal(page).getByTestId('eb-if-then').getByTestId('eb-operand-text')).toHaveValue('High risk');
    await expect(modal(page).getByTestId('eb-if-else').getByTestId('eb-operand-text')).toHaveValue("It's low");
  });

  test('"Text" is offered only inside a branch', async ({ page }) => {
    await freshStart(page);
    await makeForm(page);
    await openBuilderForNumber(page);
    await expect(async () => {
      await page.getByTestId('eb-operand-kind').first().click();
      await expect(page.locator('[data-testid="csel-drop"] [data-val="iif"]')).toBeVisible();
    }).toPass();
    await expect(page.locator('[data-testid="csel-drop"] [data-val="text"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="csel-drop"] [data-val="group"]')).toHaveCount(1);
    await expect(page.locator('[data-testid="csel-drop"] [data-val="math"]')).toHaveCount(1);
    // no question with coded answers in this form, so no score operands either
    await expect(page.locator('[data-testid="csel-drop"] [data-val="scale-total"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="csel-drop"] [data-val="scores"]')).toHaveCount(0);
  });

  test('groups nest inside groups: 1 + (2 × (3 + 4))', async ({ page }) => {
    await freshStart(page);
    await makeForm(page);
    await openBuilderForNumber(page);
    await modal(page).getByTestId('eb-operand-num').first().fill('1');
    await modal(page).getByTestId('eb-add-operand').click();
    await pickCustomSelect(page, modal(page).getByTestId('eb-operand-kind').nth(1), 'group');
    const outer = modal(page).getByTestId('eb-group').first();
    await outer.getByTestId('eb-operand-num').first().fill('2');
    await outer.getByTestId('eb-group-add').click();
    await pickCustomSelect(page, outer.getByTestId('eb-operand-kind').nth(1), 'group');
    await pickCustomSelect(page, outer.getByTestId('eb-arith-op').first(), '*');
    const inner = outer.getByTestId('eb-group');
    await inner.getByTestId('eb-operand-num').first().fill('3');
    await inner.getByTestId('eb-group-add').click();
    await inner.getByTestId('eb-operand-num').nth(1).fill('4');
    await expect(preview(page)).toHaveText('1 + (2 * (3 + 4))');
    await expect(page.getByTestId('eb-preview-chip')).toHaveText('= [15]');
  });

  test('"otherwise if" steps read as a flat list and can be added and removed', async ({ page }) => {
    await freshStart(page);
    await makeForm(page);
    await openBuilderForNumber(page);
    await pickCustomSelect(page, 'eb-operand-kind', 'iif');
    const box = modal(page).getByTestId('eb-if');
    await pickCustomSelect(page, box.getByTestId('eb-if-cond').getByTestId('eb-leaf-item'), '1.2');
    await pickCustomSelect(page, box.getByTestId('eb-if-then').getByTestId('eb-operand-kind'), 'text');
    await box.getByTestId('eb-if-then').getByTestId('eb-operand-text').fill('A');
    await pickCustomSelect(page, box.getByTestId('eb-if-else').getByTestId('eb-operand-kind'), 'text');
    await box.getByTestId('eb-if-else').getByTestId('eb-operand-text').fill('C');

    await box.getByTestId('eb-if-add-elseif').click();
    await pickCustomSelect(page, box.getByTestId('eb-if-elseif-cond').getByTestId('eb-leaf-item'), '1.3');
    await pickCustomSelect(page, box.getByTestId('eb-if-elseif-then').getByTestId('eb-operand-kind'), 'text');
    await box.getByTestId('eb-if-elseif-then').getByTestId('eb-operand-text').fill('B');
    await expect(modal(page).getByTestId('eb-if')).toHaveCount(1); // one box, not a ladder of nested boxes
    await expect(preview(page)).toHaveText(/^iif\(.*valueBoolean = true, 'A', iif\(.*valueBoolean = true, 'B', 'C'\)\)$/);

    await apply(page);
    await reopenBuilder(page);
    await expect(modal(page).getByTestId('eb-if-elseif-cond')).toHaveCount(1); // read back as a flat step
    await modal(page).getByTestId('eb-if-remove-elseif').click();
    await expect(modal(page).getByTestId('eb-if-elseif-cond')).toHaveCount(0);
    await expect(preview(page)).toHaveText(/, 'A', 'C'\)$/);
  });

  test('a condition can be built on a calculated value, shown as a short formula with "edit"', async ({ page }) => {
    await freshStart(page);
    await makeForm(page);
    await openBuilderForNumber(page);
    await pickCustomSelect(page, 'eb-operand-kind', 'iif');
    const cond = modal(page).getByTestId('eb-if').getByTestId('eb-if-cond');
    await cond.getByTestId('eb-leaf-kind-value-compare').click();
    await cond.getByTestId('eb-leaf-chain').getByTestId('eb-operand-num').fill('3');
    await cond.getByTestId('eb-branch-add').click();
    await cond.getByTestId('eb-leaf-chain').getByTestId('eb-operand-num').nth(1).fill('4');
    await cond.getByTestId('eb-calc-value').fill('5');
    await modal(page).getByTestId('eb-if').getByTestId('eb-if-then').getByTestId('eb-operand-num').fill('1');
    await expect(preview(page)).toHaveText('iif((3 + 4) = 5, 1, {})'); // the row's operator carries over
    await pickCustomSelect(page, cond.getByTestId('eb-calc-op'), '<');
    await expect(preview(page)).toHaveText('iif((3 + 4) < 5, 1, {})');

    await cond.getByTestId('eb-calc-done').click(); // collapses to the formula
    await expect(cond.getByTestId('eb-calc-text')).toHaveText('3 + 4');
    await cond.getByTestId('eb-calc-edit').click();
    await expect(cond.getByTestId('eb-leaf-chain')).toBeVisible();

    // editing inside the calculation must reach the expression (it once stayed stale until another edit)
    await cond.getByTestId('eb-leaf-chain').getByTestId('eb-operand-num').first().fill('9');
    await expect(preview(page)).toHaveText('iif((9 + 4) < 5, 1, {})');
    await pickCustomSelect(page, cond.getByTestId('eb-leaf-chain').getByTestId('eb-arith-op'), '*');
    await expect(preview(page)).toHaveText('iif((9 * 4) < 5, 1, {})');
    await cond.getByTestId('eb-calc-done').click();
    await expect(cond.getByTestId('eb-calc-text')).toHaveText('9 \u00d7 4');
    await expect(preview(page)).toHaveText('iif((9 * 4) < 5, 1, {})');
  });

  // A number field (1.1) and two questions with coded answers (1.2, 1.3) to take scores from.
  async function makeScoredForm(page) {
    await freshStart(page);
    await clickAddRootGroup(page);
    await expect(page.locator('[data-node-id="1"]')).toBeVisible();
    await addItem(page, '1', '1.1', 'Total');
    await addItem(page, '1', '1.2', 'Mood');
    await addItem(page, '1', '1.3', 'Sleep');
    await setItemType(page, '1.1', 'integer');
    await setItemType(page, '1.2', 'radio');
    await setItemType(page, '1.3', 'radio');
  }

  test('a scale total is built from the questions: the sum, once every one is answered', async ({ page }) => {
    await makeScoredForm(page);
    await openBuilderForNumber(page);
    await pickCustomSelect(page, 'eb-operand-kind', 'scale-total');
    await expect(modal(page).getByTestId('eb-scale-total-note')).toBeVisible();
    await expect(preview(page)).toHaveText('\u2014'); // nothing chosen yet
    await pickCustomSelect(page, modal(page).getByTestId('eb-scale-item').nth(0), '1.2');
    await expect(async () => { // a question already taken is not offered again
      await modal(page).getByTestId('eb-scale-item').nth(1).click();
      await expect(page.locator('[data-testid="csel-drop"] [data-val="1.3"]')).toBeVisible();
    }).toPass();
    await expect(page.locator('[data-testid="csel-drop"] [data-val="1.2"]')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await pickCustomSelect(page, modal(page).getByTestId('eb-scale-item').nth(1), '1.3');
    const scores = "%resource.repeat(item).where(linkId in ('1.2' | '1.3')).answer.valueCoding.extension('http://hl7.org/fhir/StructureDefinition/ordinalValue').valueDecimal";
    await expect(preview(page)).toHaveText(`iif(${scores}.count() = 2, ${scores}.sum(), {})`);

    await modal(page).getByTestId('eb-scale-add').click();
    await expect(modal(page).getByTestId('eb-scale-item')).toHaveCount(3);
    await expect(preview(page)).toHaveText('\u2014'); // the new question is still empty
    await modal(page).getByTestId('eb-scale-remove').last().click();
    await expect(preview(page)).toHaveText(`iif(${scores}.count() = 2, ${scores}.sum(), {})`);

    await apply(page);
    await reopenBuilder(page);
    await expect(modal(page).getByTestId('eb-scale-total-note')).toBeVisible(); // read back as the same block
    await expect(modal(page).getByTestId('eb-scale-item')).toHaveCount(2);
  });

  test('the sum, count or average of the scores can be taken without waiting for every answer', async ({ page }) => {
    await makeScoredForm(page);
    await openBuilderForNumber(page);
    await pickCustomSelect(page, 'eb-operand-kind', 'scores');
    await pickCustomSelect(page, modal(page).getByTestId('eb-scores-item').nth(0), '1.2');
    await modal(page).getByTestId('eb-scores-add').click();
    await pickCustomSelect(page, modal(page).getByTestId('eb-scores-item').nth(1), '1.3');
    await pickCustomSelect(page, modal(page).getByTestId('eb-scores-fn'), 'avg');
    await expect(preview(page)).toHaveText(/^%resource\.repeat\(item\)\.where\(linkId in \('1\.2' \| '1\.3'\)\)\.answer\.valueCoding\.extension\('[^']+'\)\.valueDecimal\.avg\(\)$/);
    await apply(page);
    await reopenBuilder(page);
    await expect(modal(page).getByTestId('eb-scores-fn')).toHaveAttribute('data-value', 'avg');
    await expect(modal(page).getByTestId('eb-scores-item')).toHaveCount(2);
  });

  test('Cancel keeps the expression the field already had', async ({ page }) => {
    await freshStart(page);
    await makeForm(page);
    await openBuilderForNumber(page);
    await pickCustomSelect(page, 'eb-operand-kind', 'iif');
    const box = modal(page).getByTestId('eb-if');
    await pickCustomSelect(page, box.getByTestId('eb-if-cond').getByTestId('eb-leaf-item'), '1.2');
    await box.getByTestId('eb-if-then').getByTestId('eb-operand-num').fill('5');
    await apply(page);
    const saved = await page.getByTestId('expr-calc-ta').inputValue();

    await reopenBuilder(page);
    await modal(page).getByTestId('eb-if').getByTestId('eb-if-then').getByTestId('eb-operand-num').fill('9');
    await page.getByTestId('expressionBuilderModalCancel').click();
    await expect(modal(page)).toBeHidden();
    await expect(page.getByTestId('expr-calc-ta')).toHaveValue(saved);
  });
});

test.describe('Expression Builder — the qSOFA template', () => {
  test('opens as blocks, and applying it unchanged keeps the score working', async ({ page }) => {
    await freshStart(page);
    await insertQsofa(page);
    await openQsofaBuilder(page);

    await expect(modal(page).getByTestId('eb-raw-note')).toHaveCount(0);
    await expect(modal(page).getByTestId('eb-if')).toHaveCount(4); // the outer one and one per criterion
    await expect(modal(page).getByTestId('eb-any-mode').first()).toBeVisible();
    await expect(modal(page).getByTestId('eb-no-value')).toBeVisible();

    await apply(page);
    await saveField(page);
    await answerYes(page, 'qsofa-resp');
    await expect(page.locator('[data-preview-id="qsofa-score"]')).toContainText('1');
    await answerYes(page, 'qsofa-sbp');
    await expect(page.locator('[data-preview-id="qsofa-score"]')).toContainText('2');
  });

  test('switching to text and back shows the blocks again', async ({ page }) => {
    await freshStart(page);
    await insertQsofa(page);
    await openQsofaBuilder(page);

    await modal(page).getByTestId('eb-edit-as-text').click();
    await expect(modal(page).getByTestId('eb-raw-note')).toBeVisible();
    await expect(modal(page).getByTestId('eb-if')).toHaveCount(0);
    await modal(page).getByTestId('eb-switch-visual').click();
    await expect(modal(page).getByTestId('eb-raw-note')).toHaveCount(0);
    await expect(modal(page).getByTestId('eb-if')).toHaveCount(4);
  });

  test('a criterion reads as "<question> is Yes (checked)" and its question can be changed', async ({ page }) => {
    await freshStart(page);
    await insertQsofa(page);
    await openQsofaBuilder(page);

    const first = modal(page).getByTestId('eb-if').nth(1); // the first criterion
    await expect(first.getByText('is Yes (checked)').first()).toBeVisible();
    await pickCustomSelect(page, first.getByTestId('eb-if-cond').getByTestId('eb-leaf-item'), 'qsofa-sbp');
    await expect(preview(page)).toContainText("iif(%resource.item.where(linkId='qsofa').item.where(linkId='qsofa-sbp').answer.valueBoolean, 1, 0)");
  });

  test('keyboard: the operand kind is picked without a mouse', async ({ page }) => {
    await freshStart(page);
    await makeForm(page);
    await openBuilderForNumber(page);

    const trigger = page.getByTestId('eb-operand-kind').first();
    await trigger.focus();
    await page.keyboard.press('ArrowDown'); // opens the list
    const options = page.locator('[data-testid="csel-drop"] [data-val]');
    await expect(options.first()).toBeVisible();
    const values = await options.evaluateAll((els) => els.map((e) => e.dataset.val));
    const steps = values.indexOf('iif') - values.indexOf(await trigger.getAttribute('data-value'));
    for (let i = 0; i < steps; i++) await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(modal(page).getByTestId('eb-if')).toBeVisible();
    await expect(page.locator('[data-testid="csel-drop"]')).toBeHidden();
  });

  test('fits a phone-width screen without sideways scrolling', async ({ page }) => {
    await freshStart(page);
    await insertQsofa(page);
    await openQsofaBuilder(page);
    await page.setViewportSize({ width: 390, height: 800 });
    await expect(modal(page).getByTestId('eb-if').first()).toBeVisible();
    const overflow = await modal(page).getByTestId('eb-body').evaluate((el) => el.scrollWidth - el.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
