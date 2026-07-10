// ── Regression tests — cross-cutting scenarios ───────────────────────────────
// High and medium priority regression coverage:
//   H1. QR fill → export → reimport round-trip (annual-health-check)
//   H2. calculatedExpression: BMI updates on height/weight input
//   H3. enableWhen + patient view: fields show/hide correctly
//   H4. Repeating-group answer store: two instances with different values isolated
//   M1. Import → export round-trip: linkIds / enableWhen / required preserved
//   M2. Large form (AHRQ 30+ items) renders without JS errors
//
// data-testid registry (beyond standard add-root-group-btn):
//   fhir-file-input        hidden file <input> for JSON load
//   preview-search-input   search box used as focus sink to commit inputs
//   preview-mode-btn       "🖥 Preview ▾" dropdown toggle
//   preview-mode-patient   patient-view menu item inside Preview dropdown
//   tools-btn              "⚙ Tools ▾" dropdown toggle
//   validate-item          Validate menu item inside Tools dropdown
//   variables-reinit-btn   "↺ Re-init" button in the Variables panel
//   rg-add-btn             "＋ Add another entry" button in repeating group
// ─────────────────────────────────────────────────────────────────────────────

import path from 'node:path';
import { test, expect } from '@playwright/test';
import { openDropdownItem } from './helpers/dropdown.js';

const ANNUAL  = path.resolve('sampledata/annual-health-check.fhir.json');
const CALC    = path.resolve('sampledata/patient-scenario-calc-chain.fhir.json');
const RG_DEMO = path.resolve('tests/fixtures/repeating-group-demo.fhir.json');
const AHRQ    = path.resolve('sampledata/ahrq-medication-safety.fhir.json');

async function freshStart(page) {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/');
  await page.waitForSelector('[data-testid="add-root-group-btn"]', { timeout: 10_000 });
}

async function loadFile(page, filePath) {
  await page.locator('[data-testid="fhir-file-input"]').setInputFiles(filePath);
}

/** Commit any pending input changes by yielding two rAF ticks + focusing search box. */
async function commitInput(page) {
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  await page.getByTestId('preview-search-input').click();
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
}

/** Activate patient view mode. */
async function enablePatientView(page) {
  // Preview mode menu: toggle → click patient item
  await expect(page.getByTestId('preview-mode-patient')).not.toBeVisible();
  await page.getByTestId('preview-mode-btn').click();
  await expect(page.getByTestId('preview-mode-patient')).toBeVisible();
  await page.getByTestId('preview-mode-patient').click();
  await expect(page.locator('#lform')).toHaveClass(/patient-view/, { timeout: 5_000 });
}

// ── H1: QR answer export preserves filled values ─────────────────────────────

