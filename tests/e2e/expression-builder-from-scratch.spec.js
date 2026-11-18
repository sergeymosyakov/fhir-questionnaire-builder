// ── E2E: shipped calculations rebuilt from an empty field with real clicks, results checked ───────────
// ── data-testid used ──────────────────────────────────────────────────────────
//   add-root-group-btn / group-add-btn / add-menu-item / node-title-*          builder
//   action-type / answerTypeModal / type-select / answerTypeModalApply         item type
//   action-expr / expressionModal(+Apply) / expr-calc-ta-build-btn / expr-calc-ta   value host
//   eb-choose-number / expressionBuilderModal(+Apply) / eb-preview-str / preview-search-input   builder modal
//   eb-chain / eb-operand / eb-operand-kind / eb-operand-item / eb-operand-num / eb-arith-op   operands and operators
//   eb-add-operand / eb-branch-add / eb-group / eb-group-add / eb-group-chain   adding operands, brackets
//   eb-if / eb-if-cond / eb-if-then / eb-if-else / eb-if-branch / eb-if-add-elseif / eb-if-elseif-cond / eb-if-elseif-then   conditionals
//   eb-leaf-item / eb-leaf-op / eb-leaf-value-input / eb-leaf-value-select / eb-operand-text   conditions and text results
//   eb-scores-fn / eb-scores-item / eb-scores-add                              sum of answer scores
//   eb-scale-item / eb-scale-add / eb-scale-total-note / tpl-row-<id> / templatesModal(+Apply) / add-menu-btn / add-template-btn   scale total, templates
//   eb-wrap-fn / eb-wrap-arg / eb-math / eb-math-fn / eb-math-chain / eb-math-arg   rounding and square root
//   eb-power / eb-power-base-chain / eb-power-exp-chain / eb-negate-chain   power and minus blocks
//   eb-keep-op / eb-keep-value / eb-duration-value / eb-textfn-fn / eb-textfn-chain / eb-textfn-from / eb-textfn-length   keep-if, durations, date parts
//   action-states / statesModal(+Apply) / states-readonly-chk                  read-only flag on a calculated date
//   date-input / dp-cal / dp-day                                                the date picker (answers)
//   action-repeatable / repeat-modal-toggle / repeatableModalApply            repeating questions
//   (calculated date/text without read-only: date-input data-value, textarea value)
// Preview answers ([data-preview-id], calculated date [data-calc-id]) and the builder's node containers ([data-node-id]) are the sanctioned non-testid exceptions.
// ─────────────────────────────────────────────────────────────────────────────

import { test, expect } from '@playwright/test';
import { freshStart } from './helpers/builder.js';
import { pickCustomSelect, openDropdownItem } from './helpers/dropdown.js';
import {
  modal, makeForm, openBuilder, addField, applyAndSave, answer,
  topChain, operandOf, operatorOf, pickKind, pickQuestion, setNumber, answerDate, addDays, makeReadOnly, makeRepeatable,
} from './helpers/expr-builder.js';

const result = (page, id) => page.locator(`[data-preview-id="${id}"]`);
const round = async (page, fn, digits) => {
  await pickCustomSelect(page, modal(page).getByTestId('eb-wrap-fn'), fn);
  if (digits != null) await modal(page).getByTestId('eb-wrap-arg').fill(String(digits));
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
  await freshStart(page);
});

// Fills `chain`'s next operand with "<question> ÷ 100" inside brackets (the height in metres).
async function metres(page, chain, i, questionId) {
  await pickKind(page, operandOf(chain, i), 'group');
  const inner = operandOf(chain, i).getByTestId('eb-group-chain');
  await pickQuestion(page, operandOf(inner, 0), questionId);
  await operandOf(chain, i).getByTestId('eb-group-add').click();
  await pickCustomSelect(page, operatorOf(inner, 0), '/');
  await pickKind(page, operandOf(inner, 1), 'num');
  await setNumber(operandOf(inner, 1), 100);
}

