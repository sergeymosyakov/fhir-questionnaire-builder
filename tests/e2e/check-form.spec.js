// ── E2E: Settings ▾ → Check my form (#334) ───────────────────────────────────
// Loads the shipped PHQ-9 template, once as is and once with a moved threshold that makes a band unreachable.
// ── data-testid registry ─────────────────────────────────────────────────────
//   tools-btn / check-form-item   Settings menu trigger and entry
//   checkFormModal                modal backdrop
//   check-form-summary            one-line verdict
//   check-form-row                one calculation (data-status)
//   check-form-nav-btn            "go to node" button of a row
//   check-form-report-btn         opens the full report in a new tab
//   check-report-source / -json   collapsed JSON of the questionnaire that was checked
//   check-report-more             "Show N more" toggle of a long answer list
//   check-report-root / -summary / -calc / -seen / -missed   report page (data-status on a calc)
//   check-report-csv-btn          downloads every answer set tried as CSV
//   check-report-print-btn / -empty   print button / the page's empty state
//   check-report-formula          the calculation's FHIRPath as written
//   check-report-reads            collapsed list of the questions a calculation reads
//   check-report-trials / -trial  the table of every answer set tried, one row each
// ─────────────────────────────────────────────────────────────────────────────
import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from '@playwright/test';
import { loadFixtureFile } from './helpers/load-fixture.js';

const TEMPLATE = path.resolve('templates/phq-9.template.json');

async function load(page, file) {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/');
  await page.waitForSelector('[data-testid="add-menu-btn"]', { timeout: 10_000 });
  await loadFixtureFile(page, file);
  await expect(page.locator('[data-preview-id="phq9-severity"]')).toBeVisible({ timeout: 10_000 });
}

async function openCheck(page) {
  await expect(async () => {
    if (!(await page.getByTestId('check-form-item').isVisible())) await page.getByTestId('tools-btn').click();
    await expect(page.getByTestId('check-form-item')).toBeVisible();
  }).toPass();
  await page.getByTestId('check-form-item').click();
  await expect(page.getByTestId('checkFormModal')).toBeVisible();
}

test('a healthy form has no problems', async ({ page }) => {
  await load(page, TEMPLATE);
  await openCheck(page);
  await expect(page.getByTestId('check-form-summary')).toContainText('behave as expected', { timeout: 30_000 });
  await expect(page.getByTestId('check-form-row').first()).toHaveAttribute('data-status', 'ok');
});

test('an unreachable band is reported and the row leads to its node', async ({ page }, testInfo) => {
  const broken = testInfo.outputPath('phq9-broken.json');
  fs.writeFileSync(broken, fs.readFileSync(TEMPLATE, 'utf8').replace('< 15', '< 10'));
  await load(page, broken);
  await openCheck(page);
  await expect(page.getByTestId('check-form-summary')).toContainText('need attention', { timeout: 30_000 });
  const row = page.getByTestId('check-form-row').first();
  await expect(row).toHaveAttribute('data-status', 'unreachable');
  await expect(row).toContainText('Moderate depression');
  await row.getByTestId('check-form-nav-btn').click();
  await expect(page.getByTestId('checkFormModal')).not.toBeVisible();
});

test('the full report lists every result with sample answers and what never appeared', async ({ page, context }, testInfo) => {
  const broken = testInfo.outputPath('phq9-broken-report.json');
  fs.writeFileSync(broken, fs.readFileSync(TEMPLATE, 'utf8').replace('< 15', '< 10'));
  await load(page, broken);
  await openCheck(page);
  await expect(page.getByTestId('check-form-summary')).toContainText('need attention', { timeout: 30_000 });
  const [report] = await Promise.all([context.waitForEvent('page'), page.getByTestId('check-form-report-btn').click()]);
  await expect(report.getByTestId('check-report-summary')).toContainText('need attention');
  const source = report.getByTestId('check-report-source');
  await expect(report.getByTestId('check-report-json')).toBeHidden();
  await source.locator('summary').click();
  await expect(report.getByTestId('check-report-json')).toContainText('"resourceType": "Questionnaire"');
  const sev = report.locator('[data-testid="check-report-calc"][data-status="unreachable"]');
  await expect(sev).toHaveCount(1);
  await expect(sev.getByTestId('check-report-missed')).toContainText('Moderate depression');
  await expect(sev.getByTestId('check-report-formula')).toContainText("'Moderate depression'");
  const reads = sev.getByTestId('check-report-reads');
  await expect(reads).toContainText('Reads 9 questions');
  await expect(reads.locator('li').first()).toBeHidden();
  await reads.locator('summary').click();
  await expect(reads.locator('li')).toHaveCount(9);
  await expect(sev.getByTestId('check-report-seen')).toContainText('Mild depression');
  const table = report.getByTestId('check-report-trials');
  await expect(table.locator('th')).toHaveText(['#', 'Answers', 'PHQ-9 total score', 'Depression severity']); // a column per calculation
  await expect(table.getByTestId('check-report-trial').filter({ hasText: 'Mild depression' }).first()).toContainText('Little interest or pleasure in doing things = ');
  await expect(table.getByTestId('check-report-trial').filter({ hasText: 'Moderate depression' })).toHaveCount(0);
  await reads.locator('summary').click(); // closed again on screen
  await expect(reads.locator('li').first()).toBeHidden();
  await report.evaluate(() => window.dispatchEvent(new Event('beforeprint'))); // what the browser fires before printing
  await expect(reads.locator('li')).toHaveCount(9);
  await expect(reads.locator('li').first()).toBeVisible();
  await report.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  await expect(reads.locator('li').first()).toBeHidden();
  await report.emulateMedia({ media: 'print' }); // the printed summary leaves out the big parts
  await expect(table).toBeHidden();
  await expect(report.getByTestId('check-report-source')).toBeHidden();
  await expect(reads.locator('li').first()).toBeVisible(); // the question lists print open, even when closed on screen
  await expect(sev.getByTestId('check-report-formula')).toBeVisible();
  await expect(sev.getByTestId('check-report-missed')).toBeVisible();
  await report.emulateMedia({ media: 'screen' });
  const [download] = await Promise.all([report.waitForEvent('download'), report.getByTestId('check-report-csv-btn').click()]);
  expect(download.suggestedFilename()).toBe('form-check-answer-sets.csv');
  const csv = fs.readFileSync(await download.path(), 'utf8');
  expect(csv).toContain('"#","Answers","PHQ-9 total score","Depression severity"');
  expect(csv).toContain('Mild depression');
  expect(csv).not.toMatch(/(^|,|\n)"[=+@]/); // no cell can run as a spreadsheet formula
  const more = table.getByTestId('check-report-more').first();
  await expect(more).toHaveText(/^Show \d+ more$/);
  const last = table.getByTestId('check-report-trial').filter({ has: report.getByTestId('check-report-more') }).first().locator('li').last();
  await expect(last).toBeHidden();
  await more.click();
  await expect(last).toBeVisible();
  await expect(more).toHaveText('Show fewer');
});

test('the report page says so when it is opened without a report', async ({ page }) => {
  await page.goto('/questionnaire-check.html');
  await expect(page.getByTestId('check-report-empty')).toBeVisible();
});
