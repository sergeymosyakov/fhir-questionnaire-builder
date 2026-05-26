// ── E2E: Design Note modal ────────────────────────────────────────────────────
// Tests for the "Note" action link and designNote modal on item and group cards.
//
// Run: npx playwright test tests/e2e/note-modal.spec.js
//
// ── data-testid used in this suite ───────────────────────────────────────────
//   add-root-group-btn   "+Add Root Group"
//   group-add-btn        "+" button on a group
//   add-menu-item        "Item" option in add-child menu
//   action-note          "Note" action link on a node card
//   design-note-input    textarea inside the modal body
//
// ── element IDs ──────────────────────────────────────────────────────────────
//   designNoteModal        backdrop
//   designNoteModalTitle   <span> inside modal-header
//   designNoteModalClose   × close button
//   designNoteModalCancel  Cancel button
//   designNoteModalApply   Apply button
// ─────────────────────────────────────────────────────────────────────────────

import path from 'node:path';
import { test, expect } from '@playwright/test';

const DN_URL    = 'http://hl7.org/fhir/StructureDefinition/designNote';
const _FIXTURE  = path.resolve('tests/fixtures/meta-test.fhir.json');

async function waitForLoad(page) {
  await page.waitForSelector('[data-testid="add-root-group-btn"]', { timeout: 10_000 });
}

async function freshStart(page) {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/');
  await waitForLoad(page);
}

/** Add a root group + one text item; returns node IDs. */
async function addItem(page) {
  await page.getByTestId('add-root-group-btn').click();
  await expect(page.locator('[data-node-id="1"]')).toBeVisible();
  await page.locator('[data-node-id="1"]').getByTestId('group-add-btn').click();
  await page.locator('[data-testid="add-menu-item"]').first().click();
  await expect(page.locator('[data-node-id="1.1"]')).toBeVisible();
  return { groupId: '1', itemId: '1.1' };
}

const noteModal   = (page) => page.locator('[data-testid="designNoteModal"]');
const noteTitle   = (page) => page.locator('[data-testid="designNoteModalTitle"]');
const noteClose   = (page) => page.locator('[data-testid="designNoteModalClose"]');
const noteCancel  = (page) => page.locator('[data-testid="designNoteModalCancel"]');
const noteApply   = (page) => page.locator('[data-testid="designNoteModalApply"]');
const noteInput   = (page) => page.getByTestId('design-note-input');

// ── Open / close ──────────────────────────────────────────────────────────────

test.describe('note modal — open / close', () => {
  test('Note link opens the modal on an item', async ({ page }) => {
    await freshStart(page);
    const { itemId } = await addItem(page);
    await page.locator(`[data-node-id="${itemId}"]`).getByTestId('action-note').click();
    await expect(noteModal(page)).toBeVisible();
  });

  test('modal title contains "Design Note"', async ({ page }) => {
    await freshStart(page);
    const { itemId } = await addItem(page);
    await page.locator(`[data-node-id="${itemId}"]`).getByTestId('action-note').click();
    await expect(noteTitle(page)).toContainText('Design Note');
  });

  test('× button closes the modal', async ({ page }) => {
    await freshStart(page);
    const { itemId } = await addItem(page);
    await page.locator(`[data-node-id="${itemId}"]`).getByTestId('action-note').click();
    await noteClose(page).click();
    await expect(noteModal(page)).toBeHidden();
  });

  test('Cancel button closes the modal', async ({ page }) => {
    await freshStart(page);
    const { itemId } = await addItem(page);
    await page.locator(`[data-node-id="${itemId}"]`).getByTestId('action-note').click();
    await noteCancel(page).click();
    await expect(noteModal(page)).toBeHidden();
  });

  test('Note link is also present on group cards', async ({ page }) => {
    await freshStart(page);
    await page.getByTestId('add-root-group-btn').click();
    await expect(page.locator('[data-node-id="1"]')).toBeVisible();
    await expect(page.locator('[data-node-id="1"]').getByTestId('action-note')).toBeVisible();
  });
});

// ── Save / discard ─────────────────────────────────────────────────────────────

