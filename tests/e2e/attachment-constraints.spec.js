// ── E2E: attachment constraints — maxSize and mimeType ──────────────────────
//
// Tests that the maxSize and mimeType extensions imported from FHIR are:
//   1. Shown in the Answer Type modal (max-file-size-input / mime-types-input)
//   2. Preserved on export (maxSize → valueDecimal, mimeType → valueCode entries)
//   3. Rendered as hints in preview (file-size-hint spans, accept attribute)
//   4. Enforced during file selection (oversized file shows error tag)
//
// Fixture: tests/fixtures/attachment-constraints.fhir.json
//   att-maxsize   — attachment with maxSize = 2 MB
//   att-mimetypes — attachment with mimeType = image/jpeg + application/pdf
//   att-both      — attachment with maxSize = 5 MB + mimeType = image/*
//   att-none      — plain attachment (no constraints)
//
// Run: npx playwright test tests/e2e/attachment-constraints.spec.js
//
// ── data-testid registry ─────────────────────────────────────────────────────
//   action-type          "Answer Type" link on item node card
//   max-file-size-input  Max file size (MB) number input in Answer Type modal
//   mime-types-input     Allowed MIME types text input in Answer Type modal
//   mime-hint            Span showing accepted MIME types below file button
//   export-btn           Export dropdown trigger (toolbar)
//   export-fhir-item     "Export FHIR Questionnaire" item in export dropdown
// ─────────────────────────────────────────────────────────────────────────────

import path from 'node:path';
import { test, expect } from '@playwright/test';

const FIXTURE = path.resolve('tests/fixtures/attachment-constraints.fhir.json');

const MAX_SIZE_URL = 'http://hl7.org/fhir/StructureDefinition/maxSize';
const MIME_URL     = 'http://hl7.org/fhir/StructureDefinition/mimeType';

async function waitForLoad(page) {
  await page.waitForSelector('[data-testid="add-root-group-btn"]', { timeout: 10_000 });
}

async function loadFixture(page) {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/');
  await waitForLoad(page);
  await page.locator('#fhirFileInput').setInputFiles(FIXTURE);
  await expect(page.locator('[data-preview-id="att-maxsize"]')).toBeVisible({ timeout: 8_000 });
}

async function openAnswerTypeModal(page, nodeId) {
  await page.locator(`[data-node-id="${nodeId}"]`).getByTestId('action-type').click();
  await expect(page.locator('[data-testid="answerTypeModal"]')).toBeVisible();
}

// ── Answer Type modal — maxSize field ────────────────────────────────────────

test.describe('maxSize — Answer Type modal', () => {
  test('max-file-size-input shows imported maxSize value', async ({ page }) => {
    await loadFixture(page);
    await openAnswerTypeModal(page, 'att-maxsize');
    const inp = page.locator('[data-testid="answerTypeModal"]').getByTestId('max-file-size-input');
    await expect(inp).toBeVisible();
    await expect(inp).toHaveValue('2');
    await page.locator('[data-testid="answerTypeModal"] .modal-close').click();
  });

  test('max-file-size-input is empty for item without maxSize', async ({ page }) => {
    await loadFixture(page);
    await openAnswerTypeModal(page, 'att-none');
    const inp = page.locator('[data-testid="answerTypeModal"]').getByTestId('max-file-size-input');
    await expect(inp).toBeVisible();
    await expect(inp).toHaveValue('');
    await page.locator('[data-testid="answerTypeModal"] .modal-close').click();
  });

  test('max-file-size-input shows value for att-both (5 MB)', async ({ page }) => {
    await loadFixture(page);
    await openAnswerTypeModal(page, 'att-both');
    const inp = page.locator('[data-testid="answerTypeModal"]').getByTestId('max-file-size-input');
    await expect(inp).toHaveValue('5');
    await page.locator('[data-testid="answerTypeModal"] .modal-close').click();
  });
});

// ── Answer Type modal — mimeType field ───────────────────────────────────────

