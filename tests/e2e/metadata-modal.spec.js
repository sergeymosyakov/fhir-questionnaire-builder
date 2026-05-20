// ── E2E: Questionnaire metadata card + Properties modal ───────────────────────
// Tests for the questMetaCard panel and the metadata editing modal.
//
// Run: npx playwright test tests/e2e/metadata-modal.spec.js
//
// ── data-testid registry ─────────────────────────────────────────────────────
//   quest-meta-card      compact card above Variables (left panel)
//   quest-meta-status    status badge inside the card
//   properties-btn       "Edit" button that opens the modal
//   metadataModal        (id) modal backdrop
//   metadataModalApply   (id) Apply button
//   metadataModalCancel  (id) Cancel button
//   metadataModalClose   (id) × close button
//   metadataModalBody    (id) modal body container
//   meta-id              (data-testid) id input inside modal body
//   meta-url             (data-testid) url input
//   meta-version         (data-testid) version input
//   meta-name            (data-testid) name input
//   meta-title           (data-testid) title input
//   meta-status          (data-testid) status select
//   meta-publisher       (data-testid) publisher input
//   meta-description     (data-testid) description textarea
//   meta-advanced-toggle (data-testid) Advanced section toggle button
//   meta-date            (data-testid) date input (Advanced)
//   meta-subject-type    (data-testid) subjectType input (Advanced)
//   meta-approval-date   (data-testid) approvalDate input (Advanced)
//   meta-last-review     (data-testid) lastReviewDate input (Advanced)
//   meta-purpose         (data-testid) purpose textarea (Advanced)
//   meta-copyright       (data-testid) copyright textarea (Advanced)
// ─────────────────────────────────────────────────────────────────────────────

import path from 'node:path';
import { test, expect } from '@playwright/test';

const FIXTURE = path.resolve('tests/fixtures/meta-test.fhir.json');

// ── Helpers ───────────────────────────────────────────────────────────────────

async function waitForLoad(page) {
  await page.waitForSelector('[data-testid="add-root-group-btn"]', { timeout: 10_000 });
}

async function freshStart(page) {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/');
  await waitForLoad(page);
}

async function loadFixture(page) {
  await freshStart(page);
  await page.locator('#fhirFileInput').setInputFiles(FIXTURE);
  // Card appears when tree has nodes
  await expect(page.getByTestId('quest-meta-card')).toBeVisible({ timeout: 8_000 });
}

async function openModal(page) {
  await page.getByTestId('properties-btn').click();
  await expect(page.locator('#metadataModal')).toBeVisible();
}

// ── Card visibility ───────────────────────────────────────────────────────────

test.describe('metadata card — visibility', () => {
  test('card is hidden on fresh load (no questionnaire)', async ({ page }) => {
    await freshStart(page);
    await expect(page.getByTestId('quest-meta-card')).not.toBeVisible();
  });

  test('card appears after adding a root group', async ({ page }) => {
    await freshStart(page);
    await page.getByTestId('add-root-group-btn').click();
    await expect(page.getByTestId('quest-meta-card')).toBeVisible();
  });

  test('card appears after loading a questionnaire from file', async ({ page }) => {
    await loadFixture(page);
    await expect(page.getByTestId('quest-meta-card')).toBeVisible();
  });
});

// ── Status badge ──────────────────────────────────────────────────────────────

test.describe('metadata card — status badge', () => {
  test('shows "active" after loading a questionnaire with status active', async ({ page }) => {
    await loadFixture(page);
    await expect(page.getByTestId('quest-meta-status')).toHaveText('active');
  });

  test('shows "draft" after adding a new group (default status)', async ({ page }) => {
    await freshStart(page);
    await page.getByTestId('add-root-group-btn').click();
    await expect(page.getByTestId('quest-meta-status')).toHaveText('draft');
  });
});

// ── Modal open / close ────────────────────────────────────────────────────────

test.describe('metadata modal — open/close', () => {
  test('Edit button opens the modal', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await expect(page.locator('#metadataModal')).toBeVisible();
  });

  test('× button closes the modal', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await page.locator('#metadataModalClose').click();
    await expect(page.locator('#metadataModal')).not.toBeVisible();
  });

  test('Cancel button closes the modal', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await page.locator('#metadataModalCancel').click();
    await expect(page.locator('#metadataModal')).not.toBeVisible();
  });
});

// ── Modal fields pre-populated from loaded questionnaire ──────────────────────

test.describe('metadata modal — fields populated on open', () => {
  test('id field shows the questionnaire id', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await expect(page.getByTestId('meta-id')).toHaveValue('meta-test-id');
  });

  test('url field shows the questionnaire url', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await expect(page.getByTestId('meta-url')).toHaveValue('http://example.org/fhir/Questionnaire/meta-test');
  });

  test('version field shows the questionnaire version', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await expect(page.getByTestId('meta-version')).toHaveValue('2.0');
  });

  test('title field shows the questionnaire title', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await expect(page.getByTestId('meta-title')).toHaveValue('Meta Test Questionnaire');
  });

  test('status select shows the questionnaire status', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await expect(page.getByTestId('meta-status')).toHaveValue('active');
  });

  test('publisher field shows the questionnaire publisher', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await expect(page.getByTestId('meta-publisher')).toHaveValue('Test Publisher');
  });

  test('name field shows the questionnaire name', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await expect(page.getByTestId('meta-name')).toHaveValue('MetaTestQuestionnaire');
  });
});