test('BMI: questions, nested brackets, a number and rounding — weight / ((height / 100) x (height / 100)), 1 decimal', async ({ page }) => {
  await makeForm(page, [{ title: 'Height', type: 'decimal' }, { title: 'Weight', type: 'decimal' }, { title: 'BMI', type: 'decimal' }]);
  await openBuilder(page, '1.3');
  const top = topChain(page);
  await pickQuestion(page, operandOf(top, 0), '1.2'); // weight
  await modal(page).getByTestId('eb-add-operand').click();
  await pickCustomSelect(page, operatorOf(top, 0), '/');
  await pickKind(page, operandOf(top, 1), 'group');
  const squared = operandOf(top, 1).getByTestId('eb-group-chain').first();
  await metres(page, squared, 0, '1.1');
  await operandOf(top, 1).getByTestId('eb-group-add').last().click();
  await pickCustomSelect(page, operatorOf(squared, 0), '*');
  await metres(page, squared, 1, '1.1');
  await round(page, 'round', 1);
  await expect(modal(page).getByTestId('eb-preview-str')).toContainText('.round(1)');
  await applyAndSave(page);

  await answer(page, '1.1', 175);
  await answer(page, '1.2', 70);
  await expect(result(page, '1.3').locator('input')).toHaveValue('22.9'); // 70 / 1.75² = 22.86
});

test('BSA: the square root block — sqrt((height x weight) / 3600), 2 decimals', async ({ page }) => {
  await makeForm(page, [{ title: 'Height', type: 'decimal' }, { title: 'Weight', type: 'decimal' }, { title: 'BSA', type: 'decimal' }]);
  await openBuilder(page, '1.3');
  const top = topChain(page);
  await pickKind(page, operandOf(top, 0), 'math');
  await pickCustomSelect(page, operandOf(top, 0).getByTestId('eb-math-fn'), 'sqrt');
  const inside = operandOf(top, 0).getByTestId('eb-math-chain');
  await pickKind(page, operandOf(inside, 0), 'group');
  const product = operandOf(inside, 0).getByTestId('eb-group-chain');
  await pickQuestion(page, operandOf(product, 0), '1.1');
  await operandOf(inside, 0).getByTestId('eb-group-add').click();
  await pickCustomSelect(page, operatorOf(product, 0), '*');
  await pickQuestion(page, operandOf(product, 1), '1.2');
  await inside.locator(':scope > [data-testid="eb-branch-add"]').click();
  await pickCustomSelect(page, operatorOf(inside, 0), '/');
  await pickKind(page, operandOf(inside, 1), 'num');
  await setNumber(operandOf(inside, 1), 3600);
  await round(page, 'round', 2);
  await applyAndSave(page);

  await answer(page, '1.1', 180);
  await answer(page, '1.2', 80);
  await expect(result(page, '1.3').locator('input')).toHaveValue('2'); // sqrt(180 x 80 / 3600) = 2
});

test('QTc Fridericia: the power block — QT / (60 / HR) to the power of (1 / 3), no decimals', async ({ page }) => {
  await makeForm(page, [{ title: 'QT', type: 'decimal' }, { title: 'HR', type: 'decimal' }, { title: 'QTc', type: 'decimal' }]);
  await openBuilder(page, '1.3');
  const top = topChain(page);
  await pickQuestion(page, operandOf(top, 0), '1.1');
  await modal(page).getByTestId('eb-add-operand').click();
  await pickCustomSelect(page, operatorOf(top, 0), '/');
  await pickKind(page, operandOf(top, 1), 'power');
  const base = operandOf(top, 1).getByTestId('eb-power-base-chain');
  const exponent = operandOf(top, 1).getByTestId('eb-power-exp-chain');
  await pickKind(page, operandOf(base, 0), 'num');
  await setNumber(operandOf(base, 0), 60);
  await base.locator(':scope > [data-testid="eb-branch-add"]').click();
  await pickCustomSelect(page, operatorOf(base, 0), '/');
  await pickQuestion(page, operandOf(base, 1), '1.2');
  await pickKind(page, operandOf(exponent, 0), 'num');
  await setNumber(operandOf(exponent, 0), 1);
  await exponent.locator(':scope > [data-testid="eb-branch-add"]').click();
  await pickCustomSelect(page, operatorOf(exponent, 0), '/');
  await pickKind(page, operandOf(exponent, 1), 'num');
  await setNumber(operandOf(exponent, 1), 3);
  await round(page, 'round', 0);
  await applyAndSave(page);

  await answer(page, '1.1', 400);
  await answer(page, '1.2', 75);
  await expect(result(page, '1.3').locator('input')).toHaveValue('431');
});

