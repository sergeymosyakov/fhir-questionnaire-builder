// ── E2E: Paste warning modal (js/ui/modals/paste-warning-modal.js) ───────────
// Pasting a copied node shows "Paste — Expression Review" when (a) a pasted
// expression references a linkId outside the copied subtree, or (b) an
// expression elsewhere queries the tree structure (.descendants(), .count()).
// A clean paste shows nothing. The fixture is built in-memory.
//
// Run: npx playwright test tests/e2e/paste-warning-modal.spec.js
//
// ── data-testid registry ─────────────────────────────────────────────────────
//   fhir-file-input          hidden file input used to load the fixture
//   node-gear-btn            ⚙ gear button on an item node
//   node-copy-btn            "Copy" gear-menu item
//   node-paste-after-btn     "Paste after" gear-menu item
//   pasteWarningModal        modal backdrop
//   pasteWarningModalTitle   modal title
//   pasteWarningModalCancel  "Got it" dismiss button
//   paste-warn-heading       section heading (external refs / tree structure)
//   paste-warn-table         expression table of one section
//   paste-warn-row           one flagged expression row (linkId, type, expression)
// ─────────────────────────────────────────────────────────────────────────────

import { test, expect } from '@playwright/test';
import { freshStart } from './helpers/builder.js';

const SDC = 'http://hl7.org/fhir/uv/sdc/StructureDefinition/';
const calc = expression => ({
  url: SDC + 'sdc-questionnaire-calculatedExpression',
  valueExpression: { language: 'text/fhirpath', expression },
});

const BY_ID_EXPR = "%resource.item.where(linkId='a').answer.value";
const STRUCTURAL_EXPR = "%resource.descendants().where(linkId='a').count()";

function questionnaire(items) {
  return { resourceType: 'Questionnaire', status: 'draft', title: 'Paste warning', item: items };
}

async function load(page, items) {
  await page.addInitScript(() => localStorage.clear());
  await freshStart(page);
  await page.getByTestId('fhir-file-input').setInputFiles({
    name: 'paste-warning.fhir.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(questionnaire(items))),
  });
  await expect(page.locator(`[data-node-id="${items[0].linkId}"]`)).toBeVisible();
}

// Run a gear-menu action on a node, reopening the menu retry-safely.
async function gearAction(page, nodeId, actionTestid) {
  const node = page.locator(`[data-node-id="${nodeId}"]`).first();
  await expect(async () => {
    if (!(await node.getByTestId(actionTestid).first().isVisible())) {
      await node.getByTestId('node-gear-btn').first().click();
    }
    await expect(node.getByTestId(actionTestid).first()).toBeVisible();
  }).toPass();
  await node.getByTestId(actionTestid).first().click();
}

const copyThenPasteAfter = async (page, nodeId) => {
  await gearAction(page, nodeId, 'node-copy-btn');
  await gearAction(page, nodeId, 'node-paste-after-btn');
};

test.describe('Paste warning modal', () => {
  test('pasting an item whose expression references an outside linkId lists it', async ({ page }) => {
    await load(page, [
      { linkId: 'a', text: 'A', type: 'integer' },
      { linkId: 'b', text: 'B', type: 'integer', extension: [calc(BY_ID_EXPR)] },
    ]);
    await copyThenPasteAfter(page, 'b');

    await expect(page.getByTestId('pasteWarningModal')).toBeVisible();
    await expect(page.getByTestId('pasteWarningModalTitle')).toHaveText('Paste — Expression Review');
    await expect(page.getByTestId('paste-warn-heading')).toHaveText('Expressions in pasted items referencing external linkIds');
    const row = page.getByTestId('paste-warn-row');
    await expect(row).toHaveCount(1);
    await expect(row).toContainText('calculatedExpression');
    await expect(row).toContainText(BY_ID_EXPR);
    // The paste itself still happened.
    await expect(page.locator('[data-node-id="b-copy"]')).toBeVisible();
  });

  test('a tree-structure query elsewhere is flagged when any item is pasted', async ({ page }) => {
    await load(page, [
      { linkId: 'a', text: 'A', type: 'integer' },
      { linkId: 'c', text: 'C', type: 'integer', extension: [calc(STRUCTURAL_EXPR)] },
    ]);
    await copyThenPasteAfter(page, 'a');

    await expect(page.getByTestId('pasteWarningModal')).toBeVisible();
    await expect(page.getByTestId('paste-warn-heading')).toHaveText('Expressions querying tree structure');
    const row = page.getByTestId('paste-warn-row');
    await expect(row).toHaveCount(1);
    await expect(row).toContainText('c');
    await expect(row).toContainText('.descendants()');
  });

  test('"Got it" dismisses the modal', async ({ page }) => {
    await load(page, [
      { linkId: 'a', text: 'A', type: 'integer' },
      { linkId: 'b', text: 'B', type: 'integer', extension: [calc(BY_ID_EXPR)] },
    ]);
    await copyThenPasteAfter(page, 'b');
    await expect(page.getByTestId('pasteWarningModal')).toBeVisible();

    await page.getByTestId('pasteWarningModalCancel').click();
    await expect(page.getByTestId('pasteWarningModal')).toBeHidden();
  });

  test('a clean paste opens no warning', async ({ page }) => {
    await load(page, [{ linkId: 'a', text: 'A', type: 'integer' }]);
    await copyThenPasteAfter(page, 'a');

    await expect(page.locator('[data-node-id="a-copy"]')).toBeVisible();
    // The warning opens in a requestAnimationFrame after the re-render — let it run.
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    await expect(page.getByTestId('pasteWarningModal')).toBeHidden();
  });
});
