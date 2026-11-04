// ── E2E: Expression Gallery (issue #122) ──────────────────────────────────────
// Pick a named FHIRPath pattern from the gallery, fill its slots, and confirm
// the resolved expression lands in the calculatedExpression textarea.
//
// Run: npx playwright test tests/e2e/expression-gallery.spec.js
//
// ── data-testid used in this suite ───────────────────────────────────────────
//   add-root-group-btn / group-add-btn / add-menu-item / node-title-*   builder
//   action-type / answerTypeModal / type-select / answerTypeModalApply  item type
//   action-expr / expr-calc-ta / expr-calc-ta-build-btn                 value host
//   expressionBuilderModal / eb-choose-gallery                          builder entry
//   expressionGalleryModal / eg-search / eg-row-<id> / eg-slot-item-<key> /
//     eg-slot-transform-<key> / eg-preview / expressionGalleryModalApply gallery modal
//   eg-source                                                            pattern source note
//   eg-const-<key>                                                       pattern constant input
//   eg-slot-add-<key> / eg-slot-row-<key>-<i> / eg-slot-remove-<key>-<i>       repeatable slot
//   csel-drop [data-val]                                                custom-select option
// ─────────────────────────────────────────────────────────────────────────────

import { test, expect } from '@playwright/test';

async function freshStart(page) {
  await page.goto('/');
  await page.waitForSelector('[data-testid="add-root-group-btn"]', { timeout: 10_000 });
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
  await page.getByTestId('type-select').click();
  await page.locator(`[data-testid="csel-drop"] [data-val="${typeValue}"]`).click();
  await page.getByTestId('answerTypeModalApply').click();
  await expect(page.getByTestId('answerTypeModal')).toBeHidden();
}

async function pick(scope, page, testid, value) {
  await scope.getByTestId(testid).click();
  const opt = page.locator('[data-testid="csel-drop"]').locator(`[data-val="${value}"]`);
  await expect(opt).toBeVisible();
  await opt.click();
}

async function openValueBuilder(page, nodeId) {
  const exprLink = page.locator(`[data-node-id="${nodeId}"]`).getByTestId('action-expr');
  await expect(exprLink).toBeVisible();
  await exprLink.click();
  await expect(page.getByTestId('expressionModal')).toBeVisible();
  await page.getByTestId('expr-calc-ta-build-btn').click();
  await expect(page.getByTestId('expressionBuilderModal')).toBeVisible();
}