test.describe('H1 — QR export contains filled answers', () => {
  test('free-text "medications" answer appears in exported QR', async ({ page }) => {
    await freshStart(page);
    await loadFile(page, ANNUAL);
    await expect(page.locator('[data-preview-id="medications"]')).toBeVisible({ timeout: 8_000 });

    const medInput = page.locator(
      '[data-preview-id="medications"] textarea, [data-preview-id="medications"] input'
    ).first();
    await medInput.fill('Aspirin 100mg daily');
    await commitInput(page);

    const qrJson = await page.evaluate(async () => {
      const { buildQR } = await import('/js/fhir/qr-builder.js');
      const { buildFHIRObject } = await import('/js/fhir/export.js');
      const { answerStore } = await import('/js/answer-store.js');
      return JSON.stringify(buildQR(buildFHIRObject(), answerStore.toValueMap()));
    });
    const qr = JSON.parse(qrJson);

    function findAnswer(items, linkId) {
      for (const it of items ?? []) {
        if (it.linkId === linkId) return it.answer?.[0];
        const nested = findAnswer(it.item ?? [], linkId)
          ?? findAnswer((it.answer ?? []).flatMap(a => a.item ?? []), linkId);
        if (nested) return nested;
      }
    }
    expect(findAnswer(qr.item, 'medications')?.valueString).toBe('Aspirin 100mg daily');
  });

  test('numeric height answer appears in exported QR', async ({ page }) => {
    await freshStart(page);
    await loadFile(page, ANNUAL);
    await expect(page.locator('[data-preview-id="height"]')).toBeVisible({ timeout: 8_000 });

    await page.locator('[data-preview-id="height"] input').first().fill('175');
    await commitInput(page);

    const qrJson = await page.evaluate(async () => {
      const { buildQR } = await import('/js/fhir/qr-builder.js');
      const { buildFHIRObject } = await import('/js/fhir/export.js');
      const { answerStore } = await import('/js/answer-store.js');
      return JSON.stringify(buildQR(buildFHIRObject(), answerStore.toValueMap()));
    });
    const qr = JSON.parse(qrJson);

    function findAnswer(items, linkId) {
      for (const it of items ?? []) {
        if (it.linkId === linkId) return it.answer?.[0];
        const nested = findAnswer(it.item ?? [], linkId)
          ?? findAnswer((it.answer ?? []).flatMap(a => a.item ?? []), linkId);
        if (nested) return nested;
      }
    }
    expect(findAnswer(qr.item, 'height')?.valueDecimal).toBe(175);
  });

  test('QR reimport via importQRAnswers restores answered field in preview', async ({ page }) => {
    await freshStart(page);
    await loadFile(page, ANNUAL);
    await expect(page.locator('[data-preview-id="medications"]')).toBeVisible({ timeout: 8_000 });

    const medInput = page.locator(
      '[data-preview-id="medications"] textarea, [data-preview-id="medications"] input'
    ).first();
    await medInput.fill('Test drug');
    await commitInput(page);

    // Capture QR from current state, clear, reimport
    await page.evaluate(async () => {
      const { buildQR } = await import('/js/fhir/qr-builder.js');
      const { buildFHIRObject } = await import('/js/fhir/export.js');
      const { answerStore } = await import('/js/answer-store.js');
      const { importQRAnswers } = await import('/js/fhir/qr-import.js');
      const { questDoc } = await import('/js/fhir/quest-document.js');
      const { AppEvents } = await import('/js/events.js');

      const qr = buildQR(buildFHIRObject(), answerStore.toValueMap());
      document.dispatchEvent(new CustomEvent(AppEvents.ANSWERS_CLEAR));
      const fresh = {};
      importQRAnswers(qr, fresh, questDoc.tree);
      answerStore.replaceAll(fresh);
      document.dispatchEvent(new CustomEvent(AppEvents.RESPONSE_CHANGED));
    });

    await page.evaluate(() => new Promise(r => setTimeout(r, 300)));
    await commitInput(page);

    expect(await medInput.inputValue()).toBe('Test drug');
  });
});

// ── H2: calculatedExpression (BMI) ──────────────────────────────────────────

test.describe('H2 — calculatedExpression: BMI updates on height/weight input', () => {
  test('BMI display shows a numeric value after filling height and weight', async ({ page }) => {
    await freshStart(page);
    await loadFile(page, ANNUAL);
    await expect(page.locator('[data-preview-id="height"]')).toBeVisible({ timeout: 8_000 });

    await page.locator('[data-preview-id="height"] input').first().fill('170');
    await commitInput(page);
    await page.locator('[data-preview-id="weight"] input').first().fill('70');
    await commitInput(page);

    const bmiText = await page.locator('[data-preview-id="bmi"]').textContent();
    // BMI should contain a decimal number (not just the "—" placeholder)
    expect(bmiText).toMatch(/\d+[.,]\d/);
  });

  test('BMI clears when weight is removed', async ({ page }) => {
    await freshStart(page);
    await loadFile(page, ANNUAL);
    await expect(page.locator('[data-preview-id="height"]')).toBeVisible({ timeout: 8_000 });

    await page.locator('[data-preview-id="height"] input').first().fill('170');
    await commitInput(page);
    const weightInput = page.locator('[data-preview-id="weight"] input').first();
    await weightInput.fill('70');
    await commitInput(page);
    // Verify filled
    expect(await page.locator('[data-preview-id="bmi"]').textContent()).toMatch(/\d/);

    // Clear weight
    await weightInput.clear();
    await commitInput(page);
    // BMI should return to placeholder/empty
    const bmiAfter = await page.locator('[data-preview-id="bmi"]').textContent();
    expect(bmiAfter).not.toMatch(/^(\s*)\d{2}\.\d/);
  });

  test('calc-chain sample re-init populates calculated fields without errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => {
      if (m.type() === 'error' && !m.text().includes('favicon')) errors.push(m.text());
    });

    await freshStart(page);
    await loadFile(page, CALC);
    await expect(page.locator('.preview-card')).toBeVisible({ timeout: 8_000 });
    await page.evaluate(() => new Promise(r => setTimeout(r, 500)));

    expect(errors).toHaveLength(0);

    // Re-init triggers initialExpression evaluation
    await expect(page.getByTestId('variables-reinit-btn')).toBeVisible({ timeout: 5_000 });
    await page.getByTestId('variables-reinit-btn').click();
    await page.evaluate(() => new Promise(r => setTimeout(r, 400)));
    const calcVals = await page.locator('.preview-readonly-value').count();
    expect(calcVals).toBeGreaterThan(0);
  });
});

