// ── SDC $populate ─────────────────────────────────────────────────────────────
// Sends a Questionnaire to a FHIR server's $populate operation with a patient
// reference and returns the resulting QuestionnaireResponse.
//
// SDC spec: https://hl7.org/fhir/uv/sdc/OperationDefinition-Questionnaire-populate.html

import { proxiedUrl, fhirAuthHeaderFor, reauthHeaderFor } from './fhir-search.js';
import { serverConfig, CONFIG_KEYS } from './server-config.js';

/**
 * Populate a QuestionnaireResponse from a FHIR server.
 * Uses SDC_SERVER if configured, falls back to FHIR_BASE.
 *
 * @param {string}  fhirBase   - Base FHIR server URL (fallback)
 * @param {object}  questJson  - FHIR Questionnaire resource
 * @param {string}  patientRef - Patient reference string (e.g. 'Patient/123')
 * @param {object}  [opts]
 * @param {object}  [opts.authHeader] - explicit auth header (e.g. a widget host's
 *   own token via config.getAuthToken) — bypasses the app's OAuth/debug-bridge
 *   resolution entirely when provided.
 * @returns {Promise<object>} FHIR QuestionnaireResponse resource
 */
export async function populateFromServer(fhirBase, questJson, patientRef, opts = {}) {
  const sdcConfigured = serverConfig.get(CONFIG_KEYS.SDC_SERVER);
  const sdcBase   = sdcConfigured || fhirBase;
  const base      = sdcBase.replace(/\/$/, '');
  const targetUrl = `${base}/Questionnaire/$populate`;
  const url       = proxiedUrl(targetUrl);
  const serverKey = sdcConfigured ? 'SDC_SERVER' : 'FHIR_BASE';

  const body = JSON.stringify({
    resourceType: 'Parameters',
    parameter: [
      { name: 'questionnaire',   resource: questJson },
      { name: 'subject', valueReference: { reference: patientRef } },
    ],
  });

  let res = await _postPopulate(url, targetUrl, serverKey, body, false, opts.authHeader);
  if (res.status === 401 && !opts.authHeader) res = await _postPopulate(url, targetUrl, serverKey, body, /* retry */ true);
  return _parsePopulateResponse(res);
}

async function _postPopulate(url, targetUrl, serverKey, body, retry = false, explicitAuthHeader = null) {
  const authHeader = explicitAuthHeader ?? (retry ? await reauthHeaderFor(targetUrl, serverKey) : await fhirAuthHeaderFor(targetUrl, serverKey));
  return fetch(url, {
    method:  'POST',
    headers: {
      'Content-Type': 'application/fhir+json',
      'Accept':        'application/fhir+json',
      ...authHeader,
    },
    body,
    signal: AbortSignal.timeout(30_000),
  });
}

async function _parsePopulateResponse(res) {
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    let detail = text.substring(0, 150);
    try {
      const oo = JSON.parse(text);
      const issue = oo?.issue?.[0];
      // Use only structured OperationOutcome fields — never parse the XHTML
      // narrative (text.div), which is untrusted HTML.
      detail = issue?.diagnostics || issue?.details?.text || detail;
    } catch { /* keep raw text */ }
    const hint = (res.status === 400 || res.status === 404)
      ? ' (This server may not support the SDC $populate operation.)'
      : '';
    throw new Error(`$populate: HTTP ${res.status}${detail ? ' — ' + detail : ''}${hint}`);
  }

  const result = await res.json();

  // Result is a QuestionnaireResponse directly
  if (result.resourceType === 'QuestionnaireResponse') return result;

  // Result is a Parameters resource wrapping a QuestionnaireResponse
  if (result.resourceType === 'Parameters') {
    const param = result.parameter?.find(p =>
      p.name === 'questionnaire-response' || p.name === 'response' || p.name === 'return'
    );
    if (param?.resource?.resourceType === 'QuestionnaireResponse') return param.resource;
    throw new Error(`$populate Parameters response did not contain a QuestionnaireResponse`);
  }

  throw new Error(`$populate returned unexpected resourceType: ${result.resourceType}`);
}