test.describe('Expression Gallery', () => {
  test('BMI pattern with unit conversion resolves into the calculatedExpression field', async ({ page }) => {
    await freshStart(page);
    await page.getByTestId('add-root-group-btn').click();
    await expect(page.locator('[data-node-id="1"]')).toBeVisible();
    await addItem(page, '1', '1.1', 'Weight');
    await setItemType(page, '1.1', 'decimal');
    await addItem(page, '1', '1.2', 'Height');
    await setItemType(page, '1.2', 'decimal');
    await addItem(page, '1', '1.3', 'BMI');
    await setItemType(page, '1.3', 'decimal');

    await openValueBuilder(page, '1.3');
    await page.getByTestId('eb-choose-gallery').click();
    await expect(page.getByTestId('expressionGalleryModal')).toBeVisible();
    await page.getByTestId('eg-row-bmi').click();

    await pick(page, page, 'eg-slot-item-weight', '1.1');
    await pick(page, page, 'eg-slot-transform-weight', 'lb');
    await pick(page, page, 'eg-slot-item-height', '1.2');
    await pick(page, page, 'eg-slot-transform-height', 'cm');

    await expect(page.getByTestId('eg-preview')).toContainText('0.453592');
    await expect(page.getByTestId('eg-preview')).toContainText('round(1)');

    await page.getByTestId('expressionGalleryModalApply').click();
    await expect(page.getByTestId('expressionGalleryModal')).toBeHidden();
    await expect(page.getByTestId('expressionBuilderModal')).toBeVisible();
    // textarea current value lives in .value, not textContent — toHaveValue, not toContainText
    await expect(page.getByTestId('eb-raw-input')).toHaveValue(/linkId='1\.1'/);
    await expect(page.getByTestId('eb-raw-input')).toHaveValue(/linkId='1\.2'/);

    await page.getByTestId('expressionBuilderModalApply').click();
    await expect(page.getByTestId('expressionBuilderModal')).toBeHidden();
    await expect(page.getByTestId('expr-calc-ta')).toHaveValue(/round\(1\)/);
  });

  test('bmi-imperial pattern resolves without unit conversion (already lb/in)', async ({ page }) => {
    await freshStart(page);
    await page.getByTestId('add-root-group-btn').click();
    await expect(page.locator('[data-node-id="1"]')).toBeVisible();
    await addItem(page, '1', '1.1', 'Weight');
    await setItemType(page, '1.1', 'decimal');
    await addItem(page, '1', '1.2', 'Height');
    await setItemType(page, '1.2', 'decimal');
    await addItem(page, '1', '1.3', 'BMI');
    await setItemType(page, '1.3', 'decimal');

    await openValueBuilder(page, '1.3');
    await page.getByTestId('eb-choose-gallery').click();
    await expect(page.getByTestId('expressionGalleryModal')).toBeVisible();
    await page.getByTestId('eg-row-bmi-imperial').click();

    await pick(page, page, 'eg-slot-item-weight', '1.1');
    await pick(page, page, 'eg-slot-item-height', '1.2');

    await expect(page.getByTestId('eg-preview')).toContainText('703');
    await expect(page.getByTestId('eg-preview')).not.toContainText('0.453592');

    await page.getByTestId('expressionGalleryModalApply').click();
    await page.getByTestId('expressionBuilderModalApply').click();
    await expect(page.getByTestId('expr-calc-ta')).toHaveValue(/703/);
  });

  test('bmi-category pattern resolves to a threshold-category iif() chain', async ({ page }) => {
    await freshStart(page);
    await page.getByTestId('add-root-group-btn').click();
    await expect(page.locator('[data-node-id="1"]')).toBeVisible();
    await addItem(page, '1', '1.1', 'Weight');
    await setItemType(page, '1.1', 'decimal');
    await addItem(page, '1', '1.2', 'Height');
    await setItemType(page, '1.2', 'decimal');
    await addItem(page, '1', '1.3', 'BMI Category');
    await setItemType(page, '1.3', 'text');

    await openValueBuilder(page, '1.3');
    await page.getByTestId('eb-choose-gallery').click();
    await expect(page.getByTestId('expressionGalleryModal')).toBeVisible();
    await page.getByTestId('eg-row-bmi-category').click();

    await pick(page, page, 'eg-slot-item-weight', '1.1');
    await pick(page, page, 'eg-slot-item-height', '1.2');

    await expect(page.getByTestId('eg-preview')).toContainText('iif(');
    await expect(page.getByTestId('eg-preview')).toContainText('Underweight');
    await expect(page.getByTestId('eg-preview')).toContainText('Obese');

    await page.getByTestId('expressionGalleryModalApply').click();
    await expect(page.getByTestId('eb-raw-input')).toHaveValue(/iif\(/);
    await expect(page.getByTestId('eb-raw-input')).toHaveValue(/'Normal weight'/);

    await page.getByTestId('expressionBuilderModalApply').click();
    await expect(page.getByTestId('expr-calc-ta')).toHaveValue(/iif\(/);
  });

  test('gallery Cancel returns to the builder chooser without inserting anything', async ({ page }) => {
    await freshStart(page);
    await page.getByTestId('add-root-group-btn').click();
    await expect(page.locator('[data-node-id="1"]')).toBeVisible();
    await addItem(page, '1', '1.1', 'Score');
    await setItemType(page, '1.1', 'decimal');

    await openValueBuilder(page, '1.1');
    await page.getByTestId('eb-choose-gallery').click();
    await expect(page.getByTestId('expressionGalleryModal')).toBeVisible();
    await page.getByTestId('expressionGalleryModalCancel').click();
    await expect(page.getByTestId('expressionGalleryModal')).toBeHidden();
    await expect(page.getByTestId('expressionBuilderModal')).toBeVisible();
    await expect(page.getByTestId('expr-calc-ta')).toHaveValue('');
  });

  test('search filters the pattern list by name/description', async ({ page }) => {
    await freshStart(page);
    await page.getByTestId('add-root-group-btn').click();
    await expect(page.locator('[data-node-id="1"]')).toBeVisible();
    await addItem(page, '1', '1.1', 'Score');
    await setItemType(page, '1.1', 'decimal');

    await openValueBuilder(page, '1.1');
    await page.getByTestId('eb-choose-gallery').click();
    await expect(page.getByTestId('expressionGalleryModal')).toBeVisible();

    await expect(page.getByTestId('eg-row-bmi')).toBeVisible();
    await expect(page.getByTestId('eg-row-age-from-birthdate')).toBeVisible();

    await page.getByTestId('eg-search').fill('body mass');
    await expect(page.getByTestId('eg-row-bmi')).toBeVisible();
    await expect(page.getByTestId('eg-row-age-from-birthdate')).toBeHidden();

    await page.getByTestId('eg-search').fill('nonexistent pattern xyz');
    await expect(page.getByTestId('eg-search-empty')).toBeVisible();
  });

  test('sum-of-items repeatable slot supports adding and removing rows', async ({ page }) => {
    await freshStart(page);
    await page.getByTestId('add-root-group-btn').click();
    await expect(page.locator('[data-node-id="1"]')).toBeVisible();
    await addItem(page, '1', '1.1', 'Score A');
    await setItemType(page, '1.1', 'decimal');
    await addItem(page, '1', '1.2', 'Score B');
    await setItemType(page, '1.2', 'decimal');
    await addItem(page, '1', '1.3', 'Score C');
    await setItemType(page, '1.3', 'decimal');
    await addItem(page, '1', '1.4', 'Total');
    await setItemType(page, '1.4', 'decimal');

    await openValueBuilder(page, '1.4');
    await page.getByTestId('eb-choose-gallery').click();
    await expect(page.getByTestId('expressionGalleryModal')).toBeVisible();
    await page.getByTestId('eg-row-sum-of-items').click();

    // starts with 2 rows (min: 2) and no remove button yet
    await expect(page.getByTestId('eg-slot-row-items-0')).toBeVisible();
    await expect(page.getByTestId('eg-slot-row-items-1')).toBeVisible();
    await expect(page.getByTestId('eg-slot-remove-items-0')).toBeHidden();

    await pick(page, page, 'eg-slot-item-items-0', '1.1');
    await pick(page, page, 'eg-slot-item-items-1', '1.2');
    await expect(page.getByTestId('eg-preview')).toContainText("linkId='1.1'");
    await expect(page.getByTestId('eg-preview')).toContainText("linkId='1.2'");

    // add a 3rd row — now removable
    await page.getByTestId('eg-slot-add-items').click();
    await expect(page.getByTestId('eg-slot-row-items-2')).toBeVisible();
    await pick(page, page, 'eg-slot-item-items-2', '1.3');
    await expect(page.getByTestId('eg-preview')).toContainText("linkId='1.3'");
    await expect(page.getByTestId('eg-slot-remove-items-0')).toBeVisible();

    // remove the middle row — its item drops out, the others survive
    await page.getByTestId('eg-slot-remove-items-1').click();
    await expect(page.getByTestId('eg-slot-row-items-2')).toBeHidden();
    await expect(page.getByTestId('eg-preview')).toContainText("linkId='1.1'");
    await expect(page.getByTestId('eg-preview')).toContainText("linkId='1.3'");
    await expect(page.getByTestId('eg-preview')).not.toContainText("linkId='1.2'");

    await page.getByTestId('expressionGalleryModalApply').click();
    await expect(page.getByTestId('expressionBuilderModal')).toBeVisible();
    await expect(page.getByTestId('eb-raw-input')).toHaveValue(/linkId='1\.1'/);
    await expect(page.getByTestId('eb-raw-input')).toHaveValue(/linkId='1\.3'/);

    await page.getByTestId('expressionBuilderModalApply').click();
    await expect(page.getByTestId('expressionBuilderModal')).toBeHidden();
    await expect(page.getByTestId('expr-calc-ta')).not.toHaveValue('');
  });

  test('charlson-comorbidity-index hides an already-picked condition from other rows', async ({ page }) => {
    await freshStart(page);
    await page.getByTestId('add-root-group-btn').click();
    await expect(page.locator('[data-node-id="1"]')).toBeVisible();
    await addItem(page, '1', '1.1', 'Has MI');
    await setItemType(page, '1.1', 'checkbox');
    await addItem(page, '1', '1.2', 'Has AIDS');
    await setItemType(page, '1.2', 'checkbox');
    await addItem(page, '1', '1.3', 'Age');
    await setItemType(page, '1.3', 'integer');
    await addItem(page, '1', '1.4', 'CCI Score');
    await setItemType(page, '1.4', 'decimal');

    await openValueBuilder(page, '1.4');
    await page.getByTestId('eb-choose-gallery').click();
    await expect(page.getByTestId('expressionGalleryModal')).toBeVisible();
    await page.getByTestId('eg-row-charlson-comorbidity-index').click();

    await pick(page, page, 'eg-slot-item-conditions-0', '1.1');
    await pick(page, page, 'eg-slot-transform-conditions-0', 'mi');

    await page.getByTestId('eg-slot-add-conditions').click();
    await page.getByTestId('eg-slot-transform-conditions-1').click();
    await expect(page.locator('[data-testid="csel-drop"] [data-val="mi"]')).toBeHidden();
    await expect(page.locator('[data-testid="csel-drop"] [data-val="aids"]')).toBeVisible();
    await page.locator('[data-testid="csel-drop"] [data-val="aids"]').click();
    await pick(page, page, 'eg-slot-item-conditions-1', '1.2');

    await pick(page, page, 'eg-slot-item-age', '1.3');
    await page.getByTestId('eg-slot-transform-age').click();
    await page.locator('[data-testid="csel-drop"] [data-val="age-bonus"]').click();

    await expect(page.getByTestId('eg-preview')).toContainText("linkId='1.1'");
    await expect(page.getByTestId('eg-preview')).toContainText("linkId='1.2'");
    await expect(page.getByTestId('eg-preview')).toContainText("linkId='1.3'");
  });

  test('glasgow-coma-scale pattern resolves to a severity-band iif() chain', async ({ page }) => {
    await freshStart(page);
    await page.getByTestId('add-root-group-btn').click();
    await expect(page.locator('[data-node-id="1"]')).toBeVisible();
    await addItem(page, '1', '1.1', 'Eye');
    await setItemType(page, '1.1', 'integer');
    await addItem(page, '1', '1.2', 'Verbal');
    await setItemType(page, '1.2', 'integer');
    await addItem(page, '1', '1.3', 'Motor');
    await setItemType(page, '1.3', 'integer');
    await addItem(page, '1', '1.4', 'GCS band');
    await setItemType(page, '1.4', 'text');

    await openValueBuilder(page, '1.4');
    await page.getByTestId('eb-choose-gallery').click();
    await page.getByTestId('eg-row-glasgow-coma-scale').click();
    await pick(page, page, 'eg-slot-item-eye', '1.1');
    await pick(page, page, 'eg-slot-item-verbal', '1.2');
    await pick(page, page, 'eg-slot-item-motor', '1.3');

    await expect(page.getByTestId('eg-preview')).toContainText('Severe (GCS 3');
    await expect(page.getByTestId('eg-preview')).toContainText('Mild (GCS 13');
    await page.getByTestId('expressionGalleryModalApply').click();
    await expect(page.getByTestId('eb-raw-input')).toHaveValue(/iif\(/);
    await page.getByTestId('expressionBuilderModalApply').click();
    await expect(page.getByTestId('expr-calc-ta')).toHaveValue(/Moderate \(GCS 9/);
  });

  test('count-yes-answers turns each yes/no row into 1/0 via its default transform', async ({ page }) => {
    await freshStart(page);
    await page.getByTestId('add-root-group-btn').click();
    await expect(page.locator('[data-node-id="1"]')).toBeVisible();
    await addItem(page, '1', '1.1', 'Smoker');
    await setItemType(page, '1.1', 'checkbox');
    await addItem(page, '1', '1.2', 'Drinker');
    await setItemType(page, '1.2', 'checkbox');
    await addItem(page, '1', '1.3', 'Yes count');
    await setItemType(page, '1.3', 'integer');

    await openValueBuilder(page, '1.3');
    await page.getByTestId('eb-choose-gallery').click();
    await page.getByTestId('eg-row-count-yes-answers').click();
    await pick(page, page, 'eg-slot-item-items-0', '1.1');
    await pick(page, page, 'eg-slot-item-items-1', '1.2');

    await expect(page.getByTestId('eg-preview')).toContainText('iif(');
    await expect(page.getByTestId('eg-preview')).toContainText("linkId='1.2'");
    await page.getByTestId('expressionGalleryModalApply').click();
    await page.getByTestId('expressionBuilderModalApply').click();
    await expect(page.getByTestId('expr-calc-ta')).toHaveValue(/iif\(.*, 1, 0\)\) \+ \(iif\(.*, 1, 0\)\)\)/);
  });

  test('egfr-ckd-epi-2021: sex offers only choice items; the female code constant is overridable', async ({ page }) => {
    await freshStart(page);
    await page.getByTestId('add-root-group-btn').click();
    await expect(page.locator('[data-node-id="1"]')).toBeVisible();
    await addItem(page, '1', '1.1', 'Creatinine');
    await setItemType(page, '1.1', 'decimal');
    await addItem(page, '1', '1.2', 'Age');
    await setItemType(page, '1.2', 'integer');
    await addItem(page, '1', '1.3', 'Sex');
    await setItemType(page, '1.3', 'radio');
    await addItem(page, '1', '1.4', 'eGFR');
    await setItemType(page, '1.4', 'decimal');

    await openValueBuilder(page, '1.4');
    await page.getByTestId('eb-choose-gallery').click();
    await page.getByTestId('eg-row-egfr-ckd-epi-2021').click();
    await pick(page, page, 'eg-slot-item-scr', '1.1');
    await pick(page, page, 'eg-slot-item-age', '1.2');
    await page.getByTestId('eg-slot-item-sex').click();
    await expect(page.locator('[data-testid="csel-drop"] [data-val="1.3"]')).toBeVisible();
    await expect(page.locator('[data-testid="csel-drop"] [data-val="1.1"]')).toHaveCount(0);
    await page.locator('[data-testid="csel-drop"] [data-val="1.3"]').click();

    await expect(page.getByTestId('eg-source')).toContainText('Inker');
    // constant is prefilled with its default and drives the formula
    await expect(page.getByTestId('eg-const-female')).toHaveValue('female');
    await expect(page.getByTestId('eg-preview')).toContainText("= 'female'");
    await page.getByTestId('eg-const-female').fill('custom1');
    await expect(page.getByTestId('eg-preview')).toContainText("= 'custom1'");
    await expect(page.getByTestId('eg-preview')).not.toContainText("'female'");
    // blank falls back to the default
    await page.getByTestId('eg-const-female').fill('');
    await expect(page.getByTestId('eg-preview')).toContainText("= 'female'");
    await page.getByTestId('eg-const-female').fill('F');

    await page.getByTestId('expressionGalleryModalApply').click();
    await page.getByTestId('expressionBuilderModalApply').click();
    await expect(page.getByTestId('expr-calc-ta')).toHaveValue(/= 'F'/);
  });

  // One build-and-insert check per remaining pattern: create the input items,
  // pick each slot, and confirm the resolved FHIRPath lands in the field.
  // (Numeric correctness is covered against real fhirpath in the unit tests.)
  const PATTERNS = [
    { id: 'percent-change', slots: [['baseline', 'decimal'], ['current', 'decimal']], result: 'decimal', fragment: '* 100' },
    { id: 'phq2-screen', slots: [['q1', 'integer'], ['q2', 'integer']], result: 'text', fragment: 'Positive screen' },
    { id: 'apgar-score', slots: [['appearance', 'integer'], ['pulse', 'integer'], ['grimace', 'integer'], ['activity', 'integer'], ['respiration', 'integer']], result: 'text', fragment: 'Reassuring' },
    { id: 'qsofa', slots: [['resp', 'checkbox'], ['mentation', 'checkbox'], ['sbp', 'checkbox']], result: 'text', fragment: 'High risk' },
    { id: 'bsa-mosteller', slots: [['height', 'decimal'], ['weight', 'decimal']], result: 'decimal', fragment: '.sqrt()' },
    { id: 'mean-arterial-pressure', slots: [['sbp', 'decimal'], ['dbp', 'decimal']], result: 'decimal', fragment: '/ 3' },
    { id: 'anion-gap', slots: [['na', 'decimal'], ['cl', 'decimal'], ['hco3', 'decimal']], result: 'decimal', fragment: ' - (' },
    { id: 'cockcroft-gault', slots: [['age', 'integer'], ['weight', 'decimal'], ['scr', 'decimal'], ['sex', 'radio']], result: 'decimal', fragment: '0.85', consts: true },
    { id: 'due-date-naegele', slots: [['lmp', 'date']], result: 'date', fragment: '280 days' },
    { id: 'date-plus-interval', slots: [['date', 'date']], result: 'date', fragment: '+ 1 week' },
    { id: 'age-at-date', slots: [['birth', 'date'], ['at', 'date']], result: 'integer', fragment: 'substring(0,4)' },
    { id: 'age-in-months', slots: [['birth', 'date'], ['at', 'date']], result: 'integer', fragment: '* 12' },
    { id: 'corrected-calcium', slots: [['ca', 'decimal'], ['alb', 'decimal']], result: 'decimal', fragment: '0.8 *' },
    { id: 'ldl-friedewald', slots: [['tc', 'decimal'], ['hdl', 'decimal'], ['tg', 'decimal']], result: 'decimal', fragment: '/ 5' },
    { id: 'homa-ir', slots: [['glucose', 'decimal'], ['insulin', 'decimal']], result: 'decimal', fragment: '/ 405' },
    { id: 'fib4', slots: [['age', 'integer'], ['ast', 'decimal'], ['alt', 'decimal'], ['plt', 'decimal']], result: 'text', fragment: 'High risk' },
    { id: 'qtc-bazett', slots: [['qt', 'decimal'], ['hr', 'decimal']], result: 'decimal', fragment: '.sqrt()' },
    { id: 'qtc-fridericia', slots: [['qt', 'decimal'], ['hr', 'decimal']], result: 'decimal', fragment: '.power(1 / 3)' },
    { id: 'ideal-body-weight', slots: [['height', 'decimal'], ['sex', 'radio']], result: 'decimal', fragment: '45.5', consts: true },
    { id: 'waist-hip-ratio', slots: [['waist', 'decimal'], ['hip', 'decimal']], result: 'decimal', fragment: '.round(2)' },
  ];

  for (const p of PATTERNS) {
    test(`${p.id} pattern resolves into the field`, async ({ page }) => {
      await freshStart(page);
      await page.getByTestId('add-root-group-btn').click();
      await expect(page.locator('[data-node-id="1"]')).toBeVisible();
      for (const [i, [key, type]] of p.slots.entries()) {
        await addItem(page, '1', `1.${i + 1}`, key);
        await setItemType(page, `1.${i + 1}`, type);
      }
      const resultId = `1.${p.slots.length + 1}`;
      await addItem(page, '1', resultId, 'Result');
      await setItemType(page, resultId, p.result);

      await openValueBuilder(page, resultId);
      await page.getByTestId('eb-choose-gallery').click();
      await page.getByTestId(`eg-row-${p.id}`).click();
      for (const [i, [key]] of p.slots.entries()) {
        await pick(page, page, `eg-slot-item-${key}`, `1.${i + 1}`);
      }
      // the constants block only exists for patterns that declare constants
      await expect(page.getByTestId('eg-const-female')).toHaveCount(p.consts ? 1 : 0);
      await expect(page.getByTestId('eg-preview')).toContainText(p.fragment);
      await page.getByTestId('expressionGalleryModalApply').click();
      await page.getByTestId('expressionBuilderModalApply').click();
      await expect(page.getByTestId('expr-calc-ta')).toHaveValue(new RegExp(p.fragment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    });
  }
});