test('Minus block: − (a x 2) + b', async ({ page }) => {
  await makeForm(page, [{ title: 'A', type: 'decimal' }, { title: 'B', type: 'decimal' }, { title: 'Out', type: 'decimal' }]);
  await openBuilder(page, '1.3');
  const top = topChain(page);
  await pickKind(page, operandOf(top, 0), 'negate');
  const inside = operandOf(top, 0).getByTestId('eb-negate-chain');
  await pickQuestion(page, operandOf(inside, 0), '1.1');
  await inside.locator(':scope > [data-testid="eb-branch-add"]').click();
  await pickCustomSelect(page, operatorOf(inside, 0), '*');
  await pickKind(page, operandOf(inside, 1), 'num');
  await setNumber(operandOf(inside, 1), 2);
  await modal(page).getByTestId('eb-add-operand').click();
  await pickCustomSelect(page, operatorOf(top, 0), '+');
  await pickQuestion(page, operandOf(top, 1), '1.2');
  await applyAndSave(page);

  await answer(page, '1.1', 3);
  await answer(page, '1.2', 10);
  await expect(result(page, '1.3').locator('input')).toHaveValue('4');
});

test('Cockcroft–Gault: "keep the result only if" — (140 − age) x weight / 72, kept only if at least 0', async ({ page }) => {
  await makeForm(page, [{ title: 'Age', type: 'integer' }, { title: 'Weight', type: 'decimal' }, { title: 'CrCl', type: 'decimal' }]);
  await openBuilder(page, '1.3');
  const top = topChain(page);
  await pickKind(page, operandOf(top, 0), 'group');
  const years = operandOf(top, 0).getByTestId('eb-group-chain');
  await pickKind(page, operandOf(years, 0), 'num');
  await setNumber(operandOf(years, 0), 140);
  await operandOf(top, 0).getByTestId('eb-group-add').click();
  await pickCustomSelect(page, operatorOf(years, 0), '-');
  await pickQuestion(page, operandOf(years, 1), '1.1');
  await modal(page).getByTestId('eb-add-operand').click();
  await pickCustomSelect(page, operatorOf(top, 0), '*');
  await pickQuestion(page, operandOf(top, 1), '1.2');
  await modal(page).getByTestId('eb-add-operand').click();
  await pickCustomSelect(page, operatorOf(top, 1), '/');
  await pickKind(page, operandOf(top, 2), 'num');
  await setNumber(operandOf(top, 2), 72);
  await pickCustomSelect(page, modal(page).getByTestId('eb-keep-op'), '>=');
  await modal(page).getByTestId('eb-keep-value').fill('0');
  await applyAndSave(page);

  await answer(page, '1.1', 150); // (140 − 150) is negative, so the result is dropped
  await answer(page, '1.2', 70);
  await expect(result(page, '1.3').locator('input')).toHaveValue('');
  await answer(page, '1.1', 40);
  await expect(result(page, '1.3').locator('input')).toHaveValue(/^97\.22/); // 100 x 70 / 72
});

test('div and mod: a div 7 + a mod 7 reads with normal precedence, no Group needed', async ({ page }) => {
  await makeForm(page, [{ title: 'A', type: 'integer' }, { title: 'Out', type: 'integer' }]);
  await openBuilder(page, '1.2');
  const top = topChain(page);
  await pickQuestion(page, operandOf(top, 0), '1.1');
  for (const [i, op, kind] of [[0, 'div', 'num'], [1, '+', 'item'], [2, 'mod', 'num']]) {
    await modal(page).getByTestId('eb-add-operand').click();
    await pickCustomSelect(page, operatorOf(top, i), op);
    await pickKind(page, operandOf(top, i + 1), kind);
    if (kind === 'num') await setNumber(operandOf(top, i + 1), 7);
    else await pickQuestion(page, operandOf(top, i + 1), '1.1');
  }
  await applyAndSave(page);

  await answer(page, '1.1', 100);
  await expect(result(page, '1.2').locator('input')).toHaveValue('16'); // 14 + 2
});

