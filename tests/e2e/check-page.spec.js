// ── E2E: Form Check page checks a Questionnaire that was never opened in the builder (#334) ──
// File choice, pasted JSON, a refused file, and "Open in builder" handing the checked form over.
// ── data-testid registry ─────────────────────────────────────────────────────
//   check-upload / -file / -text / -run-btn / -error / -progress   the load block on questionnaire-check.html (-progress while it runs)
//   check-report-root / -summary / -calc / -empty      the report it draws
//   check-report-open-btn / -export-btn / -csv-btn     "Open in builder" and "Save reference file" (above the report title) / CSV download
//   notif-body-error                                   the builder's error dialog (hand-off that is gone)
// The builder's rendered preview ([data-preview-id]) is the sanctioned preview-panel exception.
// ─────────────────────────────────────────────────────────────────────────────
import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from '@playwright/test';

const TEMPLATE = path.resolve('templates/phq-9.template.json');

test.describe('Form Check page', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => { try { sessionStorage.clear(); localStorage.clear(); } catch { /* none */ } });
    await page.goto('/questionnaire-check.html');
  });

  test('has the same way back to the builder as the other pages', async ({ page }) => {
    await expect(page.locator('[data-back-link]')).toHaveAttribute('href', 'index.html');
  });

  test('starts empty and offers the load block', async ({ page }) => {
    await expect(page.getByTestId('check-upload')).toBeVisible();
    await expect(page.getByTestId('check-report-empty')).toBeVisible();
    await expect(page.getByTestId('check-report-open-btn')).toHaveCount(0);
  });

  test('a chosen file is checked and reported', async ({ page }) => {
    await page.getByTestId('check-upload-file').setInputFiles(TEMPLATE);
    await expect(page.getByTestId('check-report-summary')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('check-report-calc').first()).toBeVisible();
    await expect(page.getByTestId('check-report-open-btn')).toBeVisible();
    await expect(page.getByTestId('check-report-csv-btn')).toBeVisible();
  });

  test('a running check shows its progress, then the report', async ({ page }) => {
    await page.getByTestId('check-upload-file').setInputFiles(TEMPLATE);
    await expect(page.getByTestId('check-upload-progress')).toBeVisible();
    await expect(page.getByTestId('check-upload-text')).toBeDisabled(); // no second load while it runs
    await expect(page.getByTestId('check-upload-file')).toBeDisabled();
    await expect(page.getByTestId('check-report-summary')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('check-upload-progress')).toBeHidden();
    await expect(page.getByTestId('check-upload-text')).toBeEnabled();
  });

  test('pasted JSON is checked the same way', async ({ page }) => {
    await page.getByTestId('check-upload-text').fill(fs.readFileSync(TEMPLATE, 'utf8'));
    await page.getByTestId('check-upload-run-btn').click();
    await expect(page.getByTestId('check-report-summary')).toBeVisible({ timeout: 30_000 });
  });

  test('text that is not a Questionnaire is refused with a reason', async ({ page }) => {
    await page.getByTestId('check-upload-text').fill('{ not json');
    await page.getByTestId('check-upload-run-btn').click();
    await expect(page.getByTestId('check-upload-error')).toBeVisible();
    await expect(page.getByTestId('check-report-empty')).toBeVisible();

    await page.getByTestId('check-upload-text').fill('{"resourceType":"Patient"}');
    await page.getByTestId('check-upload-run-btn').click();
    await expect(page.getByTestId('check-upload-error')).toContainText('Questionnaire');
  });

  test('Save reference file downloads a collection Bundle: the Questionnaire, then a QuestionnaireResponse per scenario with the calculated values', async ({ page }) => {
    await page.getByTestId('check-upload-file').setInputFiles(TEMPLATE);
    await expect(page.getByTestId('check-report-export-btn')).toBeVisible({ timeout: 30_000 });
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('check-report-export-btn').click()]);
    expect(download.suggestedFilename()).toBe('form-check-reference.bundle.json');
    const bundle = JSON.parse(fs.readFileSync(await download.path(), 'utf8'));
    expect(bundle).toMatchObject({ resourceType: 'Bundle', type: 'collection', meta: { tag: [{ code: 'check-reference' }] } });
    expect(bundle.entry[0].resource.resourceType).toBe('Questionnaire');
    const answers = bundle.entry.slice(1).map((e) => e.resource);
    expect(answers.length).toBeGreaterThan(10);
    expect(answers.every((r) => r.resourceType === 'QuestionnaireResponse' && r.status === 'completed')).toBe(true);
    expect(JSON.stringify(answers)).toContain('phq9-total'); // a calculated value is part of the response
  });

  test('a refused second file does not leave the first report standing', async ({ page }) => {
    await page.getByTestId('check-upload-file').setInputFiles(TEMPLATE);
    await expect(page.getByTestId('check-report-summary')).toBeVisible({ timeout: 30_000 });
    await page.getByTestId('check-upload').locator('summary').click(); // folded away once a report is shown
    await page.getByTestId('check-upload-text').fill('{ not json');
    await page.getByTestId('check-upload-run-btn').click();
    await expect(page.getByTestId('check-upload-error')).toBeVisible();
    await expect(page.getByTestId('check-report-summary')).toHaveCount(0);
    await expect(page.getByTestId('check-report-export-btn')).toHaveCount(0);
    await expect(page.getByTestId('check-report-csv-btn')).toBeHidden();
  });

  test('a builder opened with a hand-off id that is gone says so instead of staying silently empty', async ({ page }) => {
    await page.goto('/?handoff=does-not-exist');
    await expect(page.getByTestId('notif-body-error')).toContainText('no longer available');
    expect(new URL(page.url()).search).toBe(''); // a reload must not look again
  });

  test('an empty submit asks for input', async ({ page }) => {
    await page.getByTestId('check-upload-run-btn').click();
    await expect(page.getByTestId('check-upload-error')).toBeVisible();
  });

  test('Open in builder hands the checked questionnaire to a new builder tab', async ({ page, context }) => {
    await page.getByTestId('check-upload-file').setInputFiles(TEMPLATE);
    await expect(page.getByTestId('check-report-open-btn')).toBeVisible({ timeout: 30_000 });
    const [builder] = await Promise.all([context.waitForEvent('page'), page.getByTestId('check-report-open-btn').click()]);
    await expect(builder.locator('[data-preview-id="phq9-severity"]')).toBeVisible({ timeout: 15_000 });
  });
});
