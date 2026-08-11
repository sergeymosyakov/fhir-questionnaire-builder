// ── E2E performance regression — large questionnaire render ──────────────────
// Loads a genuinely large real-world questionnaire (WHO SMART Guidelines IMCI /
// EmCare treatment, 226 items, 113 enableWhenExpression) plus a generated
// deep-nested / calc-chain form, and asserts the builder + preview render within
// a generous ceiling. Ceilings are deliberately loose: shared CI runners are
// noisy, so this gates gross regressions (e.g. an O(n^2) blow-up), not micro-perf.
//
// Run: npx playwright test tests/e2e/perf/large-questionnaire.spec.js
//
// data-testid registry:
//   fhir-file-input    hidden file <input> for JSON load
//   tree-container     builder tree root

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test, expect } from '@playwright/test';

const WHO_FIXTURE = path.resolve('sampledata/who-emcare-treatment.fhir.json');

// Generous ceilings (ms). CI runners are ~2-4x slower and noisy; these only trip
// on gross regressions, not normal variance.
const RENDER_CEILING_MS = process.env.CI ? 20_000 : 8_000;

async function freshStart(page) {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/');
  await page.waitForSelector('[data-testid="add-root-group-btn"]', { timeout: 15_000 });
}

// Install page-side timing + error capture before the load is triggered.
async function armPerf(page) {
  await page.evaluate(() => {
    window.__perf = { errors: [] };
    window.addEventListener('error', (e) => window.__perf.errors.push(String(e.message)));
    window.addEventListener('unhandledrejection', (e) => window.__perf.errors.push(String(e.reason)));
    document.addEventListener('builder:render-done', () => {
      window.__perf.builderDone ??= performance.now();
    });
    document.addEventListener('preview:render-done', () => {
      window.__perf.previewDone ??= performance.now();
    });
    window.__perf.loadStart = performance.now();
  });
}

async function loadAndMeasure(page, filePath) {
  await armPerf(page);
  await page.locator('[data-testid="fhir-file-input"]').setInputFiles(filePath);
  await page.waitForFunction(() => window.__perf?.builderDone && window.__perf?.previewDone, null, {
    timeout: RENDER_CEILING_MS + 10_000,
  });
  return page.evaluate(() => ({
    builderMs: window.__perf.builderDone - window.__perf.loadStart,
    previewMs: window.__perf.previewDone - window.__perf.loadStart,
    errors: window.__perf.errors,
    nodes: document.querySelectorAll('[data-testid="tree-container"] [data-node-id]').length,
  }));
}

test.describe('Performance — large questionnaire render @perf', () => {
  test('real WHO EmCare treatment (226 items) renders under ceiling', async ({ page }) => {
    await freshStart(page);
    const m = await loadAndMeasure(page, WHO_FIXTURE);
    console.log(`[perf] WHO EmCare: builder=${m.builderMs.toFixed(0)}ms preview=${m.previewMs.toFixed(0)}ms nodes=${m.nodes}`);

    expect(m.errors, `page errors during render: ${m.errors.join(' | ')}`).toEqual([]);
    expect(m.nodes).toBeGreaterThan(180); // clean import of the ~226-item tree
    expect(m.builderMs).toBeLessThan(RENDER_CEILING_MS);
    expect(m.previewMs).toBeLessThan(RENDER_CEILING_MS);
  });

  test('generated deep-nested form (250 items, depth 8, calc chain) renders under ceiling', async ({ page }) => {
    await freshStart(page);
    const fixture = makeDeepForm({ items: 250, depth: 8 });
    const tmp = path.join(os.tmpdir(), `perf-generated-${Date.now()}.fhir.json`);
    fs.writeFileSync(tmp, JSON.stringify(fixture));
    try {
      const m = await loadAndMeasure(page, tmp);
      console.log(`[perf] generated: builder=${m.builderMs.toFixed(0)}ms preview=${m.previewMs.toFixed(0)}ms nodes=${m.nodes}`);

      expect(m.errors, `page errors during render: ${m.errors.join(' | ')}`).toEqual([]);
      expect(m.nodes).toBeGreaterThan(200);
      expect(m.builderMs).toBeLessThan(RENDER_CEILING_MS);
      expect(m.previewMs).toBeLessThan(RENDER_CEILING_MS);
    } finally {
      fs.rmSync(tmp, { force: true });
    }
  });
});

// Build a synthetic-but-structurally-realistic questionnaire: a spine of nested
// groups `depth` deep, each carrying decimal questions with enableWhen on the
// previous answer and a calculatedExpression chain referencing the prior item.
function makeDeepForm({ items, depth }) {
  const root = [];
  let made = 0;
  let prevId = null;

  const addQuestions = (container, groupId, n) => {
    for (let i = 0; i < n && made < items; i++) {
      const id = `${groupId}.q${i}`;
      const item = {
        linkId: id,
        text: `Question ${id}`,
        type: 'decimal',
      };
      if (prevId) {
        item.enableWhen = [{ question: prevId, operator: '>', answerDecimal: 0 }];
        item.extension = [{
          url: 'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-calculatedExpression',
          valueExpression: {
            language: 'text/fhirpath',
            expression: `%resource.item.where(linkId='${prevId}').answer.valueDecimal + 1`,
          },
        }];
      }
      container.push(item);
      prevId = id;
      made++;
    }
  };

  // Build a chain of nested groups; distribute questions across the depth levels.
  let cursor = root;
  const perLevel = Math.ceil(items / depth);
  for (let d = 0; d < depth && made < items; d++) {
    const groupId = `g${d}`;
    const group = { linkId: groupId, text: `Section ${d}`, type: 'group', item: [] };
    cursor.push(group);
    addQuestions(group.item, groupId, perLevel);
    cursor = group.item; // nest the next group inside this one → depth
  }

  return {
    resourceType: 'Questionnaire',
    status: 'draft',
    title: 'Generated performance form',
    item: root,
  };
}
