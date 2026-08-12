// ── E2E: Translation providers (gtx / DeepL / LibreTranslate / OpenAI) ────────
// Proves each provider is wired end-to-end: the correct request shape leaves the
// browser and the mocked translation lands in the review table. The provider is
// pre-configured via localStorage (fhirqb.server.*) before the app loads.
//
// The network is intercepted with page.route() — no real API is called, so the
// test is deterministic and works offline (see reasoning in docs). We translate
// PHQ-9 into French (it only ships Spanish translations, so this forces an API
// call rather than the "Edit existing" path).
//
// Run: npx playwright test tests/e2e/translation-providers.spec.js
//
// ── data-testid registry ──────────────────────────────────────────────────────
//   tools-btn             Settings ▾ dropdown trigger
//   translate-item        "🌐 Translate questionnaire…" menu item
//   translateModal        modal backdrop
//   translate-lang-select language custom-select trigger
//   translate-btn         "Translate" button
//   translate-table       review table
//   translate-input-*      per-item translated <textarea>
// ─────────────────────────────────────────────────────────────────────────────

import path from 'node:path';
import { test, expect } from '@playwright/test';

const PHQ9 = path.resolve('sampledata/phq-9.fhir.json');

// Pre-seed provider config into localStorage, then load the app.
async function startWithConfig(page, cfg) {
  await page.addInitScript((c) => {
    localStorage.clear();
    for (const [k, v] of Object.entries(c)) {
      if (v != null) localStorage.setItem('fhirqb.server.' + k, v);
    }
  }, cfg);
  await page.goto('/');
  await page.waitForSelector('[data-testid="add-root-group-btn"]', { timeout: 10_000 });
}

async function loadPHQ9(page) {
  await page.locator('[data-testid="fhir-file-input"]').setInputFiles(PHQ9);
  await expect(page.locator('[data-preview-id="/44250-9"]')).toBeVisible({ timeout: 10_000 });
}

// Open the Translate modal, pick French and run the translation.
async function runTranslate(page) {
  await page.getByTestId('tools-btn').click();
  await expect(page.getByTestId('translate-item')).toBeVisible();
  await page.getByTestId('translate-item').click();
  await expect(page.locator('[data-testid="translateModal"]')).toBeVisible({ timeout: 5_000 });
  await page.getByTestId('translate-lang-select').click();
  await page.locator('[data-testid="csel-drop"] [data-val="fr"]').click();
  await page.getByTestId('translate-btn').click();
  await expect(page.locator('[data-testid="translate-table"]')).toBeVisible({ timeout: 15_000 });
}

// First translated cell in the review table.
function firstTranslated(page) {
  return page.locator('[data-testid^="translate-input-"]').first();
}

// ── gtx (Google Translate, free, no key) ──────────────────────────────────────
test('gtx: GET request with gtx query params, translation lands in review table', async ({ page }) => {
  let captured = null;
  await page.route('**translate.googleapis.com**', async (route) => {
    const url = route.request().url();
    captured = { method: route.request().method(), url };
    const q = decodeURIComponent(new URL(url).searchParams.get('q') || '');
    // Prefix each real line; leave the private-use sentinel token lines untouched.
    const translated = q.split('\n')
      .map(l => (l.includes('\uE000') || !l.trim()) ? l : `[FR] ${l}`)
      .join('\n');
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify([[[translated, q, null, null, 1]]]),
    });
  });

  await startWithConfig(page, { translateProvider: 'gtx' });
  await loadPHQ9(page);
  await runTranslate(page);

  await expect(firstTranslated(page)).toHaveValue(/\[FR\]/);
  expect(captured.method).toBe('GET');
  expect(captured.url).toContain('client=gtx');
  expect(captured.url).toContain('tl=fr');
});

// ── DeepL (form POST via CORS proxy, auth key) ────────────────────────────────
test('deepl: POST via CORS proxy with DeepL auth key, translation lands', async ({ page }) => {
  let captured = null;
  await page.route('**proxy.example.com**', async (route) => {
    const body = route.request().postData() || '';
    const texts = new URLSearchParams(body).getAll('text');
    captured = { method: route.request().method(), headers: route.request().headers(), body };
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ translations: texts.map(t => ({ text: `[DEEPL] ${t}` })) }),
    });
  });

  await startWithConfig(page, {
    translateProvider: 'deepl',
    translateApiKey: 'secret',
    corsProxyUrl: 'https://proxy.example.com',
  });
  await loadPHQ9(page);
  await runTranslate(page);

  await expect(firstTranslated(page)).toHaveValue(/\[DEEPL\]/);
  expect(captured.method).toBe('POST');
  expect(captured.headers.authorization).toBe('DeepL-Auth-Key secret');
  expect(captured.body).toContain('target_lang=FR');
});

// ── LibreTranslate (JSON POST to configured endpoint) ─────────────────────────
test('libre: JSON POST to configured endpoint, translation lands', async ({ page }) => {
  let captured = null;
  await page.route('**libre.example.com**', async (route) => {
    const body = JSON.parse(route.request().postData() || '{}');
    captured = { method: route.request().method(), body };
    const q = Array.isArray(body.q) ? body.q : [body.q];
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ translatedText: q.map(t => `[LIBRE] ${t}`) }),
    });
  });

  await startWithConfig(page, {
    translateProvider: 'libre',
    translateApiUrl: 'https://libre.example.com/translate',
  });
  await loadPHQ9(page);
  await runTranslate(page);

  await expect(firstTranslated(page)).toHaveValue(/\[LIBRE\]/);
  expect(captured.method).toBe('POST');
  expect(captured.body.target).toBe('fr');
  expect(Array.isArray(captured.body.q)).toBe(true);
});

// ── OpenAI (chat completions, JSON translations object) ───────────────────────
test('openai: Bearer-auth chat completion, translation lands', async ({ page }) => {
  let captured = null;
  await page.route('**api.openai.com**', async (route) => {
    const req = JSON.parse(route.request().postData() || '{}');
    const userMsg = req.messages?.find(m => m.role === 'user')?.content || '[]';
    const arr = JSON.parse(userMsg);
    captured = { headers: route.request().headers(), model: req.model };
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({
        choices: [{ message: { content: JSON.stringify({ translations: arr.map(t => `[OPENAI] ${t}`) }) } }],
      }),
    });
  });

  await startWithConfig(page, {
    translateProvider: 'openai',
    translateApiKey: 'sk-test',
  });
  await loadPHQ9(page);
  await runTranslate(page);

  await expect(firstTranslated(page)).toHaveValue(/\[OPENAI\]/);
  expect(captured.headers.authorization).toBe('Bearer sk-test');
  expect(captured.model).toBe('gpt-4o-mini');
});
