// ── StructureDefinition → draft Questionnaire generator ──────────────────────
// Auto-generates a full draft Questionnaire tree from a FHIR StructureDefinition
// snapshot in one step (issue #94) — a starting skeleton, not a finished form.
// Reuses definition-resolver.js's single-element resolution for every leaf, so
// item.definition round-trips back to "Resolve from profile" for manual re-sync.
//
// Known v1 limitations (see issue #94), both reported via `warnings`:
//   - Profile slicing collapses to the base (unsliced) element.
//   - Multi-type elements (e.g. value[x]) map from type[0] only.
import { resolveDefinition } from './definition-resolver.js';

/**
 * @param {object} sd            StructureDefinition (must have snapshot.element[])
 * @param {object} [opts]
 * @param {string} [opts.title]  Questionnaire.title override (default: sd.title/name/type)
 * @returns {{ questionnaire: object, warnings: string[] }}
 */
export function generateQuestionnaireFromSD(sd, opts = {}) {
  if (!sd || sd.resourceType !== 'StructureDefinition') {
    throw new Error('Not a FHIR StructureDefinition');
  }
  const elements = sd.snapshot?.element;
  if (!Array.isArray(elements) || !elements.length) {
    throw new Error('StructureDefinition has no snapshot.element[] to generate from');
  }

  const warnings  = [];
  const rootId    = sd.type;
  const canonical = sd.url || '';

  // Drop the root element itself and profile-excluded (max:'0') elements.
  const usable = elements.filter(el => el.id && el.id !== rootId && el.max !== '0');

  // Slices show up as an extra ':sliceName' path segment (e.g.
  // 'Patient.identifier:mrn') — collapse to the unsliced base, first wins.
  const seen    = new Set();
  const deduped = [];
  for (const el of usable) {
    const baseId = el.id.replace(/:[^.]+/g, '');
    if (baseId !== el.id) warnings.push(`Slice "${el.id}" collapsed to base element "${baseId}"`);
    if (seen.has(baseId)) continue;
    seen.add(baseId);
    deduped.push({ ...el, id: baseId });
  }

  // A base id is a group iff some other base id is a strict dot-descendant of it.
  const idSet = new Set(deduped.map(el => el.id));
  const isGroup = id => {
    const prefix = id + '.';
    for (const other of idSet) if (other !== id && other.startsWith(prefix)) return true;
    return false;
  };

  const parentIdOf = id => id.includes('.') ? id.slice(0, id.lastIndexOf('.')) : rootId;

  const nodesById = new Map();
  for (const el of deduped) {
    if (isGroup(el.id)) {
      nodesById.set(el.id, {
        linkId: el.id, type: 'group', text: el.short || el.label || el.id, item: [],
        _parentId: parentIdOf(el.id),
      });
      continue;
    }
    const resolved = resolveDefinition(sd, `${canonical}#${el.id}`);
    if (!resolved) { warnings.push(`Could not resolve element "${el.id}", skipped`); continue; }
    if ((el.type?.length || 0) > 1) {
      warnings.push(`Element "${el.id}" has ${el.type.length} possible types — used "${el.type[0].code}" only`);
    }
    nodesById.set(el.id, {
      linkId: el.id,
      type: resolved.itemType,
      text: resolved.text || el.id,
      required: resolved.mandatory || undefined,
      repeats: resolved.repeats || undefined,
      maxLength: resolved.maxLength,
      answerValueSet: resolved.answerValueSet,
      definition: `${canonical}#${el.id}`,
      _parentId: parentIdOf(el.id),
    });
  }

  const roots = [];
  for (const node of nodesById.values()) {
    const parent = nodesById.get(node._parentId);
    delete node._parentId;
    for (const k of Object.keys(node)) if (node[k] === undefined) delete node[k];
    (parent ? parent.item : roots).push(node);
  }

  const questionnaire = {
    resourceType: 'Questionnaire',
    status: 'draft',
    title: opts.title || sd.title || sd.name || rootId || 'Generated Questionnaire',
    item: roots,
  };
  return { questionnaire, warnings };
}