test.describe('mimeType — Answer Type modal', () => {
  test('mime-types-input shows imported MIME types as comma-separated string', async ({ page }) => {
    await loadFixture(page);
    await openAnswerTypeModal(page, 'att-mimetypes');
    const inp = page.locator('[data-testid="answerTypeModal"]').getByTestId('mime-types-input');
    await expect(inp).toBeVisible();
    await expect(inp).toHaveValue('image/jpeg, application/pdf');
    await page.locator('[data-testid="answerTypeModal"] .modal-close').click();
  });

  test('mime-types-input is empty for item without mimeType', async ({ page }) => {
    await loadFixture(page);
    await openAnswerTypeModal(page, 'att-none');
    const inp = page.locator('[data-testid="answerTypeModal"]').getByTestId('mime-types-input');
    await expect(inp).toBeVisible();
    await expect(inp).toHaveValue('');
    await page.locator('[data-testid="answerTypeModal"] .modal-close').click();
  });

  test('mime-types-input shows single mimeType for att-both', async ({ page }) => {
    await loadFixture(page);
    await openAnswerTypeModal(page, 'att-both');
    const inp = page.locator('[data-testid="answerTypeModal"]').getByTestId('mime-types-input');
    await expect(inp).toHaveValue('image/*');
    await page.locator('[data-testid="answerTypeModal"] .modal-close').click();
  });
});

// ── Preview hints ─────────────────────────────────────────────────────────────

test.describe('attachment constraints — preview hints', () => {
  test('size hint is visible for att-maxsize and contains the limit', async ({ page }) => {
    await loadFixture(page);
    const row = page.locator('[data-preview-id="att-maxsize"]');
    const hints = row.locator('.file-size-hint');
    await expect(hints.first()).toContainText('2');
  });

  test('no size hint visible for att-none', async ({ page }) => {
    await loadFixture(page);
    const row = page.locator('[data-preview-id="att-none"]');
    await expect(row.locator('.file-size-hint')).toHaveCount(0);
  });

  test('mime hint is visible for att-mimetypes', async ({ page }) => {
    await loadFixture(page);
    const row = page.locator('[data-preview-id="att-mimetypes"]');
    const hint = row.getByTestId('mime-hint');
    await expect(hint).toBeVisible();
    await expect(hint).toContainText('image/jpeg');
    await expect(hint).toContainText('application/pdf');
  });

  test('file input has accept attribute for att-mimetypes', async ({ page }) => {
    await loadFixture(page);
    const fileInput = page.locator('[data-preview-id="att-mimetypes"] input[type="file"]');
    await expect(fileInput).toHaveAttribute('accept', 'image/jpeg,application/pdf');
  });

  test('file input has accept attribute for att-both', async ({ page }) => {
    await loadFixture(page);
    const fileInput = page.locator('[data-preview-id="att-both"] input[type="file"]');
    await expect(fileInput).toHaveAttribute('accept', 'image/*');
  });

  test('file input has no accept attribute for att-none', async ({ page }) => {
    await loadFixture(page);
    const fileInput = page.locator('[data-preview-id="att-none"] input[type="file"]');
    await expect(fileInput).not.toHaveAttribute('accept');
  });
});

// ── File-size validation in preview ──────────────────────────────────────────

