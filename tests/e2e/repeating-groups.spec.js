// ── E2E: Repeating group preview ─────────────────────────────────────────────
// Tests repeating-group rendering, Add/Remove, per-instance enableWhen,
// per-instance required validation, and nested repeat (schedule inside meds).
//
// Fixture: tests/fixtures/repeating-group-demo.fhir.json
// ─────────────────────────────────────────────────────────────────────────────

import path from 'node:path';
import { test, expect } from '@playwright/test';

const FIXTURE = path.resolve('tests/fixtures/repeating-group-demo.fhir.json');

async function commitInput(page) {
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  await page.getByTestId('preview-search-input').click();
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
}

async function freshLoad(page) {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/');
  await page.waitForSelector('[data-testid="add-root-group-btn"]', { timeout: 10_000 });
  await page.locator('[data-testid="fhir-file-input"]').setInputFiles(FIXTURE);
  await expect(page.locator('[data-preview-id="meds"]')).toBeVisible({ timeout: 8_000 });
  await expect(page.locator('[data-rg-group="meds"] > [data-testid="rg-add-btn"]')).toBeVisible({ timeout: 5_000 });
}

// Helpers: meds- and schedule-level locators
const meds = (page) => page.locator('[data-rg-group="meds"]');
const medsInsts = (page) => meds(page).locator(':scope > .rg-inst');
const medsAdd = (page) => meds(page).locator(':scope > [data-testid="rg-add-btn"]');
const schedInsts = (inst) => inst.locator('[data-rg-group="schedule"] > .rg-inst');
const schedAdd = (inst) => inst.locator('[data-rg-group="schedule"] > [data-testid="rg-add-btn"]');

// ── import render ─────────────────────────────────────────────────────────────
test.describe('repeating group — import render', () => {
  test('REPEATABLE badge is visible on the meds group header', async ({ page }) => {
    await freshLoad(page);
    await expect(page.locator('[data-preview-id="meds"] .preview-group-ctrl-badge')).toContainText('Repeatable');
  });

  test('initial render shows exactly one meds instance', async ({ page }) => {
    await freshLoad(page);
    await expect(medsInsts(page)).toHaveCount(1);
  });

  test('"+ Add another entry" button is visible on the meds group', async ({ page }) => {
    await freshLoad(page);
    await expect(medsAdd(page)).toBeVisible();
  });

  test('remove button is hidden when only one meds instance (min=1)', async ({ page }) => {
    await freshLoad(page);
    await expect(meds(page).locator(':scope > .rg-inst [data-testid="rg-remove-btn"]')).toHaveCount(0);
  });

  test('remove buttons appear once a second meds instance is added', async ({ page }) => {
    await freshLoad(page);
    await medsAdd(page).click();
    await expect(medsInsts(page)).toHaveCount(2);
    await expect(meds(page).locator(':scope > .rg-inst [data-testid="rg-remove-btn"]').first()).toBeVisible();
  });
});

// ── per-instance enableWhen ───────────────────────────────────────────────────
test.describe('repeating group — per-instance enableWhen', () => {
  test('PRN note is dimmed when PRN checkbox is unchecked', async ({ page }) => {
    await freshLoad(page);
    const inst0 = medsInsts(page).first();
    await expect(inst0.locator('.preview-condition-hint')).toBeVisible();
    await expect(inst0.locator('[data-preview-id="med-prn-note"] input, [data-preview-id="med-prn-note"] textarea')).toHaveCount(0);
  });

  test('checking PRN in inst0 reveals PRN note only in inst0', async ({ page }) => {
    await freshLoad(page);
    await medsAdd(page).click();
    await expect(medsInsts(page)).toHaveCount(2);

    const inst0 = medsInsts(page).first();
    const inst1 = medsInsts(page).nth(1);

    await inst0.locator('[data-preview-id="med-prn"] input[type=checkbox]').click();
    await commitInput(page);

    await expect(inst0.locator('[data-preview-id="med-prn-note"] textarea, [data-preview-id="med-prn-note"] input')).toBeVisible({ timeout: 5_000 });
    await expect(inst1.locator('[data-preview-id="med-prn-note"] textarea, [data-preview-id="med-prn-note"] input')).toHaveCount(0);
  });

  test('unchecking PRN hides PRN note again in that instance', async ({ page }) => {
    await freshLoad(page);
    const inst0 = medsInsts(page).first();
    const cb = inst0.locator('[data-preview-id="med-prn"] input[type=checkbox]');
    await cb.click();
    await commitInput(page);
    await expect(inst0.locator('[data-preview-id="med-prn-note"] textarea, [data-preview-id="med-prn-note"] input')).toBeVisible({ timeout: 5_000 });
    await cb.click();
    await commitInput(page);
    await expect(inst0.locator('[data-preview-id="med-prn-note"] textarea, [data-preview-id="med-prn-note"] input')).toHaveCount(0, { timeout: 5_000 });
  });

  test('PRN checked in inst1 does not reveal PRN note in inst0', async ({ page }) => {
    await freshLoad(page);
    await medsAdd(page).click();
    await expect(medsInsts(page)).toHaveCount(2);

    const inst0 = medsInsts(page).first();
    const inst1 = medsInsts(page).nth(1);

    await inst1.locator('[data-preview-id="med-prn"] input[type=checkbox]').click();
    await commitInput(page);

    await expect(inst1.locator('[data-preview-id="med-prn-note"] textarea, [data-preview-id="med-prn-note"] input')).toBeVisible({ timeout: 5_000 });
    await expect(inst0.locator('[data-preview-id="med-prn-note"] textarea, [data-preview-id="med-prn-note"] input')).toHaveCount(0);
  });
});