// ── Apply commits changes ─────────────────────────────────────────────────────

test.describe('metadata modal — apply', () => {
  test('changing status and applying updates the card badge', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await page.getByTestId('meta-status').selectOption('retired');
    await page.locator('#metadataModalApply').click();
    await expect(page.locator('#metadataModal')).not.toBeVisible();
    await expect(page.getByTestId('quest-meta-status')).toHaveText('retired');
  });

  test('Cancel does not commit status change', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await page.getByTestId('meta-status').selectOption('retired');
    await page.locator('#metadataModalCancel').click();
    await expect(page.getByTestId('quest-meta-status')).toHaveText('active');
  });

  test('changed title is written back to export JSON', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await page.getByTestId('meta-title').fill('Updated Title');
    await page.locator('#metadataModalApply').click();

    // Accept the filename prompt, then capture the download
    page.once('dialog', d => d.accept());
    await page.getByTestId('export-btn').click();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('export-fhir-item').click(),
    ]);
    const filePath = await download.path();
    const { readFileSync } = await import('node:fs');
    const q = JSON.parse(readFileSync(filePath, 'utf8'));
    expect(q.title).toBe('Updated Title');
  });
});

// ── Advanced section ──────────────────────────────────────────────────────────

test.describe('metadata modal — Advanced section', () => {
  test('Advanced section is collapsed by default', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await expect(page.getByTestId('meta-date')).not.toBeVisible();
  });

  test('clicking Advanced toggle expands the section', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await page.getByTestId('meta-advanced-toggle').click();
    await expect(page.getByTestId('meta-date')).toBeVisible();
  });

  test('date field shows questionnaire date after expanding', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await page.getByTestId('meta-advanced-toggle').click();
    await expect(page.getByTestId('meta-date')).toHaveValue('2024-03-15');
  });

  test('subjectType field shows comma-separated types after expanding', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await page.getByTestId('meta-advanced-toggle').click();
    await expect(page.getByTestId('meta-subject-type')).toHaveValue('Patient, Practitioner');
  });

  test('purpose field shows questionnaire purpose after expanding', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await page.getByTestId('meta-advanced-toggle').click();
    await expect(page.getByTestId('meta-purpose')).toHaveValue('Used for E2E testing.');
  });

  test('Advanced fields round-trip through export', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await page.getByTestId('meta-advanced-toggle').click();
    await page.getByTestId('meta-subject-type').fill('Patient, RelatedPerson');
    await page.locator('#metadataModalApply').click();

    page.once('dialog', d => d.accept());
    await page.getByTestId('export-btn').click();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('export-fhir-item').click(),
    ]);
    const filePath = await download.path();
    const { readFileSync } = await import('node:fs');
    const q = JSON.parse(readFileSync(filePath, 'utf8'));
    expect(q.subjectType).toEqual(['Patient', 'RelatedPerson']);
  });

  test('date is preserved in export round-trip', async ({ page }) => {
    await loadFixture(page);
    page.once('dialog', d => d.accept());
    await page.getByTestId('export-btn').click();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('export-fhir-item').click(),
    ]);
    const filePath = await download.path();
    const { readFileSync } = await import('node:fs');
    const q = JSON.parse(readFileSync(filePath, 'utf8'));
    expect(q.date).toBe('2024-03-15');
  });

  test('contact[] is preserved in export pass-through', async ({ page }) => {
    await loadFixture(page);
    page.once('dialog', d => d.accept());
    await page.getByTestId('export-btn').click();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('export-fhir-item').click(),
    ]);
    const filePath = await download.path();
    const { readFileSync } = await import('node:fs');
    const q = JSON.parse(readFileSync(filePath, 'utf8'));
    expect(q.contact).toEqual([{ name: 'Test Contact' }]);
  });
});

// ── Reset on form clear ───────────────────────────────────────────────────────

test.describe('metadata card — reset on clear', () => {
  test('questMeta is cleared after using the × clear button', async ({ page }) => {
    await loadFixture(page);
    // Verify fixture metadata is loaded
    await expect(page.getByTestId('quest-meta-status')).toHaveText('active');

    // Clear the form
    await page.getByTestId('clear-form-btn').click();
    await page.waitForSelector('.clear-confirm-backdrop');
    await page.getByTestId('clear-confirm-clear-btn').click();

    // Add a group so the card becomes visible again
    await page.getByTestId('add-root-group-btn').click();
    await expect(page.getByTestId('quest-meta-card')).toBeVisible();

    // Status must be back to 'draft' (default)
    await expect(page.getByTestId('quest-meta-status')).toHaveText('draft');

    // Open modal — id field must be empty
    await openModal(page);
    await expect(page.getByTestId('meta-id')).toHaveValue('');
    await expect(page.getByTestId('meta-url')).toHaveValue('');
    await expect(page.getByTestId('meta-title')).toHaveValue('');
    await page.locator('#metadataModalCancel').click();
  });
});