test('a Group changes the order: (a div 7 + a) mod 7', async ({ page }) => {
  await makeForm(page, [{ title: 'A', type: 'integer' }, { title: 'Out', type: 'integer' }]);
  await openBuilder(page, '1.2');
  const top = topChain(page);
  await pickKind(page, operandOf(top, 0), 'group');
  const inner = operandOf(top, 0).getByTestId('eb-group-chain');
  await pickQuestion(page, operandOf(inner, 0), '1.1');
  for (const [i, op, kind] of [[0, 'div', 'num'], [1, '+', 'item']]) {
    await operandOf(top, 0).getByTestId('eb-group-add').click();
    await pickCustomSelect(page, operatorOf(inner, i), op);
    await pickKind(page, operandOf(inner, i + 1), kind);
    if (kind === 'num') await setNumber(operandOf(inner, i + 1), 7);
    else await pickQuestion(page, operandOf(inner, i + 1), '1.1');
  }
  await modal(page).getByTestId('eb-add-operand').click();
  await pickCustomSelect(page, operatorOf(top, 0), 'mod');
  await pickKind(page, operandOf(top, 1), 'num');
  await setNumber(operandOf(top, 1), 7);
  await applyAndSave(page);

  await answer(page, '1.1', 100);
  await expect(result(page, '1.2').locator('input')).toHaveValue('2'); // (14 + 100) mod 7 = 2
});

test('Due date: a date question plus a duration — LMP + 280 days', async ({ page }) => {
  await makeForm(page, [{ title: 'LMP', type: 'date' }, { title: 'EDD', type: 'date' }]);
  await makeReadOnly(page, '1.2');
  await openBuilder(page, '1.2');
  const top = topChain(page);
  await pickQuestion(page, operandOf(top, 0), '1.1');
  await modal(page).getByTestId('eb-add-operand').click();
  await pickCustomSelect(page, operatorOf(top, 0), '+');
  await pickKind(page, operandOf(top, 1), 'duration');
  await operandOf(top, 1).getByTestId('eb-duration-value').fill('280');
  await expect(modal(page).getByTestId('eb-preview-str')).toContainText('+ 280 days');
  await applyAndSave(page);

  const lmp = await answerDate(page, '1.1');
  await expect(page.locator('[data-calc-id="1.2"]')).toHaveText(addDays(lmp, 280));
});

test('A calculated date shows its result without being marked read-only', async ({ page }) => {
  await makeForm(page, [{ title: 'LMP', type: 'date' }, { title: 'EDD', type: 'date' }]);
  await openBuilder(page, '1.2');
  const top = topChain(page);
  await pickQuestion(page, operandOf(top, 0), '1.1');
  await modal(page).getByTestId('eb-add-operand').click();
  await pickCustomSelect(page, operatorOf(top, 0), '+');
  await pickKind(page, operandOf(top, 1), 'duration');
  await operandOf(top, 1).getByTestId('eb-duration-value').fill('280');
  await applyAndSave(page);

  const lmp = await answerDate(page, '1.1');
  await expect(result(page, '1.2').getByTestId('date-input')).toHaveAttribute('data-value', addDays(lmp, 280));
});

test('A calculated text shows its result without being marked read-only', async ({ page }) => {
  await makeForm(page, [{ title: 'Score', type: 'integer' }, { title: 'Level', type: 'text' }]);
  await openBuilder(page, '1.2');
  await pickKind(page, operandOf(topChain(page), 0), 'iif');
  const box = modal(page).getByTestId('eb-if').first();
  const cond = box.getByTestId('eb-if-cond');
  await pickCustomSelect(page, cond.getByTestId('eb-leaf-item'), '1.1');
  await pickCustomSelect(page, cond.getByTestId('eb-leaf-op'), 'cmp|>');
  await cond.getByTestId('eb-leaf-value-input').fill('5');
  for (const [row, value] of [['eb-if-then', 'High'], ['eb-if-else', 'Low']]) {
    await pickKind(page, box.getByTestId(row), 'text');
    await box.getByTestId(row).getByTestId('eb-operand-text').fill(value);
  }
  await applyAndSave(page);

  await answer(page, '1.1', 9);
  await expect(result(page, '1.2').locator('textarea')).toHaveValue('High');
  await answer(page, '1.1', 2);
  await expect(result(page, '1.2').locator('textarea')).toHaveValue('Low');
});

