// ── SDC StructureMap-based population ────────────────────────────────────────
// Executes the Questionnaire's sdc-questionnaire-sourceStructureMap against a
// resource fetched from the FHIR server (e.g. Patient), producing a
// QuestionnaireResponse to pre-fill answers — the inverse of
// sdc-structuremap-extract.js's targetStructureMap direction.
//
// SDC spec: https://hl7.org/fhir/uv/sdc/extraction.html#structuremap-based-population
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
 * Run the questionnaire's sourceStructureMap against a resource fetched from
 * the FHIR server, producing a QuestionnaireResponse.
 * @param {object} questJson      FHIR Questionnaire resource
 * @param {object} sourceResource FHIR resource fetched from the server (e.g. Patient)
 * @param {{engine?: import('fhir-structuremap-js').StructureMapEngine}} [opts] — inject an engine (e.g. in tests)
 * @returns {{ qr: object|null, warnings: string[] }}
 */
export function structureMapPopulate(questJson, sourceResource, { engine = createStructureMapEngine() } = {}) {
  if (!sourceResource || typeof sourceResource !== 'object') {
    return { qr: null, warnings: ['No source resource provided.'] };
  }

  const ext = (questJson.extension || []).find(e => e.url === FHIR.sourceStructureMap);
  const canonical = ext?.valueCanonical;
  if (!canonical) {
    return { qr: null, warnings: [
      'Questionnaire has no sdc-questionnaire-sourceStructureMap extension. Set it in Properties.',
    ] };
  }

  const sm = resolveContainedStructureMap(questJson.contained, canonical);
  if (!sm) {
    return { qr: null, warnings: [
      `Referenced StructureMap "${canonical}" was not found in contained[]. Add it via the Contained Resources panel.`,
    ] };
  }

  let doc;
  try {
    doc = StructureMapDocument.fromJSON(sm);
  } catch (e) {
    return { qr: null, warnings: [`Could not parse StructureMap: ${e.message}`] };
  }

  const group = doc.defaultGroup;
  if (!group) {
    return { qr: null, warnings: ['StructureMap has no usable group.'] };
  }

  const inputs = {};
  let targetName = null;
  for (const input of group.input) {
    // Target starts with item: [] pre-seeded so per-item rules can append
    // distinct BackboneElement entries (see docs/FHIR-MAPPING.md StructureMap
    // population notes for why item[] must be created via transform "create",
    // not left to StructureMap's identity-shorthand auto-create).
    if (input.mode === 'source') inputs[input.name] = sourceResource;
    else { inputs[input.name] = { item: [] }; targetName = targetName || input.name; }
  }

  let result;
  try {
    result = engine.run(doc, inputs);
  } catch (e) {
    return { qr: null, warnings: [`StructureMap execution failed: ${e.message}`] };
  }

  const qr = targetName ? result[targetName] : null;
  if (!qr || typeof qr !== 'object' || !Object.keys(qr).length) {
    return { qr: null, warnings: ['StructureMap produced no output.'] };
  }
  if (!qr.resourceType) qr.resourceType = 'QuestionnaireResponse';

  return { qr, warnings: [] };
}
