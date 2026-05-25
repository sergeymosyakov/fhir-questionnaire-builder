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
//   meta-effective-start (data-testid) effectivePeriod.start input (Advanced)
//   meta-effective-end   (data-testid) effectivePeriod.end input (Advanced)
//   meta-approval-date   (data-testid) approvalDate input (Advanced)
//   meta-last-review     (data-testid) lastReviewDate input (Advanced)
//   meta-purpose         (data-testid) purpose textarea (Advanced)
//   meta-copyright       (data-testid) copyright textarea (Advanced)
//   meta-codes-toggle           (data-testid) Codes section toggle button
//   meta-code-code-0             (data-testid) code input for first Questionnaire.code[] row
//   meta-code-system-0           (data-testid) system input for first row
//   meta-code-display-0          (data-testid) display input for first row
//   meta-code-remove-0           (data-testid) remove button for first row
//   meta-codes-add-btn           (data-testid) Add code button inside Codes section
//   meta-resource-meta-toggle    (data-testid) Resource Meta section toggle button
//   meta-version-id              (data-testid) meta.versionId text input
//   meta-version-id-generate     (data-testid) Generate UUID button
//   meta-source                  (data-testid) meta.source URI input
//   meta-profile-url-{idx}       (data-testid) profile URL input at index idx
//   meta-profile-remove-{idx}    (data-testid) profile remove button at index idx
//   meta-profile-add-btn         (data-testid) Add Profile URL button
//   meta-tag-system-{idx}        (data-testid) tag Coding system input at index idx
//   meta-tag-code-{idx}          (data-testid) tag Coding code input at index idx
//   meta-tag-display-{idx}       (data-testid) tag Coding display input at index idx
//   meta-tag-remove-{idx}        (data-testid) tag Coding remove button at index idx
//   meta-tags-add-btn            (data-testid) Add tag button
//   meta-security-system-{idx}   (data-testid) security Coding system input at index idx
//   meta-security-code-{idx}     (data-testid) security Coding code input at index idx
//   meta-security-display-{idx}  (data-testid) security Coding display input at index idx
//   meta-security-remove-{idx}   (data-testid) security Coding remove button at index idx
//   meta-securitys-add-btn       (data-testid) Add security label button
//   meta-identifiers-toggle      (data-testid) Identifiers section toggle button
//   meta-identifier-use-{idx}    (data-testid) use select for identifier at index idx
//   meta-identifier-system-{idx} (data-testid) system input for identifier at index idx
//   meta-identifier-value-{idx}  (data-testid) value input for identifier at index idx
//   meta-identifier-remove-{idx} (data-testid) remove button for identifier at index idx
//   meta-identifier-add-btn      (data-testid) Add Identifier button
//   meta-last-updated            (data-testid) read-only lastUpdated span
//   meta-narrative-status        (data-testid) read-only Narrative status span
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
    await expect(page.getByTestId('meta-status')).toHaveAttribute('data-value', 'active');
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
    await page.getByTestId('meta-status').click();
    await page.locator('.oc-opt[data-val="retired"]').click();
    await page.locator('#metadataModalApply').click();
    await expect(page.locator('#metadataModal')).not.toBeVisible();
    await expect(page.getByTestId('quest-meta-status')).toHaveText('retired');
  });

  test('Cancel does not commit status change', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await page.getByTestId('meta-status').click();
    await page.locator('.oc-opt[data-val="retired"]').click();
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

// ── effectivePeriod fields ─────────────────────────────────────────────────────
test.describe('metadata modal — effectivePeriod', () => {
  test('effectivePeriod start and end shown in Advanced section', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await page.getByTestId('meta-advanced-toggle').click();
    await expect(page.getByTestId('meta-effective-start')).toHaveValue('2024-01-01');
    await expect(page.getByTestId('meta-effective-end')).toHaveValue('2025-12-31');
    await page.locator('#metadataModalCancel').click();
  });

  test('effectivePeriod round-trips through export', async ({ page }) => {
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
    expect(q.effectivePeriod).toEqual({ start: '2024-01-01', end: '2025-12-31' });
  });

  test('effectivePeriod can be edited and applied', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await page.getByTestId('meta-advanced-toggle').click();
    await page.getByTestId('meta-effective-start').fill('2025-03-01');
    await page.locator('#metadataModalApply').click();
    // Reopen and verify saved value
    await openModal(page);
    await page.getByTestId('meta-advanced-toggle').click();
    await expect(page.getByTestId('meta-effective-start')).toHaveValue('2025-03-01');
    await page.locator('#metadataModalCancel').click();
  });

  test('effectivePeriod cleared when form is cleared', async ({ page }) => {
    await loadFixture(page);
    // Clear the form
    await page.getByTestId('clear-form-btn').click();
    await page.waitForSelector('.clear-confirm-backdrop');
    await page.getByTestId('clear-confirm-clear-btn').click();
    // Add a node so card is visible
    await page.getByTestId('add-root-group-btn').click();
    await expect(page.getByTestId('quest-meta-card')).toBeVisible();
    // Open modal — effectivePeriod fields must be empty
    await openModal(page);
    await page.getByTestId('meta-advanced-toggle').click();
    await expect(page.getByTestId('meta-effective-start')).toHaveValue('');
    await expect(page.getByTestId('meta-effective-end')).toHaveValue('');
    await page.locator('#metadataModalCancel').click();
  });
});