test.describe('note modal — save and discard', () => {
  test('Apply saves the note and activates the Note link', async ({ page }) => {
    await freshStart(page);
    const { itemId } = await addItem(page);
    const noteLink = page.locator(`[data-node-id="${itemId}"]`).getByTestId('action-note');
    await noteLink.click();
    await noteInput(page).fill('Remember to validate this with QA.');
    await noteApply(page).click();
    await expect(noteModal(page)).toBeHidden();
    await expect(noteLink).toHaveClass(/action-edit--active/);
  });

  test('Cancel discards changes and link stays inactive', async ({ page }) => {
    await freshStart(page);
    const { itemId } = await addItem(page);
    const noteLink = page.locator(`[data-node-id="${itemId}"]`).getByTestId('action-note');
    await noteLink.click();
    await noteInput(page).fill('Draft note that should be discarded.');
    await noteCancel(page).click();
    await expect(noteLink).not.toHaveClass(/action-edit--active/);
  });

  test('re-opening modal shows previously saved note', async ({ page }) => {
    await freshStart(page);
    const { itemId } = await addItem(page);
    const noteLink = page.locator(`[data-node-id="${itemId}"]`).getByTestId('action-note');
    await noteLink.click();
    await noteInput(page).fill('Persisted note.');
    await noteApply(page).click();
    await noteLink.click();
    await expect(noteInput(page)).toHaveValue('Persisted note.');
    await noteCancel(page).click();
  });

  test('clearing note text and Applying removes active state', async ({ page }) => {
    await freshStart(page);
    const { itemId } = await addItem(page);
    const noteLink = page.locator(`[data-node-id="${itemId}"]`).getByTestId('action-note');
    await noteLink.click();
    await noteInput(page).fill('Note to clear.');
    await noteApply(page).click();
    await noteLink.click();
    await noteInput(page).clear();
    await noteApply(page).click();
    await expect(noteLink).not.toHaveClass(/action-edit--active/);
  });
});

// ── Export round-trip ──────────────────────────────────────────────────────────

test.describe('note modal — export round-trip', () => {
  test('saved note is exported as designNote extension with valueMarkdown', async ({ page }) => {
    await freshStart(page);
    const { itemId } = await addItem(page);
    await page.locator(`[data-node-id="${itemId}"]`).getByTestId('action-note').click();
    await noteInput(page).fill('Export test note.');
    await noteApply(page).click();

    page.once('dialog', d => d.accept());
    await page.getByTestId('export-btn').click();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('[data-testid="export-fhir-item"]').click(),
    ]);
    const text = await (await download.createReadStream()).toArray().then(chunks => Buffer.concat(chunks).toString());
    const q = JSON.parse(text);
    const ext = (q.item[0].item[0].extension || []).find(e => e.url === DN_URL);
    expect(ext?.valueMarkdown).toBe('Export test note.');
  });
});

// ── Import round-trip ──────────────────────────────────────────────────────────

test.describe('note modal — import', () => {
  test('imported designNote activates Note link on the item', async ({ page }) => {
    await freshStart(page);
    const fixture = {
      resourceType: 'Questionnaire', title: 'Note Test', status: 'draft',
      item: [{
        linkId: 'g1', type: 'group', text: 'Group',
        item: [{
          linkId: 'q1', type: 'string', text: 'Question',
          extension: [{ url: DN_URL, valueMarkdown: 'Imported note.' }],
        }],
      }],
    };
    await page.locator('#fhirFileInput').setInputFiles({
      name: 'test.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(fixture)),
    });
    await expect(page.locator('[data-node-id="q1"]')).toBeVisible({ timeout: 8_000 });

    const noteLink = page.locator('[data-node-id="q1"]').getByTestId('action-note');
    await expect(noteLink).toHaveClass(/action-edit--active/);
  });

  test('imported designNote text is shown in modal textarea', async ({ page }) => {
    await freshStart(page);
    const fixture = {
      resourceType: 'Questionnaire', title: 'Note Test', status: 'draft',
      item: [{
        linkId: 'g1', type: 'group', text: 'Group',
        item: [{
          linkId: 'q1', type: 'string', text: 'Question',
          extension: [{ url: DN_URL, valueMarkdown: 'Imported note text.' }],
        }],
      }],
    };
    await page.locator('#fhirFileInput').setInputFiles({
      name: 'test.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(fixture)),
    });
    await expect(page.locator('[data-node-id="q1"]')).toBeVisible({ timeout: 8_000 });
    await page.locator('[data-node-id="q1"]').getByTestId('action-note').click();
    await expect(noteInput(page)).toHaveValue('Imported note text.');
    await noteCancel(page).click();
  });
});
