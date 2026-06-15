// ── Observation extraction download ──────────────────────────────────────────
// Builds the current Questionnaire + QuestionnaireResponse, runs SDC
// Observation-based extraction, and downloads the resulting transaction Bundle.
import { buildFHIRObject } from './export.js';
import { buildQR } from './qr-builder.js';
import { extractObservations } from './extract.js';
import { downloadJSON } from './download.js';

let _svc = {};
export function configure(svc) { _svc = svc; }

const SDC_OBS_PROFILE = 'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-observation';

/**
 * Build and download a transaction Bundle of extracted Observations.
 * @param {string} fileName - download file name (e.g. 'phq-9-observations.json').
 * @param {{ subject?, author?, qrId?, addProfile? }} [meta]
 * @returns {object} the generated Bundle (also useful for tests).
 */
export function exportObservations(fileName, meta) {
  const { values } = _svc;
  const fhirQ = buildFHIRObject();
  const qr    = buildQR(fhirQ, values);
  qr.status   = 'completed';
  qr.authored = new Date().toISOString();
  if (meta && meta.qrId)    qr.id      = meta.qrId;
  if (meta && meta.subject) qr.subject = { reference: meta.subject };
  if (meta && meta.author)  qr.author  = { reference: meta.author };

  const addProfile = meta?.addProfile !== false;
  const obsProfile = addProfile ? [SDC_OBS_PROFILE] : [];
  const bundle = extractObservations(qr, fhirQ, { obsProfile });
  downloadJSON(bundle, fileName || 'observations.json');
  return bundle;
}
