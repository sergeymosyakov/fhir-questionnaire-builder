// Download current answers as a FHIR R4 QuestionnaireResponse JSON
import { values } from '../state.js';
import { buildFHIRObject } from './export.js';
import { buildQR } from './qr-builder.js';
import { downloadJSON } from './download.js';

/**
 * Build and download a QuestionnaireResponse JSON.
 * @param {string} fileName  - download file name (e.g. 'phq-9-response.json')
 * @param {{ status?, subject?, author?, id?, language?, metaVersionId?, metaSource?, metaProfile?, metaTag?, metaSecurity? }} [meta]
 */
export function exportQR(fileName, meta) {
  const fhirQ = buildFHIRObject();
  const qr    = buildQR(fhirQ, values);
  qr.status   = (meta && meta.status)  || 'in-progress';
  if (meta && meta.id)      qr.id       = meta.id;
  if (meta && meta.language) qr.language = meta.language;
  if (meta && meta.subject) qr.subject  = { reference: meta.subject };
  if (meta && meta.author)  qr.author   = { reference: meta.author  };
  qr.authored = new Date().toISOString();

  // meta block
  const metaBlock = {};
  metaBlock.lastUpdated = new Date().toISOString();
  if (meta?.metaVersionId) metaBlock.versionId = meta.metaVersionId;
  if (meta?.metaSource)    metaBlock.source     = meta.metaSource;
  if (meta?.metaProfile?.length)  metaBlock.profile  = meta.metaProfile.filter(u => u.trim());
  if (meta?.metaTag?.length)      metaBlock.tag      = meta.metaTag.filter(c => c.code?.trim());
  if (meta?.metaSecurity?.length) metaBlock.security = meta.metaSecurity.filter(c => c.code?.trim());
  qr.meta = metaBlock;

  downloadJSON(qr, fileName || 'questionnaire-response.json');
}
