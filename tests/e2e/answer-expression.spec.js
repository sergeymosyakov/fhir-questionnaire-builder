// ── E2E: sdc-questionnaire-answerExpression ───────────────────────────────────
// Tests for import, builder UI, preview rendering, and export round-trip
// of the SDC answerExpression extension on choice/radio items.
//
// Run: npx playwright test tests/e2e/answer-expression.spec.js
//
// Fixture: tests/fixtures/answer-expression.fhir.json
//   q-expr       — choice  with answerExpression "'alpha' | 'beta' | 'gamma'"
//   q-radio-expr — radio   with answerExpression "'yes' | 'no' | 'maybe'"
//   q-plain      — choice  without answerExpression (control group)
//
// data-testid registry:
//   action-type         Answer Type action link
//   answer-expr-input   FHIRPath expression textarea inside Answer Type modal
//   options-input       Options list textarea inside Answer Type modal
//
// element IDs:
//   answerTypeModal     Answer Type modal backdrop

import { test, expect } from '@playwright/test';
import { openDropdownItem } from './helpers/dropdown.js';
import path from 'node:path';

const FIXTURE = path.join(process.cwd(), 'tests/fixtures/answer-expression.fhir.json');
const AE_URL  = 'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-answerExpression';

async function loadFixture(page) {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/');
  await page.waitForSelector('[data-testid="add-root-group-btn"]', { timeout: 10_000 });
  await page.locator('[data-testid="fhir-file-input"]').setInputFiles(FIXTURE);
  await expect(page.locator('[data-preview-id="q-expr"]')).toBeVisible({ timeout: 8_000 });
}

// ── Import: items visible ─────────────────────────────────────────────────────

test.describe('answer-expression — import', () => {
  test('choice item with answerExpression appears in builder', async ({ page }) => {
    await loadFixture(page);
    await expect(page.locator('[data-node-id="q-expr"]')).toBeVisible();
  });

  test('plain choice item without answerExpression appears in builder', async ({ page }) => {
    await loadFixture(page);
    await expect(page.locator('[data-node-id="q-plain"]')).toBeVisible();
  });

  test('all three items appear in preview', async ({ page }) => {
    await loadFixture(page);
    await expect(page.locator('[data-preview-id="q-expr"]')).toBeVisible();
    await expect(page.locator('[data-preview-id="q-radio-expr"]')).toBeVisible();
    await expect(page.locator('[data-preview-id="q-plain"]')).toBeVisible();
  });
});

// ── Builder UI: Answer Type modal shows Expression source ─────────────────────

test.describe('answer-expression — Answer Type modal', () => {
  test('Expression radio is selected when item has answerExpression', async ({ page }) => {
    await loadFixture(page);
    await page.locator('[data-node-id="q-expr"] [data-testid="action-type"]').click();
    await expect(page.locator('[data-testid="answerTypeModal"]')).toBeVisible();
    const exprRadio = page.locator('#_at_src_expr');
    await expect(exprRadio).toBeChecked();
  });

  test('Expression textarea shows the imported expression', async ({ page }) => {
    await loadFixture(page);
    await page.locator('[data-node-id="q-expr"] [data-testid="action-type"]').click();
    await expect(page.locator('[data-testid="answerTypeModal"]')).toBeVisible();
    const textarea = page.locator('[data-testid="answer-expr-input"]');
    await expect(textarea).toBeVisible();
    await expect(textarea).toHaveValue("'alpha' | 'beta' | 'gamma'");
  });

  test('Options list radio is selected for plain choice item', async ({ page }) => {
    await loadFixture(page);
    await page.locator('[data-node-id="q-plain"] [data-testid="action-type"]').click();
    await expect(page.locator('[data-testid="answerTypeModal"]')).toBeVisible();
    const optRadio = page.locator('#_at_src_opt');
    await expect(optRadio).toBeChecked();
    const exprSection = page.locator('[data-testid="answer-expr-input"]');
    await expect(exprSection).toBeHidden();
  });

  test('switching to Expression radio shows textarea', async ({ page }) => {
    await loadFixture(page);
    await page.locator('[data-node-id="q-plain"] [data-testid="action-type"]').click();
    await expect(page.locator('[data-testid="answerTypeModal"]')).toBeVisible();
    await page.locator('#_at_src_expr').click();
    await expect(page.locator('[data-testid="answer-expr-input"]')).toBeVisible();
  });

  test('applying a new expression updates the node', async ({ page }) => {
    await loadFixture(page);
    await page.locator('[data-node-id="q-plain"] [data-testid="action-type"]').click();
    await expect(page.locator('[data-testid="answerTypeModal"]')).toBeVisible();
    await page.locator('#_at_src_expr').click();
    await page.locator('[data-testid="answer-expr-input"]').fill("'x' | 'y'");
    await page.locator('[data-testid="answerTypeModalApply"]').click();
    await expect(page.locator('[data-testid="answerTypeModal"]')).not.toBeVisible();
    // Reopen modal and verify expression was saved
    await page.locator('[data-node-id="q-plain"] [data-testid="action-type"]').click();
    await expect(page.locator('[data-testid="answer-expr-input"]')).toHaveValue("'x' | 'y'");
  });

  test('Cancel discards expression changes', async ({ page }) => {
    await loadFixture(page);
    await page.locator('[data-node-id="q-expr"] [data-testid="action-type"]').click();
    await page.locator('[data-testid="answer-expr-input"]').fill('changed-expression');
    await page.locator('[data-testid="answerTypeModalCancel"]').click();
    await expect(page.locator('[data-testid="answerTypeModal"]')).not.toBeVisible();
    // Reopen — should still have original
    await page.locator('[data-node-id="q-expr"] [data-testid="action-type"]').click();
    await expect(page.locator('[data-testid="answer-expr-input"]')).toHaveValue("'alpha' | 'beta' | 'gamma'");
  });
});

