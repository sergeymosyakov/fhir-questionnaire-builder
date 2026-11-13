// ── E2E: template deep link `/?template=<id>` ────────────────────────────────
// Opening the Builder with ?template=<id> inserts that library template; the parameter is dropped
// from the address; unknown or malformed ids and a failing library show an error instead.
//
// data-testid registry:
//   add-menu-btn                 builder ready marker
//   tpd-open-in-builder          "Open in Builder" button on a template page
//   tp-open-<id>                 "Open in Builder" link on a card of templates.html
//   notif-box-error / notif-body-error   error dialog
//   node-title-display           builder node title
// Preview rows ([data-preview-id]) are the sanctioned non-testid exception.
// ─────────────────────────────────────────────────────────────────────────────

import { test, expect } from '@playwright/test';
import { waitForLoad } from './helpers/builder.js';
import { serveTemplates } from './helpers/templates.js';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
});

const phq9 = (page) => page.locator('[data-preview-id="phq9-q1"]');

test('?template=<id> inserts the template as the first group and drops the parameter', async ({ page }) => {
  await page.goto('/?template=phq-9');
  await waitForLoad(page);
  await expect(phq9(page)).toBeVisible();
  await expect(page.getByTestId('node-title-display').first()).toHaveText('PHQ-9 Depression Screening');
  await expect(page).toHaveURL(/^[^?]*$/);
});

test('reloading after the parameter was dropped does not insert the template again', async ({ page }) => {
  await page.goto('/?template=gad-7');
  await waitForLoad(page);
  await expect(page.locator('[data-preview-id="gad7-q1"]')).toBeVisible();
  await page.reload();
  await waitForLoad(page);
  await expect(page.locator('[data-preview-id="gad7-q1"]')).toHaveCount(0);
});

test('other parameters and the hash stay in the address', async ({ page }) => {
  await page.goto('/?foo=1&template=phq-2#keep');
  await waitForLoad(page);
  await expect(page.locator('[data-preview-id="phq2-q1"]')).toBeVisible();
  const url = new URL(page.url());
  expect(url.searchParams.get('foo')).toBe('1');
  expect(url.searchParams.has('template')).toBe(false);
  expect(url.hash).toBe('#keep');
});

test('an unknown template id shows an error and inserts nothing', async ({ page }) => {
  await page.goto('/?template=no-such-template');
  await waitForLoad(page);
  await expect(page.getByTestId('notif-box-error')).toBeVisible();
  await expect(page.getByTestId('notif-body-error')).toContainText('"no-such-template" was not found');
  await expect(page.getByTestId('node-title-display')).toHaveCount(0);
});

test('a malformed id is rejected and no template file is requested', async ({ page }) => {
  const templateRequests = [];
  page.on('request', (r) => { if (r.resourceType() !== 'document' && new URL(r.url()).pathname.startsWith('/templates/')) templateRequests.push(new URL(r.url()).pathname); });
  await page.goto('/?template=' + encodeURIComponent('../etc/passwd'));
  await waitForLoad(page);
  await expect(page.getByTestId('notif-body-error')).toContainText('not a valid template link');
  await expect(page.getByTestId('node-title-display')).toHaveCount(0);
  expect(templateRequests.filter((p) => p !== '/templates/library.json')).toEqual([]);
});

test('a failing template library shows an error', async ({ page }) => {
  await serveTemplates(page, { failLibrary: true });
  await page.goto('/?template=phq-9');
  await waitForLoad(page);
  await expect(page.getByTestId('notif-body-error')).toContainText('Could not load templates');
});

test('"Open in Builder" on a template page opens the Builder with that template', async ({ page }) => {
  await page.goto('/templates/kidney-function.html');
  await page.getByTestId('tpd-open-in-builder').click();
  await waitForLoad(page);
  await expect(page.locator('[data-preview-id="kidney-creatinine"]')).toBeVisible();
  await expect(page.getByTestId('node-title-display').first()).toHaveText('Kidney Function');
});

test('"Open in Builder" on a card of the template catalog opens the Builder with that template', async ({ page }) => {
  await page.goto('/templates.html');
  await page.getByTestId('tp-open-glasgow-coma-scale').click();
  await waitForLoad(page);
  await expect(page.locator('[data-preview-id="gcs-eye"]')).toBeVisible();
});

test('the inserted template works: PHQ-2 totals the answers', async ({ page }) => {
  await page.goto('/?template=phq-2');
  await waitForLoad(page);
  await page.locator('[data-preview-id="phq2-q1"] .radio-label').nth(2).click();
  await page.locator('[data-preview-id="phq2-q2"] .radio-label').nth(1).click();
  await expect(page.locator('[data-preview-id="phq2-total"]')).toContainText('3');
  await expect(page.locator('[data-preview-id="phq2-result"]')).toContainText('Positive screen');
});