// ── H3: enableWhen + patient view ───────────────────────────────────────────

test.describe('H3 — enableWhen: items show/hide based on trigger answers', () => {
  test('smoker=true reveals cigs-per-day in design preview', async ({ page }) => {
    await freshStart(page);
    await loadFile(page, ANNUAL);
    await expect(page.locator('[data-preview-id="smoker"]')).toBeVisible({ timeout: 8_000 });

    // In design view, enableWhen items are always rendered but dim (lform-waiting class)
    await expect(page.locator('[data-preview-id="cigs"]')).toHaveClass(/lform-waiting/);

    await page.locator('[data-preview-id="smoker"] input[type="checkbox"]').click();
    await commitInput(page);

    // Condition met → lform-waiting removed and input is active
    await expect(page.locator('[data-preview-id="cigs"]')).not.toHaveClass(/lform-waiting/, { timeout: 5_000 });
    await expect(page.locator('[data-preview-id="cigs"] input')).toBeVisible({ timeout: 5_000 });
  });

  test('un-checking smoker hides cigs again in design preview', async ({ page }) => {
    await freshStart(page);
    await loadFile(page, ANNUAL);
    await expect(page.locator('[data-preview-id="smoker"]')).toBeVisible({ timeout: 8_000 });

    // Check → condition met
    await page.locator('[data-preview-id="smoker"] input[type="checkbox"]').click();
    await commitInput(page);
    await expect(page.locator('[data-preview-id="cigs"]')).not.toHaveClass(/lform-waiting/, { timeout: 5_000 });

    // Uncheck → condition no longer met
    await page.locator('[data-preview-id="smoker"] input[type="checkbox"]').click();
    await commitInput(page);
    await expect(page.locator('[data-preview-id="cigs"]')).toHaveClass(/lform-waiting/, { timeout: 5_000 });
  });

  test('smoker=false: cigs absent from patient view', async ({ page }) => {
    await freshStart(page);
    await loadFile(page, ANNUAL);
    await expect(page.locator('[data-preview-id="smoker"]')).toBeVisible({ timeout: 8_000 });

    await enablePatientView(page);
    // smoker was not triggered → cigs not rendered in patient view
    await expect(page.locator('[data-preview-id="cigs"]')).toHaveCount(0);
  });

  test('smoker=true: cigs present in patient view', async ({ page }) => {
    await freshStart(page);
    await loadFile(page, ANNUAL);
    await expect(page.locator('[data-preview-id="smoker"]')).toBeVisible({ timeout: 8_000 });

    await page.locator('[data-preview-id="smoker"] input[type="checkbox"]').click();
    await commitInput(page);

    await enablePatientView(page);
    await expect(page.locator('[data-preview-id="cigs"]')).toBeVisible({ timeout: 5_000 });
  });
});

// ── H4: Repeating-group answer store isolation ───────────────────────────────