// ── Questionnaire.code[] section ──────────────────────────────────────────────
test.describe('metadata modal — Questionnaire codes', () => {
  test('Codes toggle visible, collapsed by default', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await expect(page.getByTestId('meta-codes-toggle')).toBeVisible();
    await expect(page.getByTestId('meta-code-code-0')).not.toBeVisible();
    await page.locator('#metadataModalCancel').click();
  });

  test('Codes toggle shows count badge when codes are present', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await expect(page.getByTestId('meta-codes-toggle')).toContainText('(1)');
    await page.locator('#metadataModalCancel').click();
  });

  test('expanding Codes section shows imported code row', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await page.getByTestId('meta-codes-toggle').click();
    await expect(page.getByTestId('meta-code-code-0')).toHaveValue('44249-1');
    await expect(page.getByTestId('meta-code-system-0')).toHaveValue('http://loinc.org');
    await expect(page.getByTestId('meta-code-display-0')).toHaveValue('PHQ-9 total score');
    await page.locator('#metadataModalCancel').click();
  });

  test('Add code button appends a new empty row', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await page.getByTestId('meta-codes-toggle').click();
    await page.getByTestId('meta-codes-add-btn').click();
    await expect(page.getByTestId('meta-code-code-1')).toBeVisible();
    await page.locator('#metadataModalCancel').click();
  });

  test('edited codes are committed on Apply and round-trip through export', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await page.getByTestId('meta-codes-toggle').click();
    await page.getByTestId('meta-codes-add-btn').click();
    await page.getByTestId('meta-code-system-1').fill('http://snomed.info/sct');
    await page.getByTestId('meta-code-code-1').fill('44054006');
    await page.getByTestId('meta-code-display-1').fill('Type 2 diabetes');
    await page.locator('#metadataModalApply').click();
    // Export and verify both codes in JSON
    page.once('dialog', d => d.accept());
    await page.getByTestId('export-btn').click();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('export-fhir-item').click(),
    ]);
    const filePath = await download.path();
    const { readFileSync } = await import('node:fs');
    const q = JSON.parse(readFileSync(filePath, 'utf8'));
    expect(q.code).toHaveLength(2);
    expect(q.code[1].code).toBe('44054006');
  });

  test('Cancel discards code changes', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await page.getByTestId('meta-codes-toggle').click();
    await page.getByTestId('meta-code-remove-0').click();
    await page.locator('#metadataModalCancel').click();
    // Reopen — code must still be there
    await openModal(page);
    await page.getByTestId('meta-codes-toggle').click();
    await expect(page.getByTestId('meta-code-code-0')).toHaveValue('44249-1');
    await page.locator('#metadataModalCancel').click();
  });

  test('removing all codes sets _rawCode to null (no code[] in export)', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await page.getByTestId('meta-codes-toggle').click();
    await page.getByTestId('meta-code-remove-0').click();
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
    expect(q.code).toBeUndefined();
  });
});

// ── Resource Meta section ─────────────────────────────────────────────────────

