import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SAMPLE_FHIR = path.resolve(__dirname, '../../sampledata/redcap-clinical-demo.fhir.json');

test('debug download flow', async ({ page }) => {
  const consoleMessages = [];
  const pageErrors = [];
  page.on('console', msg => consoleMessages.push(`[${msg.type()}] ${msg.text()}`));
  page.on('pageerror', err => pageErrors.push(err.message));

  await page.goto('/');
  await page.waitForSelector('[data-testid="add-root-group-btn"]', { timeout: 10_000 });

  // Load FHIR file
  await page.getByTestId('load-fhir-btn').click();
  await page.getByTestId('load-from-file-item').click();
  await expect(page.getByTestId('loadFormatModal')).toBeVisible();
  await page.getByTestId('load-format-select').click();
  await page.locator('[data-testid="csel-drop"] [data-val="fhir"]').click();
  const [fileChooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByTestId('loadFormatModalApply').click(),
  ]);
  await fileChooser.setFiles(SAMPLE_FHIR);
  await expect(page.locator('[data-node-id]').first()).toBeVisible({ timeout: 10_000 });

  console.log('--- Questionnaire loaded ---');

  console.log('About to open export flow...');
  const [downloadEvt] = await Promise.all([
    page.waitForEvent('download', { timeout: 12_000 }),
    (async () => {
      await page.getByTestId('export-btn').click();
      await expect(page.getByTestId('export-quest-item')).toBeVisible();
      await page.getByTestId('export-quest-item').click();
      await expect(page.getByTestId('saveFormatModal')).toBeVisible();
      await page.getByTestId('save-format-select').click();
      await page.locator('[data-testid="csel-drop"] [data-val="redcap"]').click();
      console.log('Clicking Apply...');
      await page.getByTestId('saveFormatModalApply').click();
      console.log('Apply clicked, waiting for download...');
    })(),
  ]);
  console.log('Download filename:', downloadEvt.suggestedFilename());
  console.log('Console messages:', consoleMessages.join('\n'));
  console.log('Page errors:', pageErrors.join('\n'));
});