test('A calculated number in a repeating question shows its result', async ({ page }) => {
  await makeForm(page, [{ title: 'A', type: 'integer' }, { title: 'Out', type: 'decimal' }]);
  await makeRepeatable(page, '1.2');
  await openBuilder(page, '1.2');
  const top = topChain(page);
  await pickQuestion(page, operandOf(top, 0), '1.1');
  await modal(page).getByTestId('eb-add-operand').click();
  await pickCustomSelect(page, operatorOf(top, 0), '*');
  await pickKind(page, operandOf(top, 1), 'num');
  await setNumber(operandOf(top, 1), 2);
  await applyAndSave(page);

  await answer(page, '1.1', 5);
  await expect(result(page, '1.2').locator('.repeat-row input').first()).toHaveValue('10');
});

test('A calculated date in a repeating question shows its result', async ({ page }) => {
  await makeForm(page, [{ title: 'LMP', type: 'date' }, { title: 'EDD', type: 'date' }]);
  await makeRepeatable(page, '1.2');
  await openBuilder(page, '1.2');
  const top = topChain(page);
  await pickQuestion(page, operandOf(top, 0), '1.1');
  await modal(page).getByTestId('eb-add-operand').click();
  await pickCustomSelect(page, operatorOf(top, 0), '+');
  await pickKind(page, operandOf(top, 1), 'duration');
  await operandOf(top, 1).getByTestId('eb-duration-value').fill('280');
  await applyAndSave(page);

  const lmp = await answerDate(page, '1.1');
  await expect(result(page, '1.2').getByTestId('date-input').first()).toHaveAttribute('data-value', addDays(lmp, 280));
});

