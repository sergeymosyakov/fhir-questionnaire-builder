// ── E2E: Form Check page compares an edited form with a saved reference file (#296) ──
// A reference file is saved from a check of PHQ-9; the edited forms are written next to it.
// ── data-testid registry ─────────────────────────────────────────────────────
//   check-mode-check / check-mode-compare                               what-to-do choice
//   check-upload-file / check-report-summary / check-report-export-btn   check a form, save its reference file
//   compare-upload / compare-reference-file / compare-reference-text / compare-current-file / compare-current-text   the compare block
//   compare-generated                                                   "also try the generated answer sets" box
//   check-report-reset-btn                                              "Clear" of the report
//   compare-run-btn / compare-error / compare-progress                  run, refusal, progress while it runs
//   compare-summary / compare-calc (data-status) / compare-example / compare-formula-note / compare-questions   the comparison report
// ─────────────────────────────────────────────────────────────────────────────
import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from '@playwright/test';

const TEMPLATE = path.resolve('templates/phq-9.template.json');

test.describe('compare with a reference file', () => {
  let reference;
  test.beforeEach(async ({ page }, testInfo) => {
    await page.addInitScript(() => { try { sessionStorage.clear(); localStorage.clear(); } catch { /* none */ } });
    await page.goto('/questionnaire-check.html');
    await page.getByTestId('check-mode-check').click();
    await page.getByTestId('check-upload-file').setInputFiles(TEMPLATE);
    await expect(page.getByTestId('check-report-export-btn')).toBeVisible({ timeout: 30_000 });
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('check-report-export-btn').click()]);
    reference = testInfo.outputPath('reference.bundle.json');
    fs.copyFileSync(await download.path(), reference);
    await page.getByTestId('check-mode-compare').click();
  });

  const edited = (testInfo, name, from, to) => {
    const file = testInfo.outputPath(name);
    fs.writeFileSync(file, fs.readFileSync(TEMPLATE, 'utf8').replace(from, to));
    return file;
  };

  test('an unchanged form changes nothing', async ({ page }) => {
    await page.getByTestId('compare-current-file').setInputFiles(TEMPLATE);
    await page.getByTestId('compare-reference-file').setInputFiles(reference);
    await page.getByTestId('compare-run-btn').click();
    await expect(page.getByTestId('compare-summary')).toContainText('none changed', { timeout: 60_000 });
    await expect(page.getByTestId('compare-calc')).toHaveCount(2);
    await expect(page.locator('[data-testid="compare-calc"]:not([data-status="same"])')).toHaveCount(0);
  });

  test('only the answer sets in the file are run unless the generated ones are asked for', async ({ page }, testInfo) => {
    const wider = testInfo.outputPath('wider.json');
    const q = JSON.parse(fs.readFileSync(TEMPLATE, 'utf8'));
    const addOption = (items) => items.forEach((i) => { if (i.linkId === 'phq9-q1') i.answerOption.push({ valueCoding: { system: 'http://loinc.org', code: 'LA-NEW', display: 'A new answer' } }); if (i.item) addOption(i.item); });
    addOption(q.item);
    fs.writeFileSync(wider, JSON.stringify(q));
    await page.getByTestId('compare-current-file').setInputFiles(wider);
    await page.getByTestId('compare-reference-file').setInputFiles(reference);
    await page.getByTestId('compare-run-btn').click();
    await expect(page.getByTestId('compare-summary')).not.toContainText('more generated', { timeout: 60_000 });
    await page.getByTestId('check-mode-compare').click();
    await page.getByTestId('compare-current-file').setInputFiles(wider);
    await page.getByTestId('compare-reference-file').setInputFiles(reference);
    await page.getByTestId('compare-generated').check();
    await page.getByTestId('compare-run-btn').click();
    await expect(page.getByTestId('compare-summary')).toContainText('more generated', { timeout: 60_000 });
  });

  test('a moved threshold shows which calculation changed and on which answers', async ({ page }, testInfo) => {
    await page.getByTestId('compare-current-file').setInputFiles(edited(testInfo, 'moved.json', '< 15', '< 10'));
    await page.getByTestId('compare-reference-file').setInputFiles(reference);
    await page.getByTestId('compare-run-btn').click();
    await expect(page.getByTestId('compare-summary')).toContainText('1 changed', { timeout: 60_000 });
    const changed = page.locator('[data-testid="compare-calc"][data-status="changed"]');
    await expect(changed).toHaveCount(1);
    await expect(changed.getByTestId('compare-formula-note')).toBeVisible();
    await expect(changed.getByTestId('compare-example').first()).toContainText('was “Moderate depression”');
    await expect(page.locator('[data-testid="compare-calc"][data-status="same"]')).toHaveCount(1);
  });

  test('a report left by the builder window does not come back after a run', async ({ page }) => {
    const stale = { title: 'Stale form', when: new Date().toISOString(), scenarios: 0, truncated: false, unshown: [], calcs: [], trials: [], questionnaire: null };
    await page.evaluate((r) => sessionStorage.setItem('fhirqb.checkReport', JSON.stringify(r)), stale);
    await page.getByTestId('compare-reference-file').setInputFiles(reference);
    await page.getByTestId('compare-current-file').setInputFiles(TEMPLATE);
    await page.getByTestId('compare-run-btn').click();
    await expect(page.getByTestId('compare-summary')).toBeVisible({ timeout: 60_000 });
    expect(await page.evaluate(() => sessionStorage.getItem('fhirqb.checkReport'))).toBeNull();
  });

  test('Clear empties both inputs and the comparison', async ({ page }) => {
    await page.getByTestId('compare-reference-file').setInputFiles(reference);
    await page.getByTestId('compare-current-file').setInputFiles(TEMPLATE);
    await page.getByTestId('compare-run-btn').click();
    await expect(page.getByTestId('compare-summary')).toBeVisible({ timeout: 60_000 });
    await page.getByTestId('check-report-reset-btn').click();
    await expect(page.getByTestId('compare-summary')).toHaveCount(0);
    await page.getByTestId('check-mode-compare').click();
    await page.getByTestId('compare-run-btn').click(); // the files are gone: asked for again
    await expect(page.getByTestId('compare-error')).toBeVisible();
  });

  test('pasted JSON works for the current questionnaire', async ({ page }) => {
    await page.getByTestId('compare-reference-file').setInputFiles(reference);
    await page.getByTestId('compare-current-text').fill(fs.readFileSync(TEMPLATE, 'utf8'));
    await page.getByTestId('compare-run-btn').click();
    await expect(page.getByTestId('compare-summary')).toBeVisible({ timeout: 60_000 });
  });

  test('a missing or wrong file is refused with a reason', async ({ page }) => {
    await page.getByTestId('compare-run-btn').click();
    await expect(page.getByTestId('compare-error')).toBeVisible();
    await page.getByTestId('compare-reference-file').setInputFiles(TEMPLATE); // a Questionnaire is not a reference file
    await page.getByTestId('compare-current-file').setInputFiles(TEMPLATE);
    await page.getByTestId('compare-run-btn').click();
    await expect(page.getByTestId('compare-error')).toContainText('Bundle');
    await expect(page.getByTestId('compare-summary')).toHaveCount(0);
  });
});
