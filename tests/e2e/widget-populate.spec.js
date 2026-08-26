// ── E2E: widget-scoped $populate / StructureMap-populate ─────────────────────
// Proves QuestionnaireRenderer's own config (fhirBaseUrl, getAuthToken) drives
// populate()/structureMapPopulate() independently of the app's Settings/OAuth —
// multiple widget instances with different servers/tokens don't cross-contaminate,
// a host-supplied token is used verbatim (no widget-managed OAuth popup), and
// errors are silent by default (emitted as 'error'/'info' events, not a
// page-blocking toast) unless the host subscribes.
//
// Uses widget-demo.html only as a harmless host page; each test mounts its own
// ad-hoc QuestionnaireRenderer via a dynamic import inside page.evaluate.
//
// Run: npx playwright test tests/e2e/widget-populate.spec.js

import { test, expect } from '@playwright/test';

const SOURCE_SM_URL = 'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-sourceStructureMap';

function simpleQuestionnaire() {
  return {
    resourceType: 'Questionnaire', status: 'draft',
    item: [{ linkId: 'q1', type: 'string', text: 'Q1' }],
  };
}

// Minimal raw StructureMap JSON model (not FML text — FML source contexts only
// support one "." level; same authoring style as sampledata's populate demo).
function structureMapQuestionnaire() {
  return {
    resourceType: 'Questionnaire', status: 'draft',
    extension: [{ url: SOURCE_SM_URL, valueCanonical: '#patient-to-qr' }],
    contained: [{
      resourceType: 'StructureMap', id: 'patient-to-qr', url: 'http://example.org/StructureMap/PatientToQR',
      name: 'PatientToQR', status: 'active', structure: [], import: [], const: [],
      group: [{
        name: 'main', typeMode: 'none',
        input: [
          { name: 'patient', mode: 'source', type: 'Patient' },
          { name: 'qr', mode: 'target', type: 'QuestionnaireResponse' },
        ],
        rule: [
          { source: [{ context: 'patient' }], target: [{ context: 'qr', element: 'resourceType', listMode: [], transform: 'copy', parameter: [{ valueString: 'QuestionnaireResponse' }] }], rule: [], dependent: [] },
          {
            source: [{ context: 'patient' }],
            target: [{ context: 'qr', element: 'item', variable: '_item0', listMode: [], transform: 'create', parameter: [{ valueString: 'BackboneElement' }] }],
            rule: [
              { source: [{ context: 'patient' }], target: [{ context: '_item0', element: 'linkId', listMode: [], transform: 'copy', parameter: [{ valueString: 'q1' }] }], rule: [], dependent: [] },
              {
                source: [{ context: 'patient' }],
                target: [{ context: '_item0', element: 'answer', variable: '_ans0', listMode: ['first'] }],
                rule: [{
                  source: [{ context: '_ans0' }],
                  target: [{ context: '_ans0', element: 'valueString', listMode: [], transform: 'evaluate', parameter: [{ valueId: 'patient' }, { valueString: 'name.first().family' }] }],
                  rule: [], dependent: [],
                }],
                dependent: [],
              },
            ],
            dependent: [],
          },
        ],
      }],
    }],
    item: [{ linkId: 'q1', type: 'string', text: 'Q1' }],
  };
}

async function mountWidget(page, { testid, questionnaire, config }) {
  await page.evaluate(async ({ testid, questionnaire, config }) => {
    const { QuestionnaireRenderer } = await import('/js/renderer/index.js');
    const mount = document.createElement('div');
    mount.setAttribute('data-testid', testid);
    document.body.appendChild(mount);
    const w = new QuestionnaireRenderer(mount, { questionnaire, config });
    await new Promise(r => w.on('ready', r));
    window.__popWidgets = window.__popWidgets || {};
    window.__popWidgets[testid] = w;
  }, { testid, questionnaire, config });
}

function answerFor(qr, linkId) {
  const item = (qr.item || []).find(i => i.linkId === linkId);
  return item?.answer?.[0]?.valueString ?? null;
}

