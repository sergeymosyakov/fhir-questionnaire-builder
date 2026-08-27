// ── SDC CQL-driven initialExpression evaluation ───────────────────────────────
// Resolves sdc-questionnaire-initialExpression fields with language text/cql-identifier:
// cqf-library (Questionnaire root) -> #contained Library -> application/elm+json content
// -> run via cql-engine.js -> map each CQL `define` result back onto its node.
//
// SDC spec: https://hl7.org/fhir/uv/sdc/expressions.html#initialExpression
//
// v1 scope: only a `#contained` Library is supported (self-contained, offline,
// deterministic). An external absolute canonical Library URL (e.g. a live FHIR
// server) is a documented follow-up gap (issue #70), not silently guessed at.
import { FHIR } from './urls/fhir.js';
import { runCqlLibrary } from './cql-engine.js';

function collectCqlInitialNodes(nodes, out = []) {
  for (const n of nodes) {
    if (n._initialExprLanguage === 'text/cql-identifier' && n._initialExpr) out.push(n);
    if (n.children?.length) collectCqlInitialNodes(n.children, out);
  }
  return out;
}

function resolveContainedLibrary(contained, canonical) {
  const ref = (canonical || '').split('|')[0]; // strip |version
  if (!ref.startsWith('#')) return null; // external canonical — not supported in v1
  const id = ref.slice(1);
  return (contained || []).find(r => r.resourceType === 'Library' && r.id === id) || null;
}

function decodeBase64Json(data) {
  const bytes = Uint8Array.from(atob(data), c => c.charCodeAt(0));
  return JSON.parse(new TextDecoder('utf-8').decode(bytes));
}

function extractElmJson(libraryResource) {
  const content = (libraryResource.content || []).find(c => c.contentType === 'application/elm+json');
  if (!content?.data) return null;
  try {
    return decodeBase64Json(content.data);
  } catch (_e) {
    return null;
  }
}

// Synthesize a minimal Patient from the preview's %age patient-preset variable —
// this app has no real "current Patient resource", only scalar %age/%gender/…
// variables (js/ui/patient-panel.js). Deliberate v1 bridge, not a data-model change.
function synthesizePatientFromAge(age) {
  if (typeof age !== 'number' || !Number.isFinite(age)) return null;
  const today = new Date();
  const birth = new Date(Date.UTC(today.getUTCFullYear() - age, today.getUTCMonth(), today.getUTCDate()));
  return { resourceType: 'Patient', id: 'preview-patient', birthDate: birth.toISOString().slice(0, 10) };
}

/** Coerce a raw CQL result (already a typed JS value, unlike FHIRPath's array results) to a form value. */
function coerceCqlResult(node, result) {
  if (result === undefined || result === null) return '';
  if (node.itemType === 'checkbox') return result === true;
  return String(result);
}

/**
 * Resolve all text/cql-identifier initialExpression nodes in `tree` against the
 * questionnaire's cqf-library, returning { [nodeId]: value }. Returns {} (no-op,
 * no library fetch/dynamic import) when the tree has no CQL-language nodes.
 */
export async function resolveCqlInitialValues(questJson, tree, envVars = {}) {
  const cqlNodes = collectCqlInitialNodes(tree);
  if (!cqlNodes.length) return {};

  const libExt = (questJson.extension || []).find(e => e.url === FHIR.cqfLibrary);
  if (!libExt?.valueCanonical) return {};
  const libraryResource = resolveContainedLibrary(questJson.contained, libExt.valueCanonical);
  if (!libraryResource) return {};
  const elmJson = extractElmJson(libraryResource);
  if (!elmJson) return {};
  const patient = synthesizePatientFromAge(envVars.age);
  if (!patient) return {};

  let cqlResults;
  try {
    cqlResults = await runCqlLibrary(elmJson, patient);
  } catch (_e) {
    return {};
  }

  const values = {};
  for (const node of cqlNodes) {
    if (node._initialExpr in cqlResults) values[node.id] = coerceCqlResult(node, cqlResults[node._initialExpr]);
  }
  return values;
}