test('Today: today\'s date plus a duration', async ({ page }) => {
  await makeForm(page, [{ title: 'Seed', type: 'date' }, { title: 'Later', type: 'date' }]);
  await makeReadOnly(page, '1.2');
  await openBuilder(page, '1.2');
  const top = topChain(page);
  await pickKind(page, operandOf(top, 0), 'today');
  await modal(page).getByTestId('eb-add-operand').click();
  await pickCustomSelect(page, operatorOf(top, 0), '+');
  await pickKind(page, operandOf(top, 1), 'duration');
  await operandOf(top, 1).getByTestId('eb-duration-value').fill('10');
  await applyAndSave(page);

  const expected = await page.evaluate(() => {
    const d = new Date();
    d.setDate(d.getDate() + 10);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  await answerDate(page, '1.1'); // any answer makes the form recalculate
  await expect(page.locator('[data-calc-id="1.2"]')).toHaveText(expected);
});

test('Date parts: the year out of a date — whole number of (part of (text of (date)) from 0, length 4)', async ({ page }) => {
  await makeForm(page, [{ title: 'Visit', type: 'date' }, { title: 'Year', type: 'integer' }]);
  await openBuilder(page, '1.2');
  const top = topChain(page);
  await pickKind(page, operandOf(top, 0), 'text-fn');
  await pickCustomSelect(page, operandOf(top, 0).getByTestId('eb-textfn-fn').first(), 'toInteger');
  const part = operandOf(operandOf(top, 0).getByTestId('eb-textfn-chain').first(), 0);
  await pickKind(page, part, 'text-fn');
  await pickCustomSelect(page, part.getByTestId('eb-textfn-fn').first(), 'substring');
  const text = operandOf(part.getByTestId('eb-textfn-chain').first(), 0);
  await pickKind(page, text, 'text-fn');
  await pickQuestion(page, operandOf(text.getByTestId('eb-textfn-chain').first(), 0), '1.1');
  await part.getByTestId('eb-textfn-from').fill('0');
  await part.getByTestId('eb-textfn-length').fill('4');
  await applyAndSave(page);

  const visit = await answerDate(page, '1.1');
  await expect(result(page, '1.2').locator('input')).toHaveValue(visit.slice(0, 4));
});

test('BMI category: if / otherwise if / otherwise with text results', async ({ page }) => {
  await makeForm(page, [{ title: 'BMI', type: 'decimal' }, { title: 'Category', type: 'text' }]);
  await makeReadOnly(page, '1.2');
  await openBuilder(page, '1.2');
  await pickKind(page, operandOf(topChain(page), 0), 'iif');
  const box = modal(page).getByTestId('eb-if').first();
  const condition = async (row, op, value) => {
    await pickCustomSelect(page, row.getByTestId('eb-leaf-item'), '1.1');
    await pickCustomSelect(page, row.getByTestId('eb-leaf-op'), 'cmp|' + op);
    await row.getByTestId('eb-leaf-value-input').fill(value);
  };
  const text = async (row, value) => {
    await pickKind(page, row, 'text');
    await row.getByTestId('eb-operand-text').fill(value);
  };
  await condition(box.getByTestId('eb-if-cond'), '<', '18.5');
  await text(box.getByTestId('eb-if-then'), 'Underweight');
  await box.getByTestId('eb-if-add-elseif').click();
  await condition(box.getByTestId('eb-if-elseif-cond'), '<', '25');
  await text(box.getByTestId('eb-if-elseif-then'), 'Normal');
  await text(box.getByTestId('eb-if-else'), 'Overweight');
  await applyAndSave(page);

  const category = page.locator('[data-calc-id="1.2"]');
  await answer(page, '1.1', 22);
  await expect(category).toHaveText('Normal');
  await answer(page, '1.1', 30);
  await expect(category).toHaveText('Overweight');
  await answer(page, '1.1', 17);
  await expect(category).toHaveText('Underweight');
});


// ── Two whole templates, rebuilt next to the shipped field and compared with it ──────────────────────────
async function insertTemplate(page, id) {
  await openDropdownItem(page, 'add-menu-btn', 'add-template-btn');
  await page.getByTestId('tpl-row-' + id).click();
  await page.getByTestId('templatesModalApply').click();
  await expect(page.getByTestId('templatesModal')).toBeHidden();
}

const pickOption = (page, id, index) => page.locator(`[data-preview-id="${id}"] .radio-label`).nth(index).click();
// A calculated read-only field shows its value as text; "—" means blank.
const shown = async (page, id) => {
  const text = (await page.locator(`[data-calc-id="${id}"]`).textContent()).trim();
  return text === '\u2014' ? '' : text;
};

test('Cockcroft–Gault, whole: the shipped creatinine clearance rebuilt from scratch gives the same answers', async ({ page }) => {
  await insertTemplate(page, 'kidney-function');
  const mine = await addField(page, 'kidney', 'My clearance', 'decimal');
  await makeReadOnly(page, mine);
  await openBuilder(page, mine);
  const top = topChain(page);

  // if the sex is answered …
  await pickKind(page, operandOf(top, 0), 'iif');
  const box = modal(page).getByTestId('eb-if').first();
  const cond = box.getByTestId('eb-if-cond');
  await pickCustomSelect(page, cond.getByTestId('eb-leaf-item'), 'kidney-sex');
  await pickCustomSelect(page, cond.getByTestId('eb-leaf-op'), 'ex|answered');

  // … then round( (140 − age) x weight / (72 x creatinine) x (0.85 if female, else 1) ), otherwise no value
  const then = box.getByTestId('eb-if-then').first();
  await pickKind(page, operandOf(then.getByTestId('eb-if-branch'), 0), 'math');
  const rounded = operandOf(then.getByTestId('eb-if-branch'), 0);
  await rounded.getByTestId('eb-math-arg').fill('0');
  const chain = rounded.getByTestId('eb-math-chain').first();
  await pickKind(page, operandOf(chain, 0), 'group');
  const years = operandOf(chain, 0).getByTestId('eb-group-chain');
  await pickKind(page, operandOf(years, 0), 'num');
  await setNumber(operandOf(years, 0), 140);
  await operandOf(chain, 0).getByTestId('eb-group-add').click();
  await pickCustomSelect(page, operatorOf(years, 0), '-');
  await pickQuestion(page, operandOf(years, 1), 'kidney-age');
  await chain.locator(':scope > [data-testid="eb-branch-add"]').click();
  await pickCustomSelect(page, operatorOf(chain, 0), '*');
  await pickQuestion(page, operandOf(chain, 1), 'kidney-weight');
  await chain.locator(':scope > [data-testid="eb-branch-add"]').click();
  await pickCustomSelect(page, operatorOf(chain, 1), '/');
  await pickKind(page, operandOf(chain, 2), 'group');
  const divisor = operandOf(chain, 2).getByTestId('eb-group-chain');
  await pickKind(page, operandOf(divisor, 0), 'num');
  await setNumber(operandOf(divisor, 0), 72);
  await operandOf(chain, 2).getByTestId('eb-group-add').click();
  await pickCustomSelect(page, operatorOf(divisor, 0), '*');
  await pickQuestion(page, operandOf(divisor, 1), 'kidney-creatinine');
  await chain.locator(':scope > [data-testid="eb-branch-add"]').click();
  await pickCustomSelect(page, operatorOf(chain, 2), '*');
  await pickKind(page, operandOf(chain, 3), 'iif');
  const sexFactor = operandOf(chain, 3).getByTestId('eb-if');
  await pickCustomSelect(page, sexFactor.getByTestId('eb-if-cond').getByTestId('eb-leaf-item'), 'kidney-sex');
  await pickCustomSelect(page, sexFactor.getByTestId('eb-if-cond').getByTestId('eb-leaf-value-select'), 'LA3-6');
  const female = operandOf(sexFactor.getByTestId('eb-if-then').getByTestId('eb-if-branch'), 0);
  const male = operandOf(sexFactor.getByTestId('eb-if-else').getByTestId('eb-if-branch'), 0);
  await pickKind(page, female, 'num');
  await setNumber(female, 0.85);
  await pickKind(page, male, 'num');
  await setNumber(male, 1);

  // … and keep the result only if it is at least 0
  await pickCustomSelect(page, modal(page).getByTestId('eb-keep-op'), '>=');
  await modal(page).getByTestId('eb-keep-value').fill('0');
  await applyAndSave(page);

  // option 0 is female (x 0.85), option 1 male; 100 x 70 / 72 = 97.2, 68 x 58 / 100.8 = 39.1
  const cases = [
    { age: 40, weight: 70, creatinine: 1, sex: 0, expected: '83' },
    { age: 40, weight: 70, creatinine: 1, sex: 1, expected: '97' },
    { age: 72, weight: 58, creatinine: 1.4, sex: 0, expected: '33' },
    { age: 150, weight: 70, creatinine: 1, sex: 0, expected: '' }, // negative → dropped by both
  ];
  for (const c of cases) {
    await answer(page, 'kidney-age', c.age);
    await answer(page, 'kidney-weight', c.weight);
    await answer(page, 'kidney-creatinine', c.creatinine);
    await pickOption(page, 'kidney-sex', c.sex);
    await expect.poll(() => shown(page, 'kidney-crcl')).toBe(c.expected);
    await expect.poll(() => shown(page, mine)).toBe(c.expected);
  }
});

test('PHQ-9, whole: the total score and the severity bands rebuilt from scratch match the shipped ones', async ({ page }) => {
  await insertTemplate(page, 'phq-9');
  const total = await addField(page, 'phq9', 'My total', 'decimal');
  const severity = await addField(page, 'phq9', 'My severity', 'text');
  await makeReadOnly(page, total);
  await makeReadOnly(page, severity);

  // the total: the scores of all nine questions, once every one is answered
  await openBuilder(page, total);
  await pickKind(page, operandOf(topChain(page), 0), 'scale-total');
  const picks = modal(page).getByTestId('eb-scale-item');
  for (let i = 0; i < 9; i++) {
    if (i >= 2) await modal(page).getByTestId('eb-scale-add').click();
    await pickCustomSelect(page, picks.nth(i), `phq9-q${i + 1}`);
  }
  await expect(modal(page).getByTestId('eb-scale-total-note')).toBeVisible();
  await applyAndSave(page);

  // the severity: nothing until there is a total, then the first band the total is below
  await openBuilder(page, severity);
  await pickKind(page, operandOf(topChain(page), 0), 'iif');
  const outer = modal(page).getByTestId('eb-if').first();
  const cond = outer.getByTestId('eb-if-cond');
  await pickCustomSelect(page, cond.getByTestId('eb-leaf-item'), total);
  await pickCustomSelect(page, cond.getByTestId('eb-leaf-op'), 'ex|answered');
  const bands = operandOf(outer.getByTestId('eb-if-then').getByTestId('eb-if-branch').first(), 0);
  await pickKind(page, bands, 'iif');
  const inner = bands.getByTestId('eb-if');
  const band = async (row, below, label, step) => {
    const c = step ? inner.getByTestId('eb-if-elseif-cond').nth(step - 1) : inner.getByTestId('eb-if-cond');
    await pickCustomSelect(page, c.getByTestId('eb-leaf-item'), total);
    await pickCustomSelect(page, c.getByTestId('eb-leaf-op'), 'cmp|<');
    await c.getByTestId('eb-leaf-value-input').fill(String(below));
    const out = operandOf(row.getByTestId('eb-if-branch'), 0);
    await pickKind(page, out, 'text');
    await out.getByTestId('eb-operand-text').fill(label);
  };
  await band(inner.getByTestId('eb-if-then'), 5, 'Minimal depression', 0);
  const steps = [[10, 'Mild depression'], [15, 'Moderate depression'], [20, 'Moderately severe depression']];
  for (const [i, [below, label]] of steps.entries()) {
    await inner.getByTestId('eb-if-add-elseif').click();
    await band(inner.getByTestId('eb-if-elseif-then').nth(i), below, label, i + 1);
  }
  const last = operandOf(inner.getByTestId('eb-if-else').getByTestId('eb-if-branch'), 0);
  await pickKind(page, last, 'text');
  await last.getByTestId('eb-operand-text').fill('Severe depression');
  await applyAndSave(page);

  // all lowest, all the same, a mix, all highest: each total and the first band it is below
  const sets = [
    { options: Array(9).fill(0), total: '0', band: 'Minimal depression' },
    { options: Array(9).fill(1), total: '9', band: 'Mild depression' },
    { options: [3, 2, 1, 0, 1, 2, 3, 0, 1], total: '13', band: 'Moderate depression' },
    { options: Array(9).fill(3), total: '27', band: 'Severe depression' },
  ];
  for (const set of sets) {
    for (const [i, option] of set.options.entries()) await pickOption(page, `phq9-q${i + 1}`, option);
    for (const [shippedId, builtId, expected] of [['phq9-total', total, set.total], ['phq9-severity', severity, set.band]]) {
      await expect.poll(() => shown(page, shippedId)).toBe(expected);
      await expect.poll(() => shown(page, builtId)).toBe(expected);
    }
  }
});

test('Answer scores: the sum of the scores of three questions', async ({ page }) => {
  await insertTemplate(page, 'phq-9');
  const mine = await addField(page, 'phq9', 'First three', 'decimal');
  await makeReadOnly(page, mine);
  await openBuilder(page, mine);
  await pickKind(page, operandOf(topChain(page), 0), 'scores');
  await pickCustomSelect(page, modal(page).getByTestId('eb-scores-fn'), 'sum');
  const picks = modal(page).getByTestId('eb-scores-item');
  for (let i = 0; i < 3; i++) {
    if (i >= 1) await modal(page).getByTestId('eb-scores-add').click();
    await pickCustomSelect(page, picks.nth(i), `phq9-q${i + 1}`);
  }
  await applyAndSave(page);

  for (const [i, option] of [3, 2, 1].entries()) await pickOption(page, `phq9-q${i + 1}`, option);
  await expect.poll(() => shown(page, mine)).toBe('6'); // the options score 0–3 in order: 3 + 2 + 1
});