test.describe('H4 — repeating group: per-instance value isolation in store', () => {
  async function loadRG(page) {
    await freshStart(page);
    await loadFile(page, RG_DEMO);
    await expect(page.locator('[data-testid="rg-add-btn"]').first()).toBeVisible({ timeout: 8_000 });
  }

  test('two meds instances have independent med-name values in store', async ({ page }) => {
    await loadRG(page);

    // rg-add-btn is a DIRECT CHILD of the rg-instances wrapper (not a sibling)
    await expect(page.locator('[data-rg-group="meds"] > [data-testid="rg-add-btn"]')).toBeVisible();
    await page.locator('[data-rg-group="meds"] > [data-testid="rg-add-btn"]').click();
    await expect(page.locator('[data-rg-group="meds"] > .rg-inst')).toHaveCount(2, { timeout: 5_000 });

    await page.locator('[data-rg-group="meds"] > .rg-inst').first()
      .locator('[data-preview-id="med-name"] input, [data-preview-id="med-name"] textarea').fill('Aspirin');
    await commitInput(page);
    await page.locator('[data-rg-group="meds"] > .rg-inst').nth(1)
      .locator('[data-preview-id="med-name"] input, [data-preview-id="med-name"] textarea').fill('Ibuprofen');
    await commitInput(page);

    const snap = await page.evaluate(async () => {
      const { answerStore } = await import('/js/answer-store.js');
      return JSON.stringify(answerStore.data);
    });
    const store = JSON.parse(snap);

    expect(Array.isArray(store['meds'])).toBe(true);
    expect(store['meds']).toHaveLength(2);
    expect(store['meds'][0]['med-name']?.[0]).toBe('Aspirin');
    expect(store['meds'][1]['med-name']?.[0]).toBe('Ibuprofen');
  });

  test('nested schedule instances stored within correct meds instance', async ({ page }) => {
    await loadRG(page);

    const inst0 = page.locator('[data-rg-group="meds"] > .rg-inst').first();

    // schedule's rg-add-btn is also a direct child of [data-rg-group="schedule"]
    await expect(inst0.locator('[data-rg-group="schedule"] > [data-testid="rg-add-btn"]')).toBeVisible();
    await inst0.locator('[data-rg-group="schedule"] > [data-testid="rg-add-btn"]').click();
    await expect(inst0.locator('[data-rg-group="schedule"] > .rg-inst')).toHaveCount(2, { timeout: 5_000 });

    await inst0.locator('[data-rg-group="schedule"] > .rg-inst').first()
      .locator('[data-preview-id="sched-time"] input').fill('08:00');
    await commitInput(page);
    await inst0.locator('[data-rg-group="schedule"] > .rg-inst').nth(1)
      .locator('[data-preview-id="sched-time"] input').fill('20:00');
    await commitInput(page);

    const snap = await page.evaluate(async () => {
      const { answerStore } = await import('/js/answer-store.js');
      return JSON.stringify(answerStore.data);
    });
    const store = JSON.parse(snap);

    const sched = store['meds']?.[0]?.['schedule'];
    expect(Array.isArray(sched)).toBe(true);
    expect(sched).toHaveLength(2);
    // HTML time inputs normalise HH:MM to HH:MM:SS
    expect(sched[0]['sched-time']?.[0]).toMatch(/^08:00/);
    expect(sched[1]['sched-time']?.[0]).toMatch(/^20:00/);
  });

  test('removing an instance removes it from the store', async ({ page }) => {
    await loadRG(page);

    await expect(page.locator('[data-rg-group="meds"] > [data-testid="rg-add-btn"]')).toBeVisible();
    await page.locator('[data-rg-group="meds"] > [data-testid="rg-add-btn"]').click();
    await expect(page.locator('[data-rg-group="meds"] > .rg-inst')).toHaveCount(2, { timeout: 5_000 });

    await page.locator('[data-rg-group="meds"] > .rg-inst').nth(1)
      .locator('[data-preview-id="med-name"] input, [data-preview-id="med-name"] textarea').fill('ToDelete');
    await commitInput(page);

    // Remove second instance
    await page.locator('[data-rg-group="meds"] > .rg-inst').nth(1).locator('.repeat-remove-btn').click();
    await expect(page.locator('[data-rg-group="meds"] > .rg-inst')).toHaveCount(1, { timeout: 5_000 });

    const snap = await page.evaluate(async () => {
      const { answerStore } = await import('/js/answer-store.js');
      return JSON.stringify(answerStore.data);
    });
    expect(JSON.parse(snap)['meds']).toHaveLength(1);
  });
});

// ── M1: Import → export round-trip fidelity ──────────────────────────────────

