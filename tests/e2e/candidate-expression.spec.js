// ── E2E: sdc-questionnaire-candidateExpression ────────────────────────────────
// Tests for import, builder UI, and export round-trip of the SDC
// candidateExpression extension on choice items. candidateExpression provides
// candidate/suggested answers (as opposed to answerExpression, which defines the
// permitted answer set). Both are modeled as mutually-exclusive answer sources
// in the Answer Type modal.
//
// Run: npx playwright test tests/e2e/candidate-expression.spec.js
//
// Fixture: tests/fixtures/candidate-expression.fhir.json
//   q-cand   — choice with candidateExpression "'alpha' | 'beta' | 'gamma'"
//   q-plain  — choice with static answerOption (control group)
//
// data-testid registry:
//   action-type            Answer Type action link
//   candidate-expr-input   FHIRPath expression textarea for candidateExpression
//   answer-expr-input      FHIRPath expression textarea for answerExpression
//   src-candidate-expr-radio  radio: candidateExpression answer source
//   src-answer-expr-radio     radio: answerExpression answer source
//   src-options-radio         radio: static options answer source
//
// element IDs:
//   answerTypeModal        Answer Type modal backdrop

import { test, expect } from '@playwright/test';
import { openDropdownItem } from './helpers/dropdown.js';
import path from 'node:path';

const FIXTURE = path.join(process.cwd(), 'tests/fixtures/candidate-expression.fhir.json');
const CE_URL  = 'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-candidateExpression';

async function loadFixture(page) {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/');
  await page.waitForSelector('[data-testid="add-root-group-btn"]', { timeout: 10_000 });
  await page.locator('[data-testid="fhir-file-input"]').setInputFiles(FIXTURE);
  await expect(page.locator('[data-preview-id="q-cand"]')).toBeVisible({ timeout: 8_000 });
}

async function readDownload(download) {
  return download.createReadStream().then(s => new Promise((res, rej) => {
    let d = '';
    s.on('data', c => d += c);
    s.on('end', () => res(d));
    s.on('error', rej);
  }));
}

// ── Import ────────────────────────────────────────────────────────────────────

test.describe('candidate-expression — import', () => {
  test('choice item with candidateExpression appears in builder', async ({ page }) => {
    await loadFixture(page);
    await expect(page.locator('[data-node-id="q-cand"]')).toBeVisible();
  });

  test('both items appear in preview', async ({ page }) => {
    await loadFixture(page);
    await expect(page.locator('[data-preview-id="q-cand"]')).toBeVisible();
    await expect(page.locator('[data-preview-id="q-plain"]')).toBeVisible();
  });
});

// ── Builder UI: Answer Type modal ─────────────────────────────────────────────