test.describe('maxSize — file-size validation', () => {
  test('file within limit is accepted: filename shown, no error class', async ({ page }) => {
    await loadFixture(page);
    const row = page.locator('[data-preview-id="att-maxsize"]');
    const fileInput = row.locator('input[type="file"]');
    const smallBuf = Buffer.alloc(512 * 1024, 'a'); // 0.5 MB < 2 MB limit
    await fileInput.setInputFiles({ name: 'small.pdf', mimeType: 'application/pdf', buffer: smallBuf });
    const nameTag = row.locator('.file-name-tag');
    await expect(nameTag).toContainText('small.pdf');
    await expect(nameTag).not.toHaveClass(/file-name-tag--error/);
  });

  test('file exceeding limit shows error modal and resets nameTag', async ({ page }) => {
    await loadFixture(page);
    const row = page.locator('[data-preview-id="att-maxsize"]');
    const fileInput = row.locator('input[type="file"]');
    const bigBuf = Buffer.alloc(3 * 1024 * 1024, 'a'); // 3 MB > 2 MB limit
    await fileInput.setInputFiles({ name: 'big.pdf', mimeType: 'application/pdf', buffer: bigBuf });
    // Error modal is the user-visible feedback; preview re-renders nameTag to default
    await expect(page.locator('.notif--error .modal-body')).toContainText('File too large');
    const nameTag = row.locator('.file-name-tag');
    await expect(nameTag).toContainText('No file chosen');
    await expect(nameTag).not.toHaveClass(/file-name-tag--error/);
  });

  test('att-none accepts any file size', async ({ page }) => {
    await loadFixture(page);
    const row = page.locator('[data-preview-id="att-none"]');
    const fileInput = row.locator('input[type="file"]');
    const bigBuf = Buffer.alloc(10 * 1024 * 1024, 'a'); // 10 MB — no limit
    await fileInput.setInputFiles({ name: 'huge.pdf', mimeType: 'application/pdf', buffer: bigBuf });
    const nameTag = row.locator('.file-name-tag');
    await expect(nameTag).toContainText('huge.pdf');
    await expect(nameTag).not.toHaveClass(/file-name-tag--error/);
  });
});

// ── Export round-trip ─────────────────────────────────────────────────────────

test.describe('attachment constraints — export round-trip', () => {
  test('maxSize exported as maxSize extension with valueDecimal', async ({ page }) => {
    await loadFixture(page);
    await page.getByTestId('export-btn').click();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('export-fhir-item').click().then(() => page.getByTestId('prompt-save').click()),
    ]);
    const filePath = await download.path();
    const { readFileSync } = await import('node:fs');
    const q = JSON.parse(readFileSync(filePath, 'utf8'));
    const item = q.item.find(i => i.linkId === 'att-maxsize');
    const ext = (item.extension || []).find(e => e.url === MAX_SIZE_URL);
    expect(ext?.valueDecimal).toBe(2);
  });

  test('mimeType exported as one extension entry per type', async ({ page }) => {
    await loadFixture(page);
    await page.getByTestId('export-btn').click();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('export-fhir-item').click().then(() => page.getByTestId('prompt-save').click()),
    ]);
    const filePath = await download.path();
    const { readFileSync } = await import('node:fs');
    const q = JSON.parse(readFileSync(filePath, 'utf8'));
    const item = q.item.find(i => i.linkId === 'att-mimetypes');
    const entries = (item.extension || []).filter(e => e.url === MIME_URL);
    expect(entries).toHaveLength(2);
    expect(entries.map(e => e.valueCode)).toContain('image/jpeg');
    expect(entries.map(e => e.valueCode)).toContain('application/pdf');
  });

  test('att-both exports both maxSize and mimeType', async ({ page }) => {
    await loadFixture(page);
    await page.getByTestId('export-btn').click();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('export-fhir-item').click().then(() => page.getByTestId('prompt-save').click()),
    ]);
    const filePath = await download.path();
    const { readFileSync } = await import('node:fs');
    const q = JSON.parse(readFileSync(filePath, 'utf8'));
    const item = q.item.find(i => i.linkId === 'att-both');
    const msExt = (item.extension || []).find(e => e.url === MAX_SIZE_URL);
    const mtExt = (item.extension || []).find(e => e.url === MIME_URL);
    expect(msExt?.valueDecimal).toBe(5);
    expect(mtExt?.valueCode).toBe('image/*');
  });

  test('att-none exports no maxSize or mimeType extensions', async ({ page }) => {
    await loadFixture(page);
    await page.getByTestId('export-btn').click();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('export-fhir-item').click().then(() => page.getByTestId('prompt-save').click()),
    ]);
    const filePath = await download.path();
    const { readFileSync } = await import('node:fs');
    const q = JSON.parse(readFileSync(filePath, 'utf8'));
    const item = q.item.find(i => i.linkId === 'att-none');
    const exts = item.extension || [];
    expect(exts.filter(e => e.url === MAX_SIZE_URL)).toHaveLength(0);
    expect(exts.filter(e => e.url === MIME_URL)).toHaveLength(0);
  });
});
