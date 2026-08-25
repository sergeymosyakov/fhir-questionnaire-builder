// ── SDC StructureMap-based extraction ────────────────────────────────────────
// Executes the Questionnaire's sdc-questionnaire-targetStructureMap against a
// QuestionnaireResponse via fhir-structuremap-js, as an alternative to the
// item.definition-based extraction in sdc-definition-extract.js.
//
// SDC spec: https://hl7.org/fhir/uv/sdc/extraction.html#structuremap-based-extraction
//
// The referenced StructureMap must be a `#id` local reference resolving to a
// Questionnaire.contained[] resource (added via the Contained Resources panel) —
// there is no server to fetch an external canonical URL from.
import { StructureMapDocument } from '../../lib/fhir-structuremap-js.esm.js';
import { FHIR } from './urls/fhir.js';
import { createStructureMapEngine } from './structuremap-engine.js';

function resolveContainedStructureMap(contained, canonical) {
  if (!canonical || !canonical.startsWith('#')) return null;
  const id = canonical.slice(1);
  return (contained || []).find(r => r.resourceType === 'StructureMap' && r.id === id) || null;
}

/**
 * Run the questionnaire's targetStructureMap against a QuestionnaireResponse.
 * @param {object} questJson FHIR Questionnaire resource
 * @param {object} qr        FHIR QuestionnaireResponse resource
 * @param {{engine?: import('fhir-structuremap-js').StructureMapEngine}} [opts] — inject an engine (e.g. in tests)
 * @returns {{ bundle: object|null, count: number, warnings: string[] }}
 */
export function structureMapExtract(questJson, qr, { engine = createStructureMapEngine() } = {}) {
  if (!qr || qr.resourceType !== 'QuestionnaireResponse') {
    return { bundle: null, count: 0, warnings: ['No QuestionnaireResponse provided.'] };
  }

  const ext = (questJson.extension || []).find(e => e.url === FHIR.targetStructureMap);
  const canonical = ext?.valueCanonical;
  if (!canonical) {
    return { bundle: null, count: 0, warnings: [
      'Questionnaire has no sdc-questionnaire-targetStructureMap extension. Set it in Properties.',
    ] };
  }

  const sm = resolveContainedStructureMap(questJson.contained, canonical);
  if (!sm) {
    return { bundle: null, count: 0, warnings: [
      `Referenced StructureMap "${canonical}" was not found in contained[]. Add it via the Contained Resources panel.`,
    ] };
  }

  let doc;
  try {
    doc = StructureMapDocument.fromJSON(sm);
  } catch (e) {
    return { bundle: null, count: 0, warnings: [`Could not parse StructureMap: ${e.message}`] };
  }

  const group = doc.defaultGroup;
  if (!group) {
    return { bundle: null, count: 0, warnings: ['StructureMap has no usable group.'] };
  }

  const inputs = {};
  for (const input of group.input) inputs[input.name] = input.mode === 'source' ? qr : {};

  let result;
  try {
    result = engine.run(doc, inputs);
  } catch (e) {
    return { bundle: null, count: 0, warnings: [`StructureMap execution failed: ${e.message}`] };
  }

  const resources = Object.values(result).filter(r => r && typeof r === 'object' && Object.keys(r).length);
  if (!resources.length) {
    return { bundle: null, count: 0, warnings: ['StructureMap produced no output.'] };
  }

  const bundle = {
    resourceType: 'Bundle',
    type: 'transaction',
    entry: resources.map((r, i) => ({
      fullUrl: `urn:uuid:extracted-${i + 1}`,
      resource: r,
      request: { method: 'POST', url: r.resourceType || 'Basic' },
    })),
  };

  return { bundle, count: resources.length, warnings: [] };
}