async function exportFHIR(page) {
  page.once('dialog', d => d.accept());
  await page.getByTestId('export-btn').click();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('export-fhir-item').click(),
  ]);
  const fp = await download.path();
  const { readFileSync } = await import('node:fs');
  return JSON.parse(readFileSync(fp, 'utf8'));
}

test.describe('metadata modal — Resource Meta section', () => {

  // ── Toggle ──────────────────────────────────────────────────────────────────

  test('toggle button is visible after opening the modal', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await expect(page.getByTestId('meta-resource-meta-toggle')).toBeVisible();
    await page.locator('#metadataModalCancel').click();
  });

  test('section is auto-expanded when fixture has meta content', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await expect(page.getByTestId('meta-version-id')).toBeVisible();
    await page.locator('#metadataModalCancel').click();
  });

  test('section is collapsed by default on a fresh questionnaire', async ({ page }) => {
    await freshStart(page);
    await page.getByTestId('add-root-group-btn').click();
    await openModal(page);
    await expect(page.getByTestId('meta-version-id')).not.toBeVisible();
    await page.locator('#metadataModalCancel').click();
  });

  test('clicking toggle expands and collapses the section', async ({ page }) => {
    await freshStart(page);
    await page.getByTestId('add-root-group-btn').click();
    await openModal(page);
    await page.getByTestId('meta-resource-meta-toggle').click();
    await expect(page.getByTestId('meta-version-id')).toBeVisible();
    await page.getByTestId('meta-resource-meta-toggle').click();
    await expect(page.getByTestId('meta-version-id')).not.toBeVisible();
    await page.locator('#metadataModalCancel').click();
  });

  // ── versionId ───────────────────────────────────────────────────────────────

  test('versionId is pre-populated from imported meta.versionId', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await expect(page.getByTestId('meta-version-id')).toHaveValue('42');
    await page.locator('#metadataModalCancel').click();
  });

  test('Generate button sets a UUID v4 in the versionId input', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await page.getByTestId('meta-version-id-generate').click();
    const value = await page.getByTestId('meta-version-id').inputValue();
    expect(value).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    await page.locator('#metadataModalCancel').click();
  });

  test('versionId is written to export JSON on Apply', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await page.getByTestId('meta-version-id').fill('99');
    await page.locator('#metadataModalApply').click();
    const q = await exportFHIR(page);
    expect(q.meta.versionId).toBe('99');
  });

  test('Cancel discards versionId edit', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await page.getByTestId('meta-version-id').fill('changed');
    await page.locator('#metadataModalCancel').click();
    await openModal(page);
    await expect(page.getByTestId('meta-version-id')).toHaveValue('42');
    await page.locator('#metadataModalCancel').click();
  });

  // ── source ──────────────────────────────────────────────────────────────────

  test('source is pre-populated from imported meta.source', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await expect(page.getByTestId('meta-source')).toHaveValue('https://example.org/systems/test-builder');
    await page.locator('#metadataModalCancel').click();
  });

  test('source is written to export JSON on Apply', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await page.getByTestId('meta-source').fill('https://example.org/new-source');
    await page.locator('#metadataModalApply').click();
    const q = await exportFHIR(page);
    expect(q.meta.source).toBe('https://example.org/new-source');
  });

  test('Cancel discards source edit', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await page.getByTestId('meta-source').fill('https://changed.example.org');
    await page.locator('#metadataModalCancel').click();
    await openModal(page);
    await expect(page.getByTestId('meta-source')).toHaveValue('https://example.org/systems/test-builder');
    await page.locator('#metadataModalCancel').click();
  });

  test('clearing source omits meta.source from export', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await page.getByTestId('meta-source').fill('');
    await page.locator('#metadataModalApply').click();
    const q = await exportFHIR(page);
    expect(q.meta.source).toBeUndefined();
  });

  // ── lastUpdated ─────────────────────────────────────────────────────────────

  test('lastUpdated shows imported value as read-only text', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await expect(page.getByTestId('meta-last-updated')).toContainText('2024-03-15T10:00:00.000Z');
    await page.locator('#metadataModalCancel').click();
  });

  test('meta.lastUpdated in export is always a fresh ISO timestamp', async ({ page }) => {
    const before = Date.now();
    await loadFixture(page);
    const q = await exportFHIR(page);
    const after = Date.now();
    const exported = new Date(q.meta.lastUpdated).getTime();
    expect(exported).toBeGreaterThanOrEqual(before);
    expect(exported).toBeLessThanOrEqual(after);
  });

  test('clean questionnaire has no meta block in export', async ({ page }) => {
    await freshStart(page);
    await page.getByTestId('add-root-group-btn').click();
    const q = await exportFHIR(page);
    expect(q.meta).toBeUndefined();
  });

  // ── profile[] ───────────────────────────────────────────────────────────────

  test('profile URL is pre-populated from imported meta.profile', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await expect(page.getByTestId('meta-profile-url-0')).toHaveValue(
      'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire'
    );
    await page.locator('#metadataModalCancel').click();
  });

  test('Add Profile URL appends a new empty input', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await page.getByTestId('meta-profile-add-btn').click();
    await expect(page.getByTestId('meta-profile-url-1')).toBeVisible();
    await page.locator('#metadataModalCancel').click();
  });

  test('profile remove button deletes the row', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await page.getByTestId('meta-profile-remove-0').click();
    await expect(page.getByTestId('meta-profile-url-0')).not.toBeVisible();
    await page.locator('#metadataModalCancel').click();
  });

  test('profile[] round-trips through export', async ({ page }) => {
    await loadFixture(page);
    const q = await exportFHIR(page);
    expect(q.meta.profile).toEqual([
      'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire',
    ]);
  });

  test('added profile URL appears in export JSON', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await page.getByTestId('meta-profile-add-btn').click();
    await page.getByTestId('meta-profile-url-1').fill('http://example.org/custom-profile');
    await page.locator('#metadataModalApply').click();
    const q = await exportFHIR(page);
    expect(q.meta.profile).toHaveLength(2);
    expect(q.meta.profile[1]).toBe('http://example.org/custom-profile');
  });

  test('removing all profiles omits meta.profile from export', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await page.getByTestId('meta-profile-remove-0').click();
    await page.locator('#metadataModalApply').click();
    const q = await exportFHIR(page);
    expect(q.meta.profile).toBeUndefined();
  });

  // ── tag[] ───────────────────────────────────────────────────────────────────

  test('tag Coding row is pre-populated from imported meta.tag', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await expect(page.getByTestId('meta-tag-system-0')).toHaveValue('http://example.org/tags');
    await expect(page.getByTestId('meta-tag-code-0')).toHaveValue('reviewed');
    await expect(page.getByTestId('meta-tag-display-0')).toHaveValue('Reviewed');
    await page.locator('#metadataModalCancel').click();
  });

  test('Add tag button appends a new empty row', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await page.getByTestId('meta-tags-add-btn').click();
    await expect(page.getByTestId('meta-tag-code-1')).toBeVisible();
    await page.locator('#metadataModalCancel').click();
  });

  test('tag[] round-trips through export', async ({ page }) => {
    await loadFixture(page);
    const q = await exportFHIR(page);
    expect(q.meta.tag).toEqual([
      { system: 'http://example.org/tags', code: 'reviewed', display: 'Reviewed' },
    ]);
  });

  test('edited tag code is written to export JSON', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await page.getByTestId('meta-tag-code-0').fill('approved');
    await page.locator('#metadataModalApply').click();
    const q = await exportFHIR(page);
    expect(q.meta.tag[0].code).toBe('approved');
  });

  test('Cancel discards tag edits', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await page.getByTestId('meta-tag-code-0').fill('CHANGED');
    await page.locator('#metadataModalCancel').click();
    await openModal(page);
    await expect(page.getByTestId('meta-tag-code-0')).toHaveValue('reviewed');
    await page.locator('#metadataModalCancel').click();
  });

  // ── security[] ──────────────────────────────────────────────────────────────

  test('security Coding row is pre-populated from imported meta.security', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await expect(page.getByTestId('meta-security-system-0')).toHaveValue(
      'http://terminology.hl7.org/CodeSystem/v3-Confidentiality'
    );
    await expect(page.getByTestId('meta-security-code-0')).toHaveValue('N');
    await expect(page.getByTestId('meta-security-display-0')).toHaveValue('Normal');
    await page.locator('#metadataModalCancel').click();
  });

  test('Add security label button appends a new empty row', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await page.getByTestId('meta-securitys-add-btn').click();
    await expect(page.getByTestId('meta-security-code-1')).toBeVisible();
    await page.locator('#metadataModalCancel').click();
  });

  test('security[] round-trips through export', async ({ page }) => {
    await loadFixture(page);
    const q = await exportFHIR(page);
    expect(q.meta.security).toEqual([
      {
        system: 'http://terminology.hl7.org/CodeSystem/v3-Confidentiality',
        code: 'N',
        display: 'Normal',
      },
    ]);
  });

  test('edited security code is written to export JSON', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await page.getByTestId('meta-security-code-0').fill('R');
    await page.locator('#metadataModalApply').click();
    const q = await exportFHIR(page);
    expect(q.meta.security[0].code).toBe('R');
  });

  // ── Badge count ─────────────────────────────────────────────────────────────

  test('toggle badge reflects count of filled meta fields', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    // fixture: versionId(1) + source(1) + profile[1](1) + tag[code](1) + security[code](1) = 5
    await expect(page.getByTestId('meta-resource-meta-toggle')).toContainText('(5)');
    await page.locator('#metadataModalCancel').click();
  });
});
// ── Questionnaire.identifier[] section ─────────────────────────────────────────────────────

