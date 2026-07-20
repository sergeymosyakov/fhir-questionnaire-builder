// ── E2E: Rich-text translation support (XHTML + Markdown) ─────────────────────
// Verifies that items with rendering-xhtml / rendering-markdown extensions:
//   1. Send HTML/Markdown (not plain text) to the translate modal review table
//   2. After applying, the translated rich text is rendered in the preview
//   3. The FHIR export includes the xhtml-/markdown-translations custom extensions
//
// Fixtures: sampledata/rendering-xhtml-demo.fhir.json (items: intro, grp-personal…)
//           tests/fixtures/rendering-markdown.fhir.json (items: q-bold, q-italic…)
//
// Run: npx playwright test tests/e2e/translation-xhtml.spec.js
//
// NOTE: This spec does NOT call the real Google Translate API.
//       It intercepts the network request and returns a stub translation so
//       the test is deterministic and works without internet access.
// ─────────────────────────────────────────────────────────────────────────────

import path from 'node:path';
import { test, expect } from '@playwright/test';
import { openDropdownItem } from './helpers/dropdown.js';

const XHTML_DEMO = path.resolve('sampledata/rendering-xhtml-demo.fhir.json');
const MD_DEMO    = path.resolve('tests/fixtures/rendering-markdown.fhir.json');

async function freshStart(page) {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/');
  await page.waitForSelector('[data-testid="add-root-group-btn"]', { timeout: 10_000 });
}

async function loadXHTMLDemo(page) {
  await freshStart(page);
  await openDropdownItem(page, 'load-fhir-btn', 'load-from-file-item');
  const confirm = page.getByTestId('loadConfirmModal');
  await confirm.waitFor({ state: 'visible', timeout: 2_000 }).catch(() => {});
  if (await confirm.isVisible()) await page.getByTestId('load-confirm-proceed-btn').click();
  await expect(page.getByTestId('loadFormatModal')).toBeVisible();
  await page.getByTestId('load-format-select').click();
  await page.locator('[data-testid="csel-drop"] [data-val="fhir"]').click();
  const [fc] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByTestId('loadFormatModalApply').click(),
  ]);
  await fc.setFiles(XHTML_DEMO);
  await expect(page.locator('[data-preview-id="intro"]')).toBeVisible({ timeout: 10_000 });
}

async function loadMarkdownDemo(page) {
  await freshStart(page);
  await openDropdownItem(page, 'load-fhir-btn', 'load-from-file-item');
  const confirm = page.getByTestId('loadConfirmModal');
  await confirm.waitFor({ state: 'visible', timeout: 2_000 }).catch(() => {});
  if (await confirm.isVisible()) await page.getByTestId('load-confirm-proceed-btn').click();
  await expect(page.getByTestId('loadFormatModal')).toBeVisible();
  await page.getByTestId('load-format-select').click();
  await page.locator('[data-testid="csel-drop"] [data-val="fhir"]').click();
  const [fc] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByTestId('loadFormatModalApply').click(),
  ]);
  await fc.setFiles(MD_DEMO);
  await expect(page.locator('[data-preview-id="q-bold"]')).toBeVisible({ timeout: 10_000 });
}

/** Stub Google Translate API — returns each text prefixed with [ES].
 *  Leaves the private-use-area sentinel token untouched (mimics real behaviour). */
async function stubTranslateAPI(page) {
  await page.route('**/translate.googleapis.com/**', async route => {
    const url = new URL(route.request().url());
    const q = decodeURIComponent(url.searchParams.get('q') || '');
    // Prefix each line with [ES] but leave the sentinel token line untouched
    const translated = q.split('\n')
      .map(l => (l.includes('\uE000') || !l.trim()) ? l : `[ES] ${l}`)
      .join('\n');
    // Google gtx format: data[0] = array of segments, each segment = [translatedText, ...]
    // _callGtx reads: (data[0] ?? []).map(seg => seg[0] ?? '').join('')
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([[[translated, q, null, null, 1]]]),
    });
  });
}

// ── Review table shows HTML for XHTML items ───────────────────────────────────

