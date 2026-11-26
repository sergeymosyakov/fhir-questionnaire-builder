// Reads a reference file (see reference-bundle.js): the Questionnaire and the answer sets saved with it.
import { REFERENCE_TAG } from './reference-bundle.js';

/**
 * @param {string|object} input
 * @returns {{ questionnaire: object, responses: object[], timestamp: string|null, complete: boolean }} complete: saved by the check, so a calculation missing from a response means "no result"
 * @throws {Error} saying what is wrong with the file
 */
export function readReference(input) {
  let bundle = input;
  if (typeof input === 'string') {
    try { bundle = JSON.parse(input); } catch (e) { throw new Error(`The reference file is not valid JSON: ${e.message}`, { cause: e }); }
  }
  if (bundle?.resourceType !== 'Bundle') throw new Error(`The reference file must be a FHIR Bundle (it is ${bundle?.resourceType ?? 'not a FHIR resource'}). Save one with “Save reference file” on the check page.`);
  const resources = (Array.isArray(bundle.entry) ? bundle.entry : []).map((e) => e?.resource).filter(Boolean);
  const forms = resources.filter((r) => r.resourceType === 'Questionnaire');
  if (forms.length !== 1) throw new Error(`The reference file must hold exactly one Questionnaire (it holds ${forms.length}).`);
  const responses = resources.filter((r) => r.resourceType === 'QuestionnaireResponse');
  if (!responses.length) throw new Error('The reference file holds no QuestionnaireResponse, so there is nothing to compare with.');
  const complete = (bundle.meta?.tag || []).some((t) => t.code === REFERENCE_TAG.code && t.system === REFERENCE_TAG.system);
  return { questionnaire: forms[0], responses, timestamp: bundle.timestamp ?? null, complete };
}