test.describe('metadata modal — Identifiers section', () => {

  test('toggle button is visible when modal is open', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await expect(page.getByTestId('meta-identifiers-toggle')).toBeVisible();
    await page.locator('#metadataModalCancel').click();
  });

  test('section is auto-expanded when fixture has identifiers', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await expect(page.getByTestId('meta-identifier-system-0')).toBeVisible();
    await page.locator('#metadataModalCancel').click();
  });

  test('section is collapsed by default on a fresh questionnaire', async ({ page }) => {
    await freshStart(page);
    await page.getByTestId('add-root-group-btn').click();
    await openModal(page);
    await expect(page.getByTestId('meta-identifier-add-btn')).not.toBeVisible();
    await page.locator('#metadataModalCancel').click();
  });

  test('clicking toggle expands the section', async ({ page }) => {
    await freshStart(page);
    await page.getByTestId('add-root-group-btn').click();
    await openModal(page);
    await page.getByTestId('meta-identifiers-toggle').click();
    await expect(page.getByTestId('meta-identifier-add-btn')).toBeVisible();
    await page.locator('#metadataModalCancel').click();
  });

  test('toggle badge shows count of non-empty identifiers', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await expect(page.getByTestId('meta-identifiers-toggle')).toContainText('(1)');
    await page.locator('#metadataModalCancel').click();
  });

  test('imported identifier row has correct system, value and use', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await expect(page.getByTestId('meta-identifier-use-0')).toHaveAttribute('data-value', 'official');
    await expect(page.getByTestId('meta-identifier-system-0')).toHaveValue('http://example.org/questionnaire-ids');
    await expect(page.getByTestId('meta-identifier-value-0')).toHaveValue('Q-2024-001');
    await page.locator('#metadataModalCancel').click();
  });

  test('Add Identifier button appends a new empty row', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await page.getByTestId('meta-identifier-add-btn').click();
    await expect(page.getByTestId('meta-identifier-system-1')).toBeVisible();
    await page.locator('#metadataModalCancel').click();
  });

  test('remove button deletes the identifier row', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await page.getByTestId('meta-identifier-remove-0').click();
    await expect(page.getByTestId('meta-identifier-system-0')).not.toBeVisible();
    await page.locator('#metadataModalCancel').click();
  });

  test('identifier[] round-trips through export', async ({ page }) => {
    await loadFixture(page);
    const q = await exportFHIR(page);
    expect(q.identifier).toEqual([
      { use: 'official', system: 'http://example.org/questionnaire-ids', value: 'Q-2024-001' },
    ]);
  });

  test('edited identifier value is committed on Apply and written to export', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await page.getByTestId('meta-identifier-value-0').fill('Q-2025-999');
    await page.locator('#metadataModalApply').click();
    const q = await exportFHIR(page);
    expect(q.identifier[0].value).toBe('Q-2025-999');
  });

  test('edited identifier system is committed on Apply and written to export', async ({ page }) => {
    await loadFixture(page);  
    await openModal(page);
    await page.getByTestId('meta-identifier-system-0').fill('http://new.example.org/ids');
    await page.locator('#metadataModalApply').click();
    const q = await exportFHIR(page);
    expect(q.identifier[0].system).toBe('http://new.example.org/ids');
  });

  test('Cancel discards identifier edits', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await page.getByTestId('meta-identifier-value-0').fill('CHANGED');
    await page.locator('#metadataModalCancel').click();
    await openModal(page);
    await expect(page.getByTestId('meta-identifier-value-0')).toHaveValue('Q-2024-001');
    await page.locator('#metadataModalCancel').click();
  });

  test('added identifier is written to export JSON', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await page.getByTestId('meta-identifier-add-btn').click();
    await page.getByTestId('meta-identifier-system-1').fill('http://acme.org/ids');
    await page.getByTestId('meta-identifier-value-1').fill('ACME-007');
    await page.locator('#metadataModalApply').click();
    const q = await exportFHIR(page);
    expect(q.identifier).toHaveLength(2);
    expect(q.identifier[1]).toMatchObject({ system: 'http://acme.org/ids', value: 'ACME-007' });
  });

  test('removing all identifiers omits identifier[] from export', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await page.getByTestId('meta-identifier-remove-0').click();
    await page.locator('#metadataModalApply').click();
    const q = await exportFHIR(page);
    expect(q.identifier).toBeUndefined();
  });

  test('new questionnaire without identifiers has no identifier[] in export', async ({ page }) => {
    await freshStart(page);
    await page.getByTestId('add-root-group-btn').click();
    const q = await exportFHIR(page);
    expect(q.identifier).toBeUndefined();
  });
});