// ── per-instance validation ───────────────────────────────────────────────────
test.describe('repeating group — per-instance required validation', () => {
  test('required med-name shows fail icon initially', async ({ page }) => {
    await freshLoad(page);
    await expect(medsInsts(page).first().locator('[data-preview-id="med-name"] .icon-fail')).toBeVisible();
  });

  test('filling med-name clears fail icon in that instance only', async ({ page }) => {
    await freshLoad(page);
    await medsAdd(page).click();
    await expect(medsInsts(page)).toHaveCount(2);

    const inst0 = medsInsts(page).first();
    const inst1 = medsInsts(page).nth(1);

    await inst0.locator('[data-preview-id="med-name"] textarea, [data-preview-id="med-name"] input').fill('Aspirin');
    await commitInput(page);

    await expect(inst0.locator('[data-preview-id="med-name"] .icon-ok')).toBeVisible({ timeout: 5_000 });
    await expect(inst1.locator('[data-preview-id="med-name"] .icon-fail')).toBeVisible();
  });
});

// ── Add / Remove ──────────────────────────────────────────────────────────────
test.describe('repeating group — Add / Remove instances', () => {
  test('clicking rg-add-btn adds a new meds instance', async ({ page }) => {
    await freshLoad(page);
    await medsAdd(page).click();
    await expect(medsInsts(page)).toHaveCount(2);
  });

  test('clicking Remove on the second instance removes only that instance', async ({ page }) => {
    await freshLoad(page);
    await medsAdd(page).click();
    await expect(medsInsts(page)).toHaveCount(2);
    await meds(page).locator(':scope > .rg-inst [data-testid="rg-remove-btn"]').nth(1).click();
    await expect(medsInsts(page)).toHaveCount(1);
  });

  test('value in inst0 survives after adding inst1', async ({ page }) => {
    await freshLoad(page);
    const inst0 = medsInsts(page).first();
    await inst0.locator('[data-preview-id="med-name"] textarea, [data-preview-id="med-name"] input').fill('Ibuprofen');
    await commitInput(page);
    await medsAdd(page).click();
    await expect(medsInsts(page)).toHaveCount(2);
    expect(await inst0.locator('[data-preview-id="med-name"] textarea, [data-preview-id="med-name"] input').inputValue()).toBe('Ibuprofen');
  });
});

// ── Nested repeating group ────────────────────────────────────────────────────
test.describe('repeating group — nested repeat (schedule inside medication)', () => {
  test('dose schedule sub-group has REPEATABLE badge', async ({ page }) => {
    await freshLoad(page);
    await expect(page.locator('[data-preview-id="schedule"]').first().locator('.preview-group-ctrl-badge')).toContainText('Repeatable');
  });

  test('dose schedule has its own rg-add-btn', async ({ page }) => {
    await freshLoad(page);
    await expect(schedAdd(medsInsts(page).first())).toBeVisible();
  });

  test('adding a schedule row in inst0 does not affect inst1 schedule', async ({ page }) => {
    await freshLoad(page);
    await medsAdd(page).click();
    await expect(medsInsts(page)).toHaveCount(2);

    const inst0 = medsInsts(page).first();
    const inst1 = medsInsts(page).nth(1);

    await schedAdd(inst0).click();
    await expect(schedInsts(inst0)).toHaveCount(2, { timeout: 5_000 });
    await expect(schedInsts(inst1)).toHaveCount(1);
  });

  test('time value in inst0/sched0 is isolated from inst1/sched0', async ({ page }) => {
    await freshLoad(page);
    await medsAdd(page).click();
    await expect(medsInsts(page)).toHaveCount(2);

    const inst0 = medsInsts(page).first();
    const inst1 = medsInsts(page).nth(1);
    const ti0 = schedInsts(inst0).first().locator('[data-preview-id="sched-time"] input');

    await ti0.fill('08:00');
    await commitInput(page);

    expect(await ti0.inputValue()).toBe('08:00');
    expect(await schedInsts(inst1).first().locator('[data-preview-id="sched-time"] input').inputValue()).toBe('');
  });
});

