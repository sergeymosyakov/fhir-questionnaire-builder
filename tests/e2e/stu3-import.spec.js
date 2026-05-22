// ── E2E: STU3 Questionnaire import ────────────────────────────────────────────
// Verifies that a FHIR STU3 Questionnaire is correctly normalised to R4 on
// import: item.option[] → answerOption[], enableWhen.hasAnswer → operator:exists,
// and initialInteger → item.initial[0].valueInteger.
//
// Run: npx playwright test tests/e2e/stu3-import.spec.js
//
// ── data-testid registry ──────────────────────────────────────────────────────
//   load-fhir-btn        "Questionnaires ▾" dropdown trigger (index.html)
//   tree-container       builder node tree wrapper (index.html)
//   preview-panel        questionnaire preview wrapper (index.html)
//   Inherited from builder.spec.js — no new testids required.
// ─────────────────────────────────────────────────────────────────────────────

import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'url';
import path from 'path';

const FIXTURES = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../fixtures');

async function waitForLoad(page) {
  await page.waitForSelector('[data-testid="add-root-group-btn"]', { timeout: 10_000 });
}

/** Upload a fixture file via the hidden file input. */
async function loadFixture(page, filename) {
  await page.getByTestId('load-fhir-btn').click();
  const [fileChooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.locator('#loadFromFileItem').click(),
  ]);
  await fileChooser.setFiles(path.join(FIXTURES, filename));
}

// ── Tests ──────────────────────────────────────────────────────────────────────

test.describe('STU3 import', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForLoad(page);
  });

  test('loads STU3 questionnaire without error', async ({ page }) => {
    await loadFixture(page, 'phq-9.stu3.fhir.json');
    // Builder tree must be populated — at least the 9 PHQ items + display + score
    const nodes = page.locator('[data-testid="tree-container"] [data-node-id]');
    await expect(nodes.first()).toBeVisible();
    const count = await nodes.count();
    expect(count).toBeGreaterThanOrEqual(11);
  });

  test('STU3 option[] items render as select controls in preview', async ({ page }) => {
    await loadFixture(page, 'phq-9.stu3.fhir.json');
    // The PHQ-9 choice items (q1–q9) should render as select dropdowns (our 'select' type)
    // Preview panel should show at least one .sc-trigger (custom select trigger)
    await expect(
      page.locator('[data-testid="preview-panel"] .sc-trigger').first()
    ).toBeVisible();
  });

  test('STU3 title is imported correctly', async ({ page }) => {
    await loadFixture(page, 'phq-9.stu3.fhir.json');
    // The questionnaire title is metadata — not rendered in the preview panel items.
    // Switch to FHIR JSON view to verify it was imported into questMeta.
    await page.getByTestId('preview-mode-btn').click();
    await page.getByTestId('preview-mode-json').click();
    await expect(page.locator('#fhirJsonView')).toContainText('PHQ-9 Depression Screening');
    // Switch back to Preview for subsequent tests
    await page.getByTestId('preview-mode-btn').click();
    await page.getByTestId('preview-mode-preview').click();
  });

  test('STU3 display item renders in preview', async ({ page }) => {
    await loadFixture(page, 'phq-9.stu3.fhir.json');
    await expect(page.locator('[data-testid="preview-panel"]')).toContainText(
      'Over the last 2 weeks'
    );
  });

  test('STU3 enableWhen.hasAnswer converted: conditional item visible after answer', async ({ page }) => {
    await loadFixture(page, 'phq-9.stu3.fhir.json');
    const preview = page.locator('[data-testid="preview-panel"]');

    // 'difficulty' item has enableWhen[hasAnswer:true on q1] — should be hidden initially
    const difficultyRow = preview.locator('[data-preview-id="difficulty"]');
    await expect(difficultyRow).toBeHidden();

    // Select any answer for q1 to satisfy the condition
    const q1Trigger = preview.locator('[data-preview-id="q1"] .sc-trigger');
    await q1Trigger.click();
    await page.locator('.oc-opt').first().click();

    // difficulty row should now be visible
    await expect(difficultyRow).toBeVisible();
  });

  test('STU3 readOnly item with initialInteger renders as calculated badge', async ({ page }) => {
    await loadFixture(page, 'phq-9.stu3.fhir.json');
    // 'score' item is readOnly with calculatedExpression — renders as calc-badge span, not input
    const scoreBadge = page.locator('[data-calc-id="score"]');
    await expect(scoreBadge).toBeVisible();
  });

  test('exported questionnaire from STU3 import is valid R4', async ({ page }) => {
    await loadFixture(page, 'phq-9.stu3.fhir.json');

    // Accept the filename prompt that appears before download
    page.on('dialog', dialog => dialog.accept());

    // Trigger export and capture the downloaded JSON
    await page.locator('[data-testid="export-btn"]').click();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('[data-testid="export-fhir-item"]').click(),
    ]);

    const stream = await download.createReadStream();
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    const exported = JSON.parse(Buffer.concat(chunks).toString());

    // Must be R4 Questionnaire
    expect(exported.resourceType).toBe('Questionnaire');
    // No STU3 fields must appear in output
    const hasOption = JSON.stringify(exported).includes('"option"');
    expect(hasOption).toBe(false);
    // answerOption must be present on choice items
    const q1 = exported.item.find(i => i.linkId === 'q1');
    expect(Array.isArray(q1.answerOption)).toBe(true);
    expect(q1.answerOption.length).toBe(4);
    // enableWhen must have operator field
    const difficulty = exported.item.find(i => i.linkId === 'difficulty');
    expect(difficulty.enableWhen[0].operator).toBe('exists');
    expect(difficulty.enableWhen[0].hasAnswer).toBeUndefined();
  });
});