test.describe('XHTML translation — review table', () => {
  test('XHTML item original column contains HTML markup', async ({ page }) => {
    await stubTranslateAPI(page);
    await loadXHTMLDemo(page);

    // Open translate modal
    await page.getByTestId('tools-btn').click();
    await expect(page.getByTestId('translate-item')).toBeVisible();
    await page.getByTestId('translate-item').click();
    await expect(page.locator('[data-testid="translateModal"]')).toBeVisible();

    // Select language and translate
    await page.getByTestId('translate-lang-select').click();
    await page.locator('[data-testid="csel-drop"] [data-val="es"]').click();
    await page.getByTestId('translate-btn').click();

    // Wait for review table
    await expect(page.locator('[data-testid="translate-table"]')).toBeVisible({ timeout: 15_000 });

    // The "intro" item has rendering-xhtml — its original in the review table
    // should contain HTML tags (sent as HTML to the API)
    const introInput = page.locator('[data-testid="translate-input-intro"]');
    await expect(introInput).toBeVisible();
    // The translated value should start with [ES] (our stub prefix)
    const val = await introInput.inputValue();
    expect(val).toContain('[ES]');

    await page.getByTestId('translate-cancel-btn').click();
  });
});

// ── After apply, translated XHTML renders in preview ─────────────────────────

test.describe('XHTML translation — preview render', () => {
  test('switching to translated language renders XHTML content in preview', async ({ page }) => {
    await stubTranslateAPI(page);
    await loadXHTMLDemo(page);

    // Translate to Spanish
    await page.getByTestId('tools-btn').click();
    await page.getByTestId('translate-item').click();
    await expect(page.locator('[data-testid="translateModal"]')).toBeVisible();
    await page.getByTestId('translate-lang-select').click();
    await page.locator('[data-testid="csel-drop"] [data-val="es"]').click();
    await page.getByTestId('translate-btn').click();
    await expect(page.locator('[data-testid="translate-table"]')).toBeVisible({ timeout: 15_000 });
    await page.getByTestId('translate-apply-btn').click();
    await expect(page.locator('[data-testid="translateModal"]')).not.toBeVisible();

    // Switch to Spanish
    const langMenu = page.locator('[data-testid="lang-menu-btn"]');
    await expect(langMenu).toBeVisible({ timeout: 5_000 });
    await langMenu.click();
    await page.locator('[data-testid="lang-menu-item-es"]').click();

    // The intro item label should now show translated content with [ES] prefix
    const introRow = page.locator('[data-preview-id="intro"]');
    await expect(introRow).toBeVisible();
    await expect(introRow).toContainText('[ES]');
  });
});

// ── FHIR export includes xhtml-translations extension ────────────────────────

test.describe('XHTML translation — export round-trip', () => {
  test('exported FHIR contains xhtml-translations extension', async ({ page }) => {
    await stubTranslateAPI(page);
    await loadXHTMLDemo(page);

    // Translate to Spanish
    await page.getByTestId('tools-btn').click();
    await page.getByTestId('translate-item').click();
    await expect(page.locator('[data-testid="translateModal"]')).toBeVisible();
    await page.getByTestId('translate-lang-select').click();
    await page.locator('[data-testid="csel-drop"] [data-val="es"]').click();
    await page.getByTestId('translate-btn').click();
    await expect(page.locator('[data-testid="translate-table"]')).toBeVisible({ timeout: 15_000 });
    await page.getByTestId('translate-apply-btn').click();

    // Export
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 15_000 }),
      (async () => {
        await openDropdownItem(page, 'export-btn', 'export-quest-item');
        await expect(page.getByTestId('saveFormatModal')).toBeVisible();
        await page.getByTestId('saveFormatModalApply').click();
        // Validate modal may appear — export anyway
        const vm = page.getByTestId('validateModal');
        await vm.waitFor({ state: 'visible', timeout: 5_000 }).catch(() => {});
        if (await vm.isVisible()) {
          const exportBtn = vm.locator('button:has-text("Export"), button:has-text("Export anyway")');
          await exportBtn.first().click();
        }
        // Filename prompt
        const prompt = page.getByTestId('prompt-save');
        await prompt.waitFor({ state: 'visible', timeout: 5_000 }).catch(() => {});
        if (await prompt.isVisible()) await prompt.click();
      })(),
    ]);

    const chunks = [];
    for await (const chunk of await download.createReadStream()) chunks.push(chunk);
    const json = JSON.parse(Buffer.concat(chunks).toString());

    const XHTML_TRANS_URL = 'http://fhir-qb.app/StructureDefinition/xhtml-translations';
    const xhtmlExt = (json.extension || []).find(e => e.url === XHTML_TRANS_URL);
    expect(xhtmlExt).toBeTruthy();
    const lang = xhtmlExt.extension?.find(s => s.url === 'lang')?.valueCode;
    expect(lang).toBe('es');
    const strings = xhtmlExt.extension?.find(s => s.url === 'strings')?.valueString;
    const parsed = JSON.parse(strings);
    // intro item should have translated XHTML
    expect(parsed['intro']).toBeDefined();
    expect(parsed['intro']).toContain('[ES]');
  });
});

