// ── E2E: widget-scoped terminology server (external answerValueSet expansion) ─
// Proves QuestionnaireRenderer's own config.terminology wires into a dedicated
// TerminologyService instance (js/fhir/terminology-service.js) instead of the
// app's global serverConfig — external answerValueSet items get real options,
// independent widget instances don't cross-contaminate, and a failed expansion
// never crashes the widget.
//
// Uses widget-demo.html only as a harmless host page; each test mounts its own
// ad-hoc QuestionnaireRenderer via a dynamic import inside page.evaluate.
//
// Run: npx playwright test tests/e2e/widget-terminology.spec.js
//
// ── selectors used (sanctioned preview-control classes, no data-testid needed) ─
//   .sc-trigger        choice-node's dropdown trigger (opens the dropdown)
//   .oc-drop .oc-opt    dropdown option rows (choice-node's own portal dropdown —
//                        distinct from the builder-only createCustomSelect widget)

import { test, expect } from '@playwright/test';

function vsBody(codes) {
  return {
    resourceType: 'ValueSet',
    expansion: { contains: codes.map(([code, display]) => ({ code, display, system: 'https://example.com/fhir/CodeSystem/test' })) },
  };
}

async function mockExpand(page, hostname, codes) {
  await page.route(url => url.hostname === hostname, async route => {
    await route.fulfill({ status: 200, contentType: 'application/fhir+json', body: JSON.stringify(vsBody(codes)) });
  });
}

async function mockExpandError(page, hostname) {
  await page.route(url => url.hostname === hostname, async route => {
    await route.fulfill({ status: 500, contentType: 'application/fhir+json', body: '{}' });
  });
}

async function mountWidget(page, { testid, vsUrl, config }) {
  await page.evaluate(async ({ testid, vsUrl, config }) => {
    const { QuestionnaireRenderer } = await import('/js/renderer/index.js');
    const mount = document.createElement('div');
    mount.setAttribute('data-testid', testid);
    document.body.appendChild(mount);
    const questionnaire = {
      resourceType: 'Questionnaire', status: 'draft',
      item: [{ linkId: '1', type: 'choice', text: 'Pick one', answerValueSet: vsUrl }],
    };
    const w = new QuestionnaireRenderer(mount, { questionnaire, config });
    await new Promise(r => w.on('ready', r));
    window.__wtWidgets = window.__wtWidgets || {};
    window.__wtWidgets[testid] = w;
  }, { testid, vsUrl, config });
}

// expandAll runs async after the widget's first render; the silent re-render that
// follows can replace the trigger/dropdown mid-interaction. Retry the open until
// the expected option count is showing (same pattern as other dropdown e2e specs).
async function openDropdownWithOptions(page, trigger, expectedCount) {
  await expect(async () => {
    await page.keyboard.press('Escape');
    await trigger.click();
    await expect(page.locator('.oc-drop .oc-opt')).toHaveCount(expectedCount, { timeout: 1_000 });
  }).toPass({ timeout: 10_000 });
}

const VS_URL = 'https://example.com/fhir/ValueSet/widget-term-test';

test.describe('Widget terminology server (config.terminology)', () => {
  test('external answerValueSet item shows real options once config.terminology.server is set', async ({ page }) => {
    await page.goto('/widget-demo.html');
    await mockExpand(page, 'widget-term-a.test', [['a', 'Alpha'], ['b', 'Beta']]);

    await mountWidget(page, {
      testid: 'wt-mount-1',
      vsUrl: VS_URL,
      config: { previewMode: 'patient', terminology: { server: 'https://widget-term-a.test/fhir' } },
    });

    const mount = page.getByTestId('wt-mount-1');
    await expect(mount.locator('.sc-trigger')).toBeVisible({ timeout: 10_000 });
    await openDropdownWithOptions(page, mount.locator('.sc-trigger'), 2);
    const opts = page.locator('.oc-drop .oc-opt');
    await expect(opts.nth(0)).toContainText('Alpha');
    await expect(opts.nth(1)).toContainText('Beta');
  });

  test('two widget instances with different terminology servers do not cross-contaminate', async ({ page }) => {
    await page.goto('/widget-demo.html');
    await mockExpand(page, 'widget-term-a.test', [['a', 'Alpha']]);
    await mockExpand(page, 'widget-term-b.test', [['x', 'Xray'], ['y', 'Yankee'], ['z', 'Zulu']]);

    await mountWidget(page, {
      testid: 'wt-mount-a',
      vsUrl: VS_URL,
      config: { previewMode: 'patient', terminology: { server: 'https://widget-term-a.test/fhir' } },
    });
    await mountWidget(page, {
      testid: 'wt-mount-b',
      vsUrl: VS_URL,
      config: { previewMode: 'patient', terminology: { server: 'https://widget-term-b.test/fhir' } },
    });

    const mountA = page.getByTestId('wt-mount-a');
    const mountB = page.getByTestId('wt-mount-b');
    await expect(mountA.locator('.sc-trigger')).toBeVisible({ timeout: 10_000 });
    await expect(mountB.locator('.sc-trigger')).toBeVisible({ timeout: 10_000 });

    await openDropdownWithOptions(page, mountA.locator('.sc-trigger'), 1);
    await expect(page.locator('.oc-drop .oc-opt').first()).toContainText('Alpha');
    await page.keyboard.press('Escape');

    await openDropdownWithOptions(page, mountB.locator('.sc-trigger'), 3);
    await expect(page.locator('.oc-drop .oc-opt').first()).toContainText('Xray');
  });

  test('a failed expansion does not crash the widget — control still renders with no options', async ({ page }) => {
    await page.goto('/widget-demo.html');
    await mockExpandError(page, 'widget-term-err.test');

    await mountWidget(page, {
      testid: 'wt-mount-err',
      vsUrl: VS_URL,
      config: { previewMode: 'patient', terminology: { server: 'https://widget-term-err.test/fhir' } },
    });

    const mount = page.getByTestId('wt-mount-err');
    await expect(mount.locator('.sc-trigger')).toBeVisible({ timeout: 10_000 });
    await mount.locator('.sc-trigger').click();
    await expect(page.locator('.oc-drop .oc-opt')).toHaveCount(0);
    // Widget stays alive/interactive — getResponse() still works.
    const resourceType = await page.evaluate(() => window.__wtWidgets['wt-mount-err'].getResponse().resourceType);
    expect(resourceType).toBe('QuestionnaireResponse');
  });
});
