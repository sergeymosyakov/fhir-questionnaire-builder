// ── E2E: every template expression written with repeat(item) opens as controls in the builder ─────────────
// Opens each template's calculated expression that uses repeat(item) in the expression builder: it must open as
// blocks (no condition left as text, no raw fallback) and applying it unchanged must give the same expression.
//
// Run: npx playwright test tests/e2e/expression-builder-repeat-templates.spec.js
//
// ── data-testid registry ──────────────────────────────────────────────────────
//   add-menu-btn                                       app ready
//   action-expr / expr-calc-ta-build-btn / expressionModal   calculated expression host
//   expressionBuilderModal(+Apply) / expr-calc-ta      builder modal / the expression field it fills
//   eb-preview-str                                     live expression text
//   eb-leaf-text / eb-raw-input                        a condition left as text / whole expression as text
// ─────────────────────────────────────────────────────────────────────────────

import path from 'node:path';
import fs from 'node:fs';
import { test, expect } from '@playwright/test';
import { loadFixtureFile } from './helpers/load-fixture.js';
import { modal } from './helpers/expr-builder.js';

const CALC = 'sdc-questionnaire-calculatedExpression';
// Whitespace outside string literals is formatting; inside a literal it is the value.
const squash = (text) => text.split(/('(?:\\.|[^'\\])*')/).map((part, i) => (i % 2 ? part : part.replace(/\s+/g, ''))).join('');

// { file → [{ id, expr }] } for every calculated expression that uses repeat(item)
const byTemplate = new Map();
for (const file of fs.readdirSync('templates').filter((f) => f.endsWith('.template.json'))) {
  const walk = (items) => (items || []).forEach((it) => {
    for (const e of it.extension || []) {
      const expr = e.valueExpression?.expression;
      if (e.url.endsWith(CALC) && expr?.includes('repeat(item)')) byTemplate.set(file, [...(byTemplate.get(file) || []), { id: it.linkId, expr }]);
    }
    walk(it.item);
  });
  walk(JSON.parse(fs.readFileSync(path.join('templates', file), 'utf8')).item);
}

test('the templates that use repeat(item) are all covered', () => {
  expect([...byTemplate.keys()]).toEqual(expect.arrayContaining(['asq.template.json', 'phq-9.template.json', 'gad-7.template.json', 'glasgow-coma-scale.template.json']));
  expect([...byTemplate.values()].flat().length).toBeGreaterThan(10);
});

for (const [file, expressions] of byTemplate) {
  test(`${file}: repeat(item) expressions open as controls and apply unchanged`, async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
    await page.goto('/');
    await page.waitForSelector('[data-testid="add-menu-btn"]', { timeout: 10_000 });
    await loadFixtureFile(page, path.resolve('templates', file));
    await expect(page.locator(`[data-node-id="${expressions[0].id}"]`).first()).toBeVisible({ timeout: 10_000 });
    for (const { id, expr } of expressions) {
      await page.locator(`[data-node-id="${id}"]`).first().getByTestId('action-expr').first().click();
      await expect(page.getByTestId('expressionModal')).toBeVisible();
      await page.getByTestId('expr-calc-ta-build-btn').click();
      await expect(modal(page)).toBeVisible();
      await expect(page.getByTestId('eb-preview-str'), `${id} did not open as blocks`).toContainText('repeat(item)');
      await expect(page.getByTestId('eb-raw-input'), `${id} as raw text`).toHaveCount(0);
      await expect(page.getByTestId('eb-leaf-text'), `${id} has a condition left as text`).toHaveCount(0);
      await page.getByTestId('expressionBuilderModalApply').click(); // applying without edits must not change it
      await expect(modal(page)).toBeHidden();
      expect(squash(await page.getByTestId('expr-calc-ta').inputValue()), `${id} changed on apply`).toBe(squash(expr));
      await page.keyboard.press('Escape'); // the expression modal behind it
      await expect(page.getByTestId('expressionModal')).toBeHidden();
    }
  });
}