// ── FHIR round-trip ───────────────────────────────────────────────────────────
test.describe('repeating group — FHIR round-trip', () => {
  test('exported FHIR JSON has repeats:true on meds and schedule groups', async ({ page }) => {
    await freshLoad(page);
    const json = await page.evaluate(async () => {
      const { buildFHIRObject } = await import('/js/fhir/export.js');
      return JSON.stringify(buildFHIRObject());
    });
    const q = JSON.parse(json);
    const medsItem = q.item?.find(i => i.linkId === 'meds');
    expect(medsItem?.repeats).toBe(true);
    expect(medsItem?.item?.find(i => i.linkId === 'schedule')?.repeats).toBe(true);
  });
});

// ── Repeatable action link in builder ────────────────────────────────────────
test.describe('repeating group — Repeatable action link in builder', () => {
  test('loaded repeating group has Repeatable action link highlighted (active)', async ({ page }) => {
    await freshLoad(page);
    const repeatBtn = page.locator('[data-testid="tree-container"] .node-group').filter({
      has: page.locator('[data-testid="node-title-display"]:has-text("Medications")'),
    }).first().locator('[data-testid="action-repeatable"]').first();
    await expect(repeatBtn).toBeVisible({ timeout: 5_000 });
    await expect(repeatBtn).toHaveClass(/action-edit--active/);
  });

  test('new plain group has Repeatable action link NOT active by default', async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
    await page.goto('/');
    await page.waitForSelector('[data-testid="add-root-group-btn"]', { timeout: 10_000 });
    await page.getByTestId('add-root-group-btn').click();
    await expect(page.locator('[data-testid="tree-container"] [data-node-id]').first()
      .getByTestId('action-repeatable')).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('[data-testid="tree-container"] [data-node-id]').first()
      .getByTestId('action-repeatable')).not.toHaveClass(/action-edit--active/);
  });

  test('clicking Repeatable action link opens the Repeatable modal', async ({ page }) => {
    await freshLoad(page);
    const repeatBtn = page.locator('[data-testid="tree-container"] .node-group').filter({
      has: page.locator('[data-testid="node-title-display"]:has-text("Medications")'),
    }).first().locator('[data-testid="action-repeatable"]').first();
    await expect(repeatBtn).toBeVisible({ timeout: 5_000 });
    await repeatBtn.click();
    await expect(page.locator('[data-testid="repeatableModal"]')).toBeVisible({ timeout: 5_000 });
    await page.locator('[data-testid="repeatableModal"]').getByRole('button', { name: 'Cancel' }).click();
  });

  test('toggling Repeatable on in modal activates the action link and shows preview instances', async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
    await page.goto('/');
    await page.waitForSelector('[data-testid="add-root-group-btn"]', { timeout: 10_000 });
    await page.getByTestId('add-root-group-btn').click();
    const groupNode = page.locator('[data-testid="tree-container"] .node-group').first();
    // Add a child item so the group has children (needed for instances to render)
    await expect(groupNode.getByTestId('group-add-btn')).toBeVisible({ timeout: 5_000 });
    await groupNode.getByTestId('group-add-btn').click();
    const addItemBtn = page.locator('[data-testid="add-menu-item"]').first();
    await expect(addItemBtn).toBeVisible({ timeout: 5_000 });
    await addItemBtn.click();
    // Now enable Repeatable on the group
    const repeatBtn = page.locator('[data-testid="tree-container"] .node-group [data-testid="action-repeatable"]').first();
    await expect(repeatBtn).toBeVisible({ timeout: 5_000 });
    await expect(repeatBtn).not.toHaveClass(/action-edit--active/);
    await repeatBtn.click();
    await expect(page.locator('[data-testid="repeatableModal"]')).toBeVisible({ timeout: 5_000 });
    await page.getByTestId('repeat-modal-toggle').check();
    await page.locator('[data-testid="repeatableModal"]').getByRole('button', { name: /apply/i }).click();
    await expect(repeatBtn).toHaveClass(/action-edit--active/, { timeout: 5_000 });
    await expect(page.locator('[data-testid="rg-add-btn"]').first()).toBeVisible({ timeout: 5_000 });
  });
});

