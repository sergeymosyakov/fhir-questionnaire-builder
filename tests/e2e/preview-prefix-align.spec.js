// ── E2E: preview ordinal prefix alignment ────────────────────────────────────
// Regression guard: required rows (which carry a coloured left border in patient
// view via .lform-item--invalid) must not shift their content sideways relative
// to normal rows — the ordinal prefix numbers (1.1, 1.2, …) must line up in a
// single column. The base row reserves a 3px transparent left-border gutter.
//
// data-testid registry:
//   fhir-file-input        — questionnaire file input
//   preview-panel          — preview wrapper
//   preview-mode-btn       — preview mode dropdown
//   preview-mode-patient   — "Patient View" menu item
// ─────────────────────────────────────────────────────────────────────────────

import { test, expect } from '@playwright/test';
import path from 'node:path';
import { freshStart } from './helpers/builder.js';

const FIXTURE = path.resolve('sampledata/annual-health-check.fhir.json');

async function loadPatientView(page) {
  await freshStart(page);
  await page.locator('[data-testid="fhir-file-input"]').setInputFiles(FIXTURE);
  await expect(page.locator('[data-testid="preview-panel"] [data-preview-id]').first())
    .toBeVisible({ timeout: 8_000 });
  // Open the preview-mode dropdown retry-safely, then pick Patient View.
  await expect(async () => {
    if (!(await page.getByTestId('preview-mode-patient').isVisible())) {
      await page.getByTestId('preview-mode-btn').click();
    }
    await expect(page.getByTestId('preview-mode-patient')).toBeVisible();
  }).toPass();
  await page.getByTestId('preview-mode-patient').click();
  // Patient view marks unfilled required rows invalid (coloured left border).
  await expect(page.locator('[data-testid="preview-panel"] .lform-item--invalid').first())
    .toBeVisible({ timeout: 8_000 });
}

test.describe('preview ordinal prefix alignment', () => {
  test('required and normal rows align their prefix numbers', async ({ page }) => {
    await loadPatientView(page);

    const lefts = await page.$$eval('[data-testid="preview-panel"] .lform-item', rows =>
      rows.map(r => {
        const pfx = r.querySelector('.preview-prefix');
        if (!pfx) return null;
        return {
          prefix: pfx.textContent.trim(),
          left: Math.round(pfx.getBoundingClientRect().left),
          invalid: r.classList.contains('lform-item--invalid'),
        };
      }).filter(Boolean),
    );

    // Compare only group 1's items (1.1–1.5): same nesting level, mixing required
    // (1.1, 1.2 → invalid) and normal (1.3–1.5) rows. They must share a left edge.
    const g1 = lefts.filter(x => /^1\.\d+$/.test(x.prefix));
    expect(g1.some(x => x.invalid)).toBe(true);   // at least one required row
    expect(g1.some(x => !x.invalid)).toBe(true);  // at least one normal row

    const min = Math.min(...g1.map(x => x.left));
    const max = Math.max(...g1.map(x => x.left));
    expect(max - min).toBeLessThanOrEqual(1);
  });

  test('group header number is vertically centred with its title', async ({ page }) => {
    await loadPatientView(page);
    const res = await page.$$eval('[data-testid="preview-panel"] .lform-item', rows => {
      for (const r of rows) {
        const pfx = r.querySelector('.preview-prefix--group');
        const lbl = r.querySelector('.group-label');
        if (pfx && lbl) {
          const pr = pfx.getBoundingClientRect();
          const lr = lbl.getBoundingClientRect();
          return { pfxMid: pr.top + pr.height / 2, lblMid: lr.top + lr.height / 2 };
        }
      }
      return null;
    });
    expect(res, 'expected a group header with a prefix + title').not.toBeNull();
    expect(Math.abs(res.pfxMid - res.lblMid)).toBeLessThanOrEqual(2);
  });
});
