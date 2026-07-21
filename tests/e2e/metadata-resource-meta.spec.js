// ── E2E: Metadata modal — Resource Meta section ───────────────────────────────
// Tests for meta.versionId, meta.source, meta.lastUpdated, meta.profile[],
// meta.tag[], and meta.security[] inside the metadata modal.
//
// Run: npx playwright test tests/e2e/metadata-resource-meta.spec.js
//
// ── data-testid registry ──────────────────────────────────────────────────────
//   meta-resource-meta-toggle  Resource Meta section toggle button
//   meta-implicit-rules        implicitRules URI input
//   meta-version-id            meta.versionId text input
//   meta-version-id-generate   Generate UUID button
//   meta-source                meta.source URI input
//   meta-last-updated          read-only lastUpdated span
//   meta-profile-url-{i}       profile URL input at index i
//   meta-profile-remove-{i}    profile remove button at index i
//   meta-profile-add-btn       Add Profile URL button
//   meta-tag-system-{i}        tag Coding system input at index i
//   meta-tag-code-{i}          tag Coding code input at index i
//   meta-tag-display-{i}       tag Coding display input at index i
//   meta-tag-remove-{i}        tag Coding remove button at index i
//   meta-tags-add-btn          Add tag button
//   meta-security-system-{i}   security Coding system input at index i
//   meta-security-code-{i}     security Coding code input at index i
//   meta-security-display-{i}  security Coding display input at index i
//   meta-security-remove-{i}   security Coding remove button at index i
//   meta-securitys-add-btn     Add security label button
//   metadataModalApply         (id) Apply button
//   metadataModalCancel        (id) Cancel button
// ─────────────────────────────────────────────────────────────────────────────

import { test, expect } from '@playwright/test';
import { FHIR } from '../../js/fhir/urls/fhir.js';
import { freshStart, loadFixture, openModal, exportFHIR } from './helpers/metadata.js';

// ── Toggle ────────────────────────────────────────────────────────────────────