test.describe('candidate-expression — Answer Type modal', () => {
  test('Candidate radio is selected when item has candidateExpression', async ({ page }) => {
    await loadFixture(page);
    await page.locator('[data-node-id="q-cand"] [data-testid="action-type"]').click();
    await expect(page.locator('[data-testid="answerTypeModal"]')).toBeVisible();
    await expect(page.locator('#_at_src_cand')).toBeChecked();
  });

  test('Candidate textarea shows the imported expression', async ({ page }) => {
    await loadFixture(page);
    await page.locator('[data-node-id="q-cand"] [data-testid="action-type"]').click();
    await expect(page.locator('[data-testid="answerTypeModal"]')).toBeVisible();
    const textarea = page.locator('[data-testid="candidate-expr-input"]');
    await expect(textarea).toBeVisible();
    await expect(textarea).toHaveValue("'alpha' | 'beta' | 'gamma'");
  });

  test('Options list radio is selected for plain choice item', async ({ page }) => {
    await loadFixture(page);
    await page.locator('[data-node-id="q-plain"] [data-testid="action-type"]').click();
    await expect(page.locator('[data-testid="answerTypeModal"]')).toBeVisible();
    await expect(page.locator('#_at_src_opt')).toBeChecked();
    await expect(page.locator('[data-testid="candidate-expr-input"]')).toBeHidden();
  });

  test('switching to Candidate radio shows the candidate textarea', async ({ page }) => {
    await loadFixture(page);
    await page.locator('[data-node-id="q-plain"] [data-testid="action-type"]').click();
    await expect(page.locator('[data-testid="answerTypeModal"]')).toBeVisible();
    await page.locator('#_at_src_cand').click();
    await expect(page.locator('[data-testid="candidate-expr-input"]')).toBeVisible();
  });

  test('applying a new candidate expression updates the node', async ({ page }) => {
    await loadFixture(page);
    await page.locator('[data-node-id="q-plain"] [data-testid="action-type"]').click();
    await expect(page.locator('[data-testid="answerTypeModal"]')).toBeVisible();
    await page.locator('#_at_src_cand').click();
    await page.locator('[data-testid="candidate-expr-input"]').fill("'x' | 'y'");
    await page.locator('[data-testid="answerTypeModalApply"]').click();
    await expect(page.locator('[data-testid="answerTypeModal"]')).not.toBeVisible();
    await page.locator('[data-node-id="q-plain"] [data-testid="action-type"]').click();
    await expect(page.locator('[data-testid="candidate-expr-input"]')).toHaveValue("'x' | 'y'");
  });

  test('switching from candidate to answer expression is mutually exclusive', async ({ page }) => {
    await loadFixture(page);
    await page.locator('[data-node-id="q-cand"] [data-testid="action-type"]').click();
    await expect(page.locator('[data-testid="answerTypeModal"]')).toBeVisible();
    await page.locator('#_at_src_expr').click();
    await page.locator('[data-testid="answer-expr-input"]').fill("'p' | 'q'");
    await page.locator('[data-testid="answerTypeModalApply"]').click();
    await expect(page.locator('[data-testid="answerTypeModal"]')).not.toBeVisible();
    // Reopen — answerExpression should be set, candidateExpression cleared
    await page.locator('[data-node-id="q-cand"] [data-testid="action-type"]').click();
    await expect(page.locator('#_at_src_expr')).toBeChecked();
    await expect(page.locator('[data-testid="answer-expr-input"]')).toHaveValue("'p' | 'q'");
  });

  test('Cancel discards candidate expression changes', async ({ page }) => {
    await loadFixture(page);
    await page.locator('[data-node-id="q-cand"] [data-testid="action-type"]').click();
    await page.locator('[data-testid="candidate-expr-input"]').fill('changed-expression');
    await page.locator('[data-testid="answerTypeModalCancel"]').click();
    await expect(page.locator('[data-testid="answerTypeModal"]')).not.toBeVisible();
    await page.locator('[data-node-id="q-cand"] [data-testid="action-type"]').click();
    await expect(page.locator('[data-testid="candidate-expr-input"]')).toHaveValue("'alpha' | 'beta' | 'gamma'");
  });
});

// ── Export round-trip ─────────────────────────────────────────────────────────

test.describe('candidate-expression — export round-trip', () => {
  test('exported JSON contains candidateExpression extension for q-cand', async ({ page }) => {
    await loadFixture(page);
    await openDropdownItem(page, 'export-btn', 'export-quest-item');
    await expect(page.locator('[data-testid="saveFormatModal"]')).toBeVisible();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('saveFormatModalApply').click().then(() =>
        page.getByTestId('prompt-save').click()
      ),
    ]);
    const q = JSON.parse(await readDownload(download));
    const item = q.item.find(i => i.linkId === 'q-cand');
    expect(item).toBeDefined();
    const ceExt = (item.extension || []).find(e => e.url === CE_URL);
    expect(ceExt?.valueExpression?.expression).toBe("'alpha' | 'beta' | 'gamma'");
    expect(item.answerOption).toBeUndefined();
  });
});
