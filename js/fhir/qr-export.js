// Download current answers as a FHIR R4 QuestionnaireResponse JSON
import { values } from '../state.js';
import { buildFHIRObject } from './export.js';
import { buildQR } from './qr-builder.js';

export function exportQR(fileName) {
  const fhirQ = buildFHIRObject();
  const qr    = buildQR(fhirQ, values);
  qr.authored = new Date().toISOString();
  const blob  = new Blob([JSON.stringify(qr, null, 2)], { type: 'application/json' });
  const a     = document.createElement('a');
  a.href      = URL.createObjectURL(blob);
  a.download  = fileName || 'questionnaire-response.json';
  a.click();
  URL.revokeObjectURL(a.href);
}