test.describe('metadata modal — Resource Meta section', () => {

  test('toggle button is visible after opening the modal', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await expect(page.getByTestId('meta-resource-meta-toggle')).toBeVisible();
    await page.locator('[data-testid="metadataModalCancel"]').click();
  });

  test('section is auto-expanded when fixture has meta content', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await expect(page.getByTestId('meta-version-id')).toBeVisible();
    await page.locator('[data-testid="metadataModalCancel"]').click();
  });

  test('section is collapsed by default on a fresh questionnaire', async ({ page }) => {
    await freshStart(page);
    await page.getByTestId('add-root-group-btn').click();
    await openModal(page);
    await expect(page.getByTestId('meta-version-id')).not.toBeVisible();
    await page.locator('[data-testid="metadataModalCancel"]').click();
  });

  test('clicking toggle expands and collapses the section', async ({ page }) => {
    await freshStart(page);
    await page.getByTestId('add-root-group-btn').click();
    await openModal(page);
    await page.getByTestId('meta-resource-meta-toggle').click();
    await expect(page.getByTestId('meta-version-id')).toBeVisible();
    await page.getByTestId('meta-resource-meta-toggle').click();
    await expect(page.getByTestId('meta-version-id')).not.toBeVisible();
    await page.locator('[data-testid="metadataModalCancel"]').click();
  });

  // ── versionId ───────────────────────────────────────────────────────────────

  test('versionId is pre-populated from imported meta.versionId', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await expect(page.getByTestId('meta-version-id')).toHaveValue('42');
    await page.locator('[data-testid="metadataModalCancel"]').click();
  });

  test('Generate button sets a UUID v4 in the versionId input', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await page.getByTestId('meta-version-id-generate').click();
    const value = await page.getByTestId('meta-version-id').inputValue();
    expect(value).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    await page.locator('[data-testid="metadataModalCancel"]').click();
  });

  test('versionId is written to export JSON on Apply', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await page.getByTestId('meta-version-id').fill('99');
    await page.locator('[data-testid="metadataModalApply"]').click();
    const q = await exportFHIR(page);
    expect(q.meta.versionId).toBe('99');
  });

  test('Cancel discards versionId edit', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await page.getByTestId('meta-version-id').fill('changed');
    await page.locator('[data-testid="metadataModalCancel"]').click();
    await openModal(page);
    await expect(page.getByTestId('meta-version-id')).toHaveValue('42');
    await page.locator('[data-testid="metadataModalCancel"]').click();
  });

  // ── source ──────────────────────────────────────────────────────────────────

  test('source is pre-populated from imported meta.source', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await expect(page.getByTestId('meta-source')).toHaveValue('https://example.org/systems/test-builder');
    await page.locator('[data-testid="metadataModalCancel"]').click();
  });

  test('source is written to export JSON on Apply', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await page.getByTestId('meta-source').fill('https://example.org/new-source');
    await page.locator('[data-testid="metadataModalApply"]').click();
    const q = await exportFHIR(page);
    expect(q.meta.source).toBe('https://example.org/new-source');
  });

  test('Cancel discards source edit', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await page.getByTestId('meta-source').fill('https://changed.example.org');
    await page.locator('[data-testid="metadataModalCancel"]').click();
    await openModal(page);
    await expect(page.getByTestId('meta-source')).toHaveValue('https://example.org/systems/test-builder');
    await page.locator('[data-testid="metadataModalCancel"]').click();
  });

  test('clearing source omits meta.source from export', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await page.getByTestId('meta-source').fill('');
    await page.locator('[data-testid="metadataModalApply"]').click();
    const q = await exportFHIR(page);
    expect(q.meta.source).toBeUndefined();
  });

  // ── lastUpdated ─────────────────────────────────────────────────────────────

  test('lastUpdated shows imported value as read-only text', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await expect(page.getByTestId('meta-last-updated')).toContainText('2024-03-15T10:00:00.000Z');
    await page.locator('[data-testid="metadataModalCancel"]').click();
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

  test('clean questionnaire has no user-set meta fields in export', async ({ page }) => {
    await freshStart(page);
    await page.getByTestId('add-root-group-btn').click();
    await page.locator('[data-node-id="1"]').getByTestId('group-add-btn').click();
    await page.locator('[data-testid="add-menu-item"]').first().click();
    await expect(page.locator('[data-node-id="1.1"]')).toBeVisible();
    const q = await exportFHIR(page);
    // R4 format always stamps meta.lastUpdated and the builder-target-version
    // extension; verify no user-set fields leaked into a clean questionnaire
    expect(q.meta?.profile).toBeUndefined();
    expect(q.meta?.tag).toBeUndefined();
    expect(q.meta?.security).toBeUndefined();
    expect(q.meta?.versionId).toBeUndefined();
    expect(q.meta?.source).toBeUndefined();
  });

  // ── profile[] ───────────────────────────────────────────────────────────────

  test('profile URL is pre-populated from imported meta.profile', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await expect(page.getByTestId('meta-profile-url-0')).toHaveValue(
      FHIR.sdcQuestionnaire
    );
    await page.locator('[data-testid="metadataModalCancel"]').click();
  });

  test('Add Profile URL appends a new empty input', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await page.getByTestId('meta-profile-add-btn').click();
    await expect(page.getByTestId('meta-profile-url-1')).toBeVisible();
    await page.locator('[data-testid="metadataModalCancel"]').click();
  });

  test('profile remove button deletes the row', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await page.getByTestId('meta-profile-remove-0').click();
    await expect(page.getByTestId('meta-profile-url-0')).not.toBeVisible();
    await page.locator('[data-testid="metadataModalCancel"]').click();
  });

  test('profile[] round-trips through export', async ({ page }) => {
    await loadFixture(page);
    const q = await exportFHIR(page);
    expect(q.meta.profile).toEqual([
      FHIR.sdcQuestionnaire,
    ]);
  });

  test('added profile URL appears in export JSON', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await page.getByTestId('meta-profile-add-btn').click();
    await page.getByTestId('meta-profile-url-1').fill('https://example.org/custom-profile');
    await page.locator('[data-testid="metadataModalApply"]').click();
    const q = await exportFHIR(page);
    expect(q.meta.profile).toHaveLength(2);
    expect(q.meta.profile[1]).toBe('https://example.org/custom-profile');
  });

  test('removing all profiles omits meta.profile from export', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await page.getByTestId('meta-profile-remove-0').click();
    await page.locator('[data-testid="metadataModalApply"]').click();
    const q = await exportFHIR(page);
    expect(q.meta.profile).toBeUndefined();
  });

  // ── tag[] ───────────────────────────────────────────────────────────────────

  test('tag Coding row is pre-populated from imported meta.tag', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await expect(page.getByTestId('meta-tag-system-0')).toHaveValue('https://example.org/tags');
    await expect(page.getByTestId('meta-tag-code-0')).toHaveValue('reviewed');
    await expect(page.getByTestId('meta-tag-display-0')).toHaveValue('Reviewed');
    await page.locator('[data-testid="metadataModalCancel"]').click();
  });

  test('Add tag button appends a new empty row', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await page.getByTestId('meta-tags-add-btn').click();
    await expect(page.getByTestId('meta-tag-code-1')).toBeVisible();
    await page.locator('[data-testid="metadataModalCancel"]').click();
  });

  test('tag[] round-trips through export', async ({ page }) => {
    await loadFixture(page);
    const q = await exportFHIR(page);
    expect(q.meta.tag).toEqual([
      { system: 'https://example.org/tags', code: 'reviewed', display: 'Reviewed' },
    ]);
  });

  test('edited tag code is written to export JSON', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await page.getByTestId('meta-tag-code-0').fill('approved');
    await page.locator('[data-testid="metadataModalApply"]').click();
    const q = await exportFHIR(page);
    expect(q.meta.tag[0].code).toBe('approved');
  });

  test('Cancel discards tag edits', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await page.getByTestId('meta-tag-code-0').fill('CHANGED');
    await page.locator('[data-testid="metadataModalCancel"]').click();
    await openModal(page);
    await expect(page.getByTestId('meta-tag-code-0')).toHaveValue('reviewed');
    await page.locator('[data-testid="metadataModalCancel"]').click();
  });

  // ── security[] ──────────────────────────────────────────────────────────────

  test('security Coding row is pre-populated from imported meta.security', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await expect(page.getByTestId('meta-security-system-0')).toHaveValue(
      FHIR.v3Confidentiality
    );
    await expect(page.getByTestId('meta-security-code-0')).toHaveValue('N');
    await expect(page.getByTestId('meta-security-display-0')).toHaveValue('Normal');
    await page.locator('[data-testid="metadataModalCancel"]').click();
  });

  test('Add security label button appends a new empty row', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await page.getByTestId('meta-securitys-add-btn').click();
    await expect(page.getByTestId('meta-security-code-1')).toBeVisible();
    await page.locator('[data-testid="metadataModalCancel"]').click();
  });

  test('security[] round-trips through export', async ({ page }) => {
    await loadFixture(page);
    const q = await exportFHIR(page);
    expect(q.meta.security).toEqual([
      {
        system: FHIR.v3Confidentiality,
        code: 'N',
        display: 'Normal',
      },
    ]);
  });

  test('edited security code is written to export JSON', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await page.getByTestId('meta-security-code-0').fill('R');
    await page.locator('[data-testid="metadataModalApply"]').click();
    const q = await exportFHIR(page);
    expect(q.meta.security[0].code).toBe('R');
  });

  // ── implicitRules ─────────────────────────────────────────────────────────

  test('implicitRules field is visible in resource meta section', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await expect(page.getByTestId('meta-implicit-rules')).toBeVisible();
  });

  test('fixture implicitRules is pre-filled in the field', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await expect(page.getByTestId('meta-implicit-rules')).toHaveValue('https://example.org/fhir/implicit-rules');
  });

  test('edited implicitRules is written to export JSON', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await page.getByTestId('meta-implicit-rules').fill('https://example.org/updated-rules');
    await page.locator('[data-testid="metadataModalApply"]').click();
    const q = await exportFHIR(page);
    expect(q.implicitRules).toBe('https://example.org/updated-rules');
  });

  test('clearing implicitRules omits it from export', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    await page.getByTestId('meta-implicit-rules').fill('');
    await page.locator('[data-testid="metadataModalApply"]').click();
    const q = await exportFHIR(page);
    expect(q.implicitRules).toBeUndefined();
  });

  // ── Badge count ─────────────────────────────────────────────────────────────

  test('toggle badge reflects count of filled meta fields', async ({ page }) => {
    await loadFixture(page);
    await openModal(page);
    // fixture: implicitRules(1) + versionId(1) + source(1) + profile[1](1) + tag[code](1) + security[code](1) = 6
    await expect(page.getByTestId('meta-resource-meta-toggle')).toContainText('(6)');
    await page.locator('[data-testid="metadataModalCancel"]').click();
  });
});