test.describe('Widget populate (config.fhirBaseUrl / config.getAuthToken)', () => {
  test('populate() merges $populate answers using only config.fhirBaseUrl — no OAuth popup', async ({ page }) => {
    await page.goto('/widget-demo.html');

    let popupOpened = false;
    page.on('popup', () => { popupOpened = true; });

    await page.route(url => url.hostname === 'widget-populate-a.test', async route => {
      expect(route.request().method()).toBe('POST');
      await route.fulfill({
        status: 200, contentType: 'application/fhir+json',
        body: JSON.stringify({
          resourceType: 'QuestionnaireResponse', status: 'completed',
          item: [{ linkId: 'q1', answer: [{ valueString: 'from-server-a' }] }],
        }),
      });
    });

    await mountWidget(page, {
      testid: 'pop-a', questionnaire: simpleQuestionnaire(),
      config: { fhirBaseUrl: 'https://widget-populate-a.test/fhir' },
    });

    const answered = await page.evaluate(async () => {
      const w = window.__popWidgets['pop-a'];
      const infoPromise = new Promise(r => w.on('info', r));
      w.populate('Patient/1');
      await infoPromise;
      return w.getResponse();
    });

    expect(answerFor(answered, 'q1')).toBe('from-server-a');
    expect(popupOpened).toBe(false);
  });

  test('structureMapPopulate() runs the contained StructureMap against a fetched Patient', async ({ page }) => {
    await page.goto('/widget-demo.html');

    await page.route(url => url.hostname === 'widget-populate-sm.test', async route => {
      expect(route.request().method()).toBe('GET');
      await route.fulfill({
        status: 200, contentType: 'application/fhir+json',
        body: JSON.stringify({ resourceType: 'Patient', id: '1', name: [{ family: 'Doe' }] }),
      });
    });

    await mountWidget(page, {
      testid: 'pop-sm', questionnaire: structureMapQuestionnaire(),
      config: { fhirBaseUrl: 'https://widget-populate-sm.test/fhir' },
    });

    const answered = await page.evaluate(async () => {
      const w = window.__popWidgets['pop-sm'];
      const infoPromise = new Promise(r => w.on('info', r));
      w.structureMapPopulate('Patient/1');
      await infoPromise;
      return w.getResponse();
    });

    expect(answerFor(answered, 'q1')).toBe('Doe');
  });

  test('config.getAuthToken() token is sent verbatim as the Authorization header', async ({ page }) => {
    await page.goto('/widget-demo.html');

    let capturedAuth = null;
    await page.route(url => url.hostname === 'widget-populate-auth.test', async route => {
      capturedAuth = route.request().headers()['authorization'] ?? null;
      await route.fulfill({
        status: 200, contentType: 'application/fhir+json',
        body: JSON.stringify({ resourceType: 'QuestionnaireResponse', status: 'completed', item: [] }),
      });
    });

    await mountWidget(page, {
      testid: 'pop-auth', questionnaire: simpleQuestionnaire(),
      config: {
        fhirBaseUrl: 'https://widget-populate-auth.test/fhir',
        // Not a real callback across the evaluate boundary — set post-mount below.
      },
    });

    await page.evaluate(() => {
      window.__popWidgets['pop-auth']._session.config.getAuthToken = () => 'host-token-xyz';
    });

    await page.evaluate(async () => {
      const w = window.__popWidgets['pop-auth'];
      const infoPromise = new Promise(r => w.on('info', r));
      w.populate('Patient/1');
      await infoPromise;
    });

    expect(capturedAuth).toBe('Bearer host-token-xyz');
  });

  test('two widget instances with different fhirBaseUrl/getAuthToken never cross-contaminate', async ({ page }) => {
    await page.goto('/widget-demo.html');

    const seenAuth = {};
    await page.route(url => url.hostname === 'widget-populate-x.test' || url.hostname === 'widget-populate-y.test', async route => {
      const host = new URL(route.request().url()).hostname;
      seenAuth[host] = route.request().headers()['authorization'] ?? null;
      const label = host.includes('-x.') ? 'from-x' : 'from-y';
      await route.fulfill({
        status: 200, contentType: 'application/fhir+json',
        body: JSON.stringify({
          resourceType: 'QuestionnaireResponse', status: 'completed',
          item: [{ linkId: 'q1', answer: [{ valueString: label }] }],
        }),
      });
    });

    await mountWidget(page, { testid: 'pop-x', questionnaire: simpleQuestionnaire(), config: { fhirBaseUrl: 'https://widget-populate-x.test/fhir' } });
    await mountWidget(page, { testid: 'pop-y', questionnaire: simpleQuestionnaire(), config: { fhirBaseUrl: 'https://widget-populate-y.test/fhir' } });
    await page.evaluate(() => {
      window.__popWidgets['pop-x']._session.config.getAuthToken = () => 'token-x';
      window.__popWidgets['pop-y']._session.config.getAuthToken = () => 'token-y';
    });

    const [respX, respY] = await page.evaluate(async () => {
      const x = window.__popWidgets['pop-x'];
      const y = window.__popWidgets['pop-y'];
      const xInfo = new Promise(r => x.on('info', r));
      const yInfo = new Promise(r => y.on('info', r));
      x.populate('Patient/1');
      y.populate('Patient/1');
      await Promise.all([xInfo, yInfo]);
      return [x.getResponse(), y.getResponse()];
    });

    expect(answerFor(respX, 'q1')).toBe('from-x');
    expect(answerFor(respY, 'q1')).toBe('from-y');
    expect(seenAuth['widget-populate-x.test']).toBe('Bearer token-x');
    expect(seenAuth['widget-populate-y.test']).toBe('Bearer token-y');
  });

  test('with no fhirBaseUrl, populate() emits a widget-appropriate error and shows nothing when unhandled', async ({ page }) => {
    await page.goto('/widget-demo.html');
    await mountWidget(page, { testid: 'pop-none', questionnaire: simpleQuestionnaire(), config: {} });

    // No .on('error', ...) listener attached — nothing should appear in the DOM.
    await page.evaluate(() => window.__popWidgets['pop-none'].populate('Patient/1'));
    await page.waitForTimeout(200);
    await expect(page.locator('.notif-box, .modal-backdrop.notif-backdrop')).toHaveCount(0);

    // Attach a listener — the host is told, with a widget-appropriate message
    // (never "Open Settings", which doesn't exist for an embedded widget).
    const message = await page.evaluate(() => new Promise(resolve => {
      const w = window.__popWidgets['pop-none'];
      w.on('error', resolve);
      w.populate('Patient/1');
    }));
    expect(message).toBe('FHIR Base Server not configured.');
    expect(message).not.toContain('Settings');
  });
});
