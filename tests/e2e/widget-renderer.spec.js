// ── E2E: embeddable QuestionnaireRenderer widget ──────────────────────────────
// Proves the headless renderer (Core session + widget-mode PreviewForm) mounts a
// questionnaire into a plain element, reflects answers, and exposes getResponse().
// Uses widget-demo.html (raw-ESM dogfood: annual-health-check in patient mode).
//
// Run: npx playwright test tests/e2e/widget-renderer.spec.js

import { test, expect } from '@playwright/test';

const DEMO = '/widget-demo.html';

test.describe('QuestionnaireRenderer widget', () => {
  test('renders an imported questionnaire into a headless mount', async ({ page }) => {
    await page.goto(DEMO);
    const mount = page.getByTestId('widget-mount');
    await expect(mount.locator('[data-preview-id]').first()).toBeVisible({ timeout: 10_000 });
    // The annual health check has many items → several rendered rows.
    expect(await mount.locator('[data-preview-id]').count()).toBeGreaterThan(1);
  });

  test('getResponse() returns a QuestionnaireResponse', async ({ page }) => {
    await page.goto(DEMO);
    await page.getByTestId('widget-mount').locator('[data-preview-id]').first().waitFor({ timeout: 10_000 });
    const rt = await page.evaluate(() => window.__widget.getResponse().resourceType);
    expect(rt).toBe('QuestionnaireResponse');
  });

  test('setResponse answers round-trip through getResponse', async ({ page }) => {
    await page.goto(DEMO);
    await page.getByTestId('widget-mount').locator('[data-preview-id]').first().waitFor({ timeout: 10_000 });

    const answered = await page.evaluate(async () => {
      const q = await (await fetch('sampledata/annual-health-check.fhir.json')).json();
      const findCoded = items => {
        for (const it of items || []) {
          if (it.type !== 'group' && it.answerOption?.length) return it;
          const r = findCoded(it.item); if (r) return r;
        }
        return null;
      };
      const item = findCoded(q.item);
      const qr = {
        resourceType: 'QuestionnaireResponse', status: 'in-progress',
        item: [{ linkId: item.linkId, answer: [{ valueCoding: item.answerOption[0].valueCoding }] }],
      };
      window.__widget.setResponse(qr);
      const out = window.__widget.getResponse();
      const count = items => (items || []).reduce((n, it) => n + (it.answer ? it.answer.length : 0) + count(it.item), 0);
      return count(out.item);
    });
    expect(answered).toBeGreaterThan(0);
  });

  test('three preview modes render + instances stay isolated', async ({ page }) => {
    await page.goto(DEMO);
    // preview + patient render as forms; json renders the FHIR JSON.
    await expect(page.locator('[data-mode="preview"] [data-preview-id]').first()).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('[data-mode="patient"] [data-preview-id]').first()).toBeVisible();
    const jsonView = page.locator('[data-mode="json"] .fhir-json-view');
    await expect(jsonView).toBeVisible();
    await expect(jsonView).toContainText('Questionnaire');

    // Isolation: answering the patient widget must not affect the preview widget.
    const counts = await page.evaluate(async () => {
      const q = await (await fetch('sampledata/annual-health-check.fhir.json')).json();
      const findCoded = items => {
        for (const it of items || []) {
          if (it.type !== 'group' && it.answerOption?.length) return it;
          const r = findCoded(it.item); if (r) return r;
        }
        return null;
      };
      const item = findCoded(q.item);
      const cnt = items => (items || []).reduce((n, it) => n + (it.answer ? it.answer.length : 0) + cnt(it.item), 0);
      const previewBefore = cnt(window.__widgets.preview.getResponse().item);
      window.__widgets.patient.setResponse({
        resourceType: 'QuestionnaireResponse', status: 'in-progress',
        item: [{ linkId: item.linkId, answer: [{ valueCoding: item.answerOption[0].valueCoding }] }],
      });
      return {
        patient: cnt(window.__widgets.patient.getResponse().item),
        previewBefore,
        previewAfter: cnt(window.__widgets.preview.getResponse().item),
      };
    });
    expect(counts.patient).toBeGreaterThan(0);
    expect(counts.previewAfter).toBe(counts.previewBefore);
  });

  test('live input recomputes the typed widget and never leaks to a sibling', async ({ page }) => {
    await page.goto(DEMO);
    const patientHeight = page.locator('[data-mode="patient"] [data-preview-id="height"] input');
    await expect(patientHeight).toBeVisible({ timeout: 10_000 });

    // Type into the patient widget's Height control (real control input → notifyChanged
    // on the session bus). Commit by blurring into another field.
    await patientHeight.fill('182');
    await page.locator('[data-mode="patient"] [data-preview-id="weight"] input').click();

    const r = await page.evaluate(() => {
      const findAnswer = (items, linkId) => {
        for (const it of items || []) {
          if (it.linkId === linkId && it.answer?.length) return it.answer[0];
          const hit = findAnswer(it.item, linkId);
          if (hit) return hit;
        }
        return undefined;
      };
      const pick = a => a ? (a.valueDecimal ?? a.valueInteger ?? a.valueQuantity?.value) : undefined;
      return {
        patient: pick(findAnswer(window.__widgets.patient.getResponse().item, 'height')),
        preview: pick(findAnswer(window.__widgets.preview.getResponse().item, 'height')),
      };
    });
    expect(r.patient).toBe(182);          // typed widget updated via its own bus/store
    expect(r.preview).not.toBe(182);      // sibling widget untouched (isolated session)
  });
});

