// Download current answers as a FHIR R4 QuestionnaireResponse JSON
import { values } from '../state.js';
import { buildFHIRObject } from './export.js';
import { buildQR } from './qr-builder.js';

/**
 * Build and download a QuestionnaireResponse JSON.
 * @param {string} fileName  - download file name (e.g. 'phq-9-response.json')
 * @param {{ status?: string, subject?: string, author?: string }} [meta]
 */
export function exportQR(fileName, meta) {
  const fhirQ = buildFHIRObject();
  const qr    = buildQR(fhirQ, values);
  qr.status   = (meta && meta.status)  || 'in-progress';
  if (meta && meta.subject) qr.subject = { reference: meta.subject };
  if (meta && meta.author)  qr.author  = { reference: meta.author  };
  qr.authored = new Date().toISOString();
  const blob  = new Blob([JSON.stringify(qr, null, 2)], { type: 'application/json' });
  const a     = document.createElement('a');
  a.href      = URL.createObjectURL(blob);
  a.download  = fileName || 'questionnaire-response.json';
  a.click();
  URL.revokeObjectURL(a.href);
}