// ── Preview: choice control renders ──────────────────────────────────────────

test.describe('answer-expression — preview rendering', () => {
  test('choice item with answerExpression renders a dropdown trigger', async ({ page }) => {
    await loadFixture(page);
    const trigger = page.locator('[data-preview-id="q-expr"] .sc-trigger');
    await expect(trigger).toBeVisible();
  });

  test('radio item with answerExpression renders radio labels', async ({ page }) => {
    await loadFixture(page);
    const radioWrap = page.locator('[data-preview-id="q-radio-expr"]');
    await expect(radioWrap.locator('.radio-label').first()).toBeVisible();
  });
});

// ── Export round-trip ─────────────────────────────────────────────────────────

test.describe('answer-expression — export round-trip', () => {
  test('exported JSON contains answerExpression extension for q-expr', async ({ page }) => {
    await loadFixture(page);
    await openDropdownItem(page, 'export-btn', 'export-quest-item');
    await expect(page.locator('[data-testid="saveFormatModal"]')).toBeVisible();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('saveFormatModalApply').click().then(() =>
        page.getByTestId('prompt-save').click()
      ),
    ]);
    const content = await download.createReadStream().then(s => {
      return new Promise((res, rej) => {
        let d = '';
        s.on('data', c => d += c);
        s.on('end', () => res(d));
        s.on('error', rej);
      });
    });
    const q = JSON.parse(content);
    const item = q.item.find(i => i.linkId === 'q-expr');
    expect(item).toBeDefined();
    const aeExt = (item.extension || []).find(e => e.url === AE_URL);
    expect(aeExt?.valueExpression?.expression).toBe("'alpha' | 'beta' | 'gamma'");
    expect(item.answerOption).toBeUndefined();
  });

  test('exported JSON preserves plain answerOption for q-plain', async ({ page }) => {
    await loadFixture(page);
    await openDropdownItem(page, 'export-btn', 'export-quest-item');
    await expect(page.locator('[data-testid="saveFormatModal"]')).toBeVisible();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('saveFormatModalApply').click().then(() =>
        page.getByTestId('prompt-save').click()
      ),
    ]);
    const content = await download.createReadStream().then(s => {
      return new Promise((res, rej) => {
        let d = '';
        s.on('data', c => d += c);
        s.on('end', () => res(d));
        s.on('error', rej);
      });
    });
    const q = JSON.parse(content);
    const item = q.item.find(i => i.linkId === 'q-plain');
    expect(item?.answerOption).toHaveLength(2);
    const aeExt = (item?.extension || []).find(e => e.url === AE_URL);
    expect(aeExt).toBeUndefined();
  });
});
