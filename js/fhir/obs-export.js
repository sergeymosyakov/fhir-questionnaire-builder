// ── Observation extraction download ──────────────────────────────────────────
// Builds the current Questionnaire + QuestionnaireResponse, runs SDC
// Observation-based extraction, and downloads the resulting transaction Bundle.
import { buildFHIRObject } from './export.js';
import { buildQR } from './qr-builder.js';
import { extractObservations } from './extract.js';
import { downloadJSON } from './download.js';

import { AppEvents, EventState } from '../events.js';
import { FHIR } from './urls/fhir.js';

const SDC_OBS_PROFILE = FHIR.sdcObservation;

/**
 * Build and download a transaction Bundle of extracted Observations.
 * @param {string} fileName - download file name (e.g. 'phq-9-observations.json').
 * @param {{ subject?, author?, qrId?, addProfile? }} [meta]
 * @returns {object} the generated Bundle (also useful for tests).
 */
export function exportObservations(fileName, meta) {
  const { answerStore } = EventState.get(AppEvents.APP_CONTEXT_READY) || {};
  const fhirQ = buildFHIRObject();
  const qr    = buildQR(fhirQ, answerStore.toValueMap());
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