test.describe('M1 — Import → export: structural fidelity preserved', () => {
  function findItem(items, linkId) {
    for (const it of items ?? []) {
      if (it.linkId === linkId) return it;
      const found = findItem(it.item ?? [], linkId);
      if (found) return found;
    }
  }
  function collectLinkIds(items) {
    const ids = [];
    for (const it of items ?? []) {
      ids.push(it.linkId);
      ids.push(...collectLinkIds(it.item ?? []));
    }
    return ids;
  }

  test('all expected linkIds present in re-exported questionnaire', async ({ page }) => {
    await freshStart(page);
    await loadFile(page, ANNUAL);
    await expect(page.locator('[data-preview-id="height"]')).toBeVisible({ timeout: 8_000 });

    const json = await page.evaluate(async () => {
      const { buildFHIRObject } = await import('/js/fhir/export.js');
      return JSON.stringify(buildFHIRObject());
    });
    const q = JSON.parse(json);
    const ids = collectLinkIds(q.item);
    for (const id of ['height', 'weight', 'bmi', 'smoker', 'cigs', 'alcohol', 'mood', 'pain']) {
      expect(ids, `linkId "${id}" must be present`).toContain(id);
    }
  });

  test('enableWhen conditions preserved in re-export', async ({ page }) => {
    await freshStart(page);
    await loadFile(page, ANNUAL);
    await expect(page.locator('[data-preview-id="height"]')).toBeVisible({ timeout: 8_000 });

    const json = await page.evaluate(async () => {
      const { buildFHIRObject } = await import('/js/fhir/export.js');
      return JSON.stringify(buildFHIRObject());
    });
    const q = JSON.parse(json);
    const cigs = findItem(q.item, 'cigs');
    expect(cigs?.enableWhen).toBeDefined();
    expect(cigs.enableWhen[0]?.question).toBe('smoker');
  });

  test('required flags preserved in re-export', async ({ page }) => {
    await freshStart(page);
    await loadFile(page, ANNUAL);
    await expect(page.locator('[data-preview-id="height"]')).toBeVisible({ timeout: 8_000 });

    const json = await page.evaluate(async () => {
      const { buildFHIRObject } = await import('/js/fhir/export.js');
      return JSON.stringify(buildFHIRObject());
    });
    const q = JSON.parse(json);
    expect(findItem(q.item, 'height')?.required).toBe(true);
    expect(findItem(q.item, 'weight')?.required).toBe(true);
    expect(findItem(q.item, 'mood')?.required).toBe(true);
  });

  test('readOnly flag on BMI calc field preserved in re-export', async ({ page }) => {
    await freshStart(page);
    await loadFile(page, ANNUAL);
    await expect(page.locator('[data-preview-id="bmi"]')).toBeVisible({ timeout: 8_000 });

    const json = await page.evaluate(async () => {
      const { buildFHIRObject } = await import('/js/fhir/export.js');
      return JSON.stringify(buildFHIRObject());
    });
    const q = JSON.parse(json);
    expect(findItem(q.item, 'bmi')?.readOnly).toBe(true);
  });
});

// ── M2: Large form loads without errors ───────────────────────────────────────

test.describe('M2 — Large form (AHRQ 30+ items) renders without JS errors', () => {
  test('AHRQ form loads and renders multiple items', async ({ page }) => {
    const errors = [];
    page.on('pageerror',  e => errors.push(e.message));
    page.on('console',   m => { if (m.type() === 'error' && !m.text().includes('favicon')) errors.push(m.text()); });

    await freshStart(page);
    await loadFile(page, AHRQ);
    await page.locator('.preview-card .lform-item').first().waitFor({ timeout: 10_000 });
    await page.evaluate(() => new Promise(r => setTimeout(r, 500)));

    expect(errors, 'No JS errors during AHRQ render').toHaveLength(0);
    const itemCount = await page.locator('.preview-card .lform-item').count();
    expect(itemCount).toBeGreaterThan(10);
  });

  test('AHRQ builder tree renders 15+ node cards without crash', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));

    await freshStart(page);
    await loadFile(page, AHRQ);
    await page.locator('[data-testid="tree-container"] [data-node-id]').first().waitFor({ timeout: 10_000 });
    await page.evaluate(() => new Promise(r => setTimeout(r, 500)));

    expect(errors).toHaveLength(0);
    const nodeCount = await page.locator('[data-testid="tree-container"] [data-node-id]').count();
    expect(nodeCount).toBeGreaterThan(15);
  });

  test('AHRQ validate modal opens without crash', async ({ page }) => {
    await freshStart(page);
    await loadFile(page, AHRQ);
    await page.locator('.preview-card .lform-item').first().waitFor({ timeout: 10_000 });

    await openDropdownItem(page, 'tools-btn', 'validate-item');

    const modal = page.locator('[data-testid="validateModal"]');
    await expect(modal).toBeVisible({ timeout: 5_000 });
    await modal.getByRole('button').first().click();
    await expect(modal).not.toBeVisible({ timeout: 3_000 });
  });
});
