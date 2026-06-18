// ── SDC $populate ─────────────────────────────────────────────────────────────
// Sends a Questionnaire to a FHIR server's $populate operation with a patient
// reference and returns the resulting QuestionnaireResponse.
//
// SDC spec: https://hl7.org/fhir/uv/sdc/OperationDefinition-Questionnaire-populate.html

import { proxiedUrl } from './fhir-search.js';

/**
 * Populate a QuestionnaireResponse from a FHIR server.
 *
 * @param {string}  fhirBase   - Base FHIR server URL (e.g. https://hapi.fhir.org/baseR4)
 * @param {object}  questJson  - FHIR Questionnaire resource
 * @param {string}  patientRef - Patient reference string (e.g. 'Patient/123')
 * @returns {Promise<object>} FHIR QuestionnaireResponse resource
 */
export async function populateFromServer(fhirBase, questJson, patientRef) {
  const base      = fhirBase.replace(/\/$/, '');
  const targetUrl = `${base}/Questionnaire/$populate`;
  const url       = proxiedUrl(targetUrl);

  const body = JSON.stringify({
    resourceType: 'Parameters',
    parameter: [
      { name: 'questionnaire',   resource: questJson },
      { name: 'subject', valueReference: { reference: patientRef } },
    ],
  });

  const res = await fetch(url, {
    method:  'POST',
    headers: {
      'Content-Type': 'application/fhir+json',
      'Accept':        'application/fhir+json',
    },
    body,
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    // Try to extract OperationOutcome diagnostics
    let detail = '';
    try {
      const oo = JSON.parse(text);
      const issue = oo?.issue?.[0];
      detail = issue?.diagnostics || issue?.details?.text || oo?.text?.div?.replace(/<[^>]+>/g, '').trim().substring(0, 120) || '';
    } catch {
      detail = text.substring(0, 150);
    }
    const hint = res.status === 400 || res.status === 404
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