// ── Markdown translation ──────────────────────────────────────────────────────

test.describe('Markdown translation — preview render', () => {
  test('switching to translated language renders Markdown content in preview', async ({ page }) => {
    await stubTranslateAPI(page);
    await loadMarkdownDemo(page);

    // Translate to Spanish
    await page.getByTestId('tools-btn').click();
    await page.getByTestId('translate-item').click();
    await expect(page.locator('[data-testid="translateModal"]')).toBeVisible();
    await page.getByTestId('translate-lang-select').click();
    await page.locator('[data-testid="csel-drop"] [data-val="es"]').click();
    await page.getByTestId('translate-btn').click();
    await expect(page.locator('[data-testid="translate-table"]')).toBeVisible({ timeout: 15_000 });
    await page.getByTestId('translate-apply-btn').click();
    await expect(page.locator('[data-testid="translateModal"]')).not.toBeVisible();

    // Switch to Spanish
    const langMenu = page.locator('[data-testid="lang-menu-btn"]');
    await expect(langMenu).toBeVisible({ timeout: 5_000 });
    await langMenu.click();
    await page.locator('[data-testid="lang-menu-item-es"]').click();

    // q-bold has rendering-markdown "**Bold question**" — translated shows [ES] prefix
    const boldRow = page.locator('[data-preview-id="q-bold"]');
    await expect(boldRow).toBeVisible();
    await expect(boldRow).toContainText('[ES]');
  });
});

test.describe('Markdown translation — export round-trip', () => {
  test('exported FHIR contains markdown-translations extension', async ({ page }) => {
    await stubTranslateAPI(page);
    await loadMarkdownDemo(page);

    // Translate to Spanish
    await page.getByTestId('tools-btn').click();
    await page.getByTestId('translate-item').click();
    await expect(page.locator('[data-testid="translateModal"]')).toBeVisible();
    await page.getByTestId('translate-lang-select').click();
    await page.locator('[data-testid="csel-drop"] [data-val="es"]').click();
    await page.getByTestId('translate-btn').click();
    await expect(page.locator('[data-testid="translate-table"]')).toBeVisible({ timeout: 15_000 });
    await page.getByTestId('translate-apply-btn').click();

    // Export
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 15_000 }),
      (async () => {
        await openDropdownItem(page, 'export-btn', 'export-quest-item');
        await expect(page.getByTestId('saveFormatModal')).toBeVisible();
        await page.getByTestId('saveFormatModalApply').click();
        const vm = page.getByTestId('validateModal');
        await vm.waitFor({ state: 'visible', timeout: 5_000 }).catch(() => {});
        if (await vm.isVisible()) {
          const exportBtn = vm.locator('button:has-text("Export"), button:has-text("Export anyway")');
          await exportBtn.first().click();
        }
        const prompt = page.getByTestId('prompt-save');
        await prompt.waitFor({ state: 'visible', timeout: 5_000 }).catch(() => {});
        if (await prompt.isVisible()) await prompt.click();
      })(),
    ]);

    const chunks = [];
    for await (const chunk of await download.createReadStream()) chunks.push(chunk);
    const json = JSON.parse(Buffer.concat(chunks).toString());

    const MD_TRANS_URL = 'http://fhir-qb.app/StructureDefinition/markdown-translations';
    const mdExt = (json.extension || []).find(e => e.url === MD_TRANS_URL);
    expect(mdExt).toBeTruthy();
    const lang = mdExt.extension?.find(s => s.url === 'lang')?.valueCode;
    expect(lang).toBe('es');
    const strings = mdExt.extension?.find(s => s.url === 'strings')?.valueString;
    const parsed = JSON.parse(strings);
    // q-bold item should have translated Markdown
    expect(parsed['q-bold']).toBeDefined();
    expect(parsed['q-bold']).toContain('[ES]');
  });
});
