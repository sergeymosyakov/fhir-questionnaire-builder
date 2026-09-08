// ── StructureDefinition → draft Questionnaire generator ──────────────────────
// Auto-generates a full draft Questionnaire tree from a FHIR StructureDefinition
// snapshot in one step (issue #94) — a starting skeleton, not a finished form.
// Reuses definition-resolver.js's single-element resolution for every leaf, so
// item.definition round-trips back to "Resolve from profile" for manual re-sync.
// itemTypeToFHIRType converts the resolver's internal itemType to a valid FHIR
// Questionnaire.item.type — the resolver's value alone is NOT wire-format-safe.
//
// Slices generate their own item (never collapsed); multi-type (value[x])
// elements explode into one item per type, named after FHIR's own convention.
import { resolveDefinition, fhirDatatypeToItemType } from './definition-resolver.js';
import { itemTypeToFHIRType } from './export.js';

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
  // Slices (':sliceName' id suffix) are kept as their own item — each slice
  // constrains the base element differently and deserves its own question.
  const usable = elements.filter(el => el.id && el.id !== rootId && el.max !== '0');

  // A base id is a group iff some other id is a strict dot-descendant of it.
  const idSet = new Set(usable.map(el => el.id));
  const isGroup = id => {
    const prefix = id + '.';
    for (const other of idSet) if (other !== id && other.startsWith(prefix)) return true;
    return false;
  };

  const parentIdOf = id => id.includes('.') ? id.slice(0, id.lastIndexOf('.')) : rootId;

  // value[x]-style multi-type elements explode into one item per type, named
  // after FHIR's own convention (deceased[x] + boolean -> deceasedBoolean).
  // All variants are optional — Questionnaire has no "exactly one of N" construct.
  const explodeMultiType = (el, resolved) => {
    warnings.push(`Element "${el.id}" has ${el.type.length} possible types — generated as ${el.type.length} separate optional questions (only one should be filled in)`);
    const base = el.id.replace(/\[x]$/i, '');
    return el.type.map(({ code }) => ({
      linkId: `${base}${code.charAt(0).toUpperCase()}${code.slice(1)}`,
      type: itemTypeToFHIRType(fhirDatatypeToItemType(code)),
      text: `${resolved.text || el.id} (${code})`,
      repeats: resolved.repeats || undefined,
      definition: `${canonical}#${el.id}`,
      _parentId: parentIdOf(el.id),
    }));
  };

  const nodesById = new Map();
  for (const el of usable) {
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
      for (const variant of explodeMultiType(el, resolved)) nodesById.set(variant.linkId, variant);
      continue;
    }

    nodesById.set(el.id, {
      linkId: el.id,
      type: itemTypeToFHIRType(resolved.itemType),
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
