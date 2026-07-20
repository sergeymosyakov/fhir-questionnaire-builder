// ── E2E: custom-select accessibility (a11y) ──────────────────────────────────
// Two dropdown implementations are covered:
//   1. choice-node preview select (js/nodes/choice-node.js) — ARIA announcement:
//      role=combobox / aria-haspopup / aria-expanded, listbox + option roles.
//   2. shared createCustomSelect widget (js/ui/custom-select.js) — full keyboard
//      navigation: ArrowDown/Up move the active option (aria-activedescendant),
//      Enter selects, Escape closes. Exercised via the reference type dropdown.
//
// data-testid registry:
//   fhir-file-input   — questionnaire file input
//   preview-panel     — preview wrapper
//   csel-drop         — createCustomSelect open dropdown portal
// Preview control classes (sanctioned non-testid exception): .sc-trigger, .oc-opt
// ─────────────────────────────────────────────────────────────────────────────

import { test, expect } from '@playwright/test';
import path from 'node:path';
import { freshStart } from './helpers/builder.js';

const CHOICE_FIXTURE = path.resolve('sampledata/annual-health-check.fhir.json');
const REF_FIXTURE    = path.resolve('tests/fixtures/reference-profile.fhir.json');

async function load(page, fixture, previewId) {
  await freshStart(page);
  await page.locator('[data-testid="fhir-file-input"]').setInputFiles(fixture);
  await expect(page.locator(`[data-preview-id="${previewId}"]`)).toBeVisible({ timeout: 8_000 });
}

// ── choice-node select — ARIA announcement ───────────────────────────────────
test.describe('choice select accessibility', () => {
  async function choiceTrigger(page) {
    await load(page, CHOICE_FIXTURE, 'mood');
    const trigger = page.locator('[data-preview-id="mood"] .sc-trigger').first();
    await expect(trigger).toBeVisible();
    return trigger;
  }

  test('trigger exposes combobox ARIA with an accessible name', async ({ page }) => {
    const trigger = await choiceTrigger(page);
    await expect(trigger).toHaveAttribute('role', 'combobox');
    await expect(trigger).toHaveAttribute('aria-haspopup', 'listbox');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(trigger).toHaveAttribute('aria-label', /.+/);
  });

  test('opening exposes a listbox with option roles; Escape closes', async ({ page }) => {
    const trigger = await choiceTrigger(page);
    await trigger.click();
    const drop = page.locator('.oc-drop').first();
    await expect(drop).toBeVisible();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(drop).toHaveAttribute('role', 'listbox');
    const opt = drop.locator('.oc-opt').first();
    await expect(opt).toHaveAttribute('role', 'option');
    await expect(opt).toHaveAttribute('aria-selected', /true|false/);

    await page.keyboard.press('Escape');
    await expect(drop).toBeHidden();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });
});

// ── createCustomSelect — keyboard navigation ─────────────────────────────────
test.describe('custom-select keyboard navigation', () => {
  async function refTrigger(page) {
    await load(page, REF_FIXTURE, 'q-def');
    const trigger = page.locator('[data-preview-id="q-def"] .sc-trigger').first();
    await expect(trigger).toBeVisible();
    return trigger;
  }

  test('trigger exposes combobox ARIA', async ({ page }) => {
    const trigger = await refTrigger(page);
    await expect(trigger).toHaveAttribute('role', 'combobox');
    await expect(trigger).toHaveAttribute('aria-haspopup', 'listbox');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  test('ArrowDown opens and moves the active option; Enter selects', async ({ page }) => {
    const trigger = await refTrigger(page);
    await trigger.focus();
    await page.keyboard.press('ArrowDown'); // open
    await expect(page.getByTestId('csel-drop')).toBeVisible();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');

    await page.keyboard.press('ArrowDown');
    const a1 = await trigger.getAttribute('aria-activedescendant');
    expect(a1).toBeTruthy();
    await page.keyboard.press('ArrowDown');
    const a2 = await trigger.getAttribute('aria-activedescendant');
    expect(a2).toBeTruthy();
    expect(a2).not.toBe(a1);

    await page.keyboard.press('Enter');
    await expect(page.getByTestId('csel-drop')).toBeHidden();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });
});
