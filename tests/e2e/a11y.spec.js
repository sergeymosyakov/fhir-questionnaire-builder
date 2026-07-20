// ── E2E: preview accessibility (a11y) ────────────────────────────────────────
// Dependency-free a11y checks over the rendered questionnaire preview:
//   • every native form control has an accessible name (WCAG 4.1.2) — provided
//     by PreviewForm._applyA11yLabels (aria-label from the item title)
//   • the item prefix and "optional" badges use the darkened, AA-contrast colours
//
// data-testid registry:
//   fhir-file-input   — questionnaire file input
//   preview-panel     — wrapper around the rendered preview
//
// Run: npx playwright test tests/e2e/a11y.spec.js
// ─────────────────────────────────────────────────────────────────────────────

import { test, expect } from '@playwright/test';
import path from 'node:path';
import { freshStart } from './helpers/builder.js';

const SAMPLES = [
  'sampledata/phq-9.fhir.json',
  'sampledata/annual-health-check.fhir.json',
];

async function loadSample(page, fixtureRel) {
  await freshStart(page);
  await page.locator('[data-testid="fhir-file-input"]').setInputFiles(path.resolve(fixtureRel));
  await expect(page.locator('[data-testid="preview-panel"] [data-preview-id]').first())
    .toBeVisible({ timeout: 8_000 });
}

// Collect native form controls in the preview that lack an accessible name.
async function controlsWithoutAccessibleName(page) {
  return page.$$eval(
    '[data-testid="preview-panel"] input, [data-testid="preview-panel"] select, [data-testid="preview-panel"] textarea',
    els => {
      const hasName = (el) => {
        if (el.type === 'hidden') return true;
        if (el.getAttribute('aria-label')?.trim()) return true;
        const labelledby = el.getAttribute('aria-labelledby');
        if (labelledby && labelledby.split(/\s+/).some(id => document.getElementById(id)?.textContent?.trim())) return true;
        if (el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`)?.textContent?.trim()) return true;
        if (el.closest('label')?.textContent?.trim()) return true;
        if (el.getAttribute('title')?.trim()) return true;
        return false;
      };
      return els.filter(el => !hasName(el)).map(el => el.outerHTML.slice(0, 100));
    },
  );
}

test.describe('preview accessibility', () => {
  for (const sample of SAMPLES) {
    test(`every preview control has an accessible name — ${path.basename(sample)}`, async ({ page }) => {
      await loadSample(page, sample);
      const missing = await controlsWithoutAccessibleName(page);
      expect(missing, `controls without accessible name: ${missing.join(' | ')}`).toEqual([]);
    });
  }

  test('prefix and optional badges use AA-contrast colours', async ({ page }) => {
    await loadSample(page, SAMPLES[1]); // annual-health-check has prefixes + optional items
    const prefix = page.locator('[data-testid="preview-panel"] .preview-prefix').first();
    await expect(prefix).toBeVisible();
    // #b34700 = rgb(179, 71, 0)
    await expect(prefix).toHaveCSS('color', 'rgb(179, 71, 0)');

    const badge = page.locator('[data-testid="preview-panel"] .preview-optional-badge').first();
    await expect(badge).toBeVisible();
    // #6b6b6b = rgb(107, 107, 107)
    await expect(badge).toHaveCSS('color', 'rgb(107, 107, 107)');
  });
});