// ── Questionnaire.text (Narrative) — read-only indicator ──────────────────────

test.describe('metadata modal — Narrative (Questionnaire.text)', () => {
  test('narrative status row is visible when questionnaire has text', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await expect(page.getByTestId('meta-narrative-status')).toBeVisible();
    await page.locator('#metadataModalCancel').click();
  });

  test('narrative status row shows correct status value', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await expect(page.getByTestId('meta-narrative-status')).toHaveText('preserved \u00b7 status: generated');
    await page.locator('#metadataModalCancel').click();
  });

  test('narrative div block is visible below the status row', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    const pre = page.locator('.meta-modal-narrative');
    await expect(pre).toBeVisible();
    await expect(pre).toContainText('<div xmlns');
    await page.locator('#metadataModalCancel').click();
  });

  test('narrative row is visible even when questionnaire has no imported text', async ({ page }) => {
    await freshStart(page);
    await page.getByTestId('add-root-group-btn').click();
    await openModal(page);
    await expect(page.getByTestId('meta-narrative-status')).toBeVisible();
    await expect(page.getByTestId('meta-narrative-status')).toContainText('generated on export');
    await page.locator('#metadataModalCancel').click();
  });

  test('text field round-trips through export unchanged', async ({ page }) => {
    await loadFixture(page);
    const q = await exportFHIR(page);
    expect(q.text).toEqual({
      status: 'generated',
      div: '<div xmlns="http://www.w3.org/1999/xhtml"><p>Test narrative content</p></div>',
    });
  });

  test('text field is auto-generated in export when questionnaire had no imported text', async ({ page }) => {
    await freshStart(page);
    await page.getByTestId('add-root-group-btn').click();
    const q = await exportFHIR(page);
    expect(q.text).toBeDefined();
    expect(q.text.status).toBe('generated');
    expect(q.text.div).toContain('<div xmlns');
  });

  test('text field is auto-generated (not absent) in export after form clear', async ({ page }) => {
    await loadFixture(page);
    await page.getByTestId('clear-form-btn').click();
    await page.waitForSelector('.clear-confirm-backdrop');
    await page.getByTestId('clear-confirm-clear-btn').click();
    await page.getByTestId('add-root-group-btn').click();
    const q = await exportFHIR(page);
    expect(q.text).toBeDefined();
    expect(q.text.status).toBe('generated');
  });
});
