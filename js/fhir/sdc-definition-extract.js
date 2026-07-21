import { FHIR } from './urls/fhir.js';
// ── SDC Definition-based extraction ──────────────────────────────────────────
// Pure transformation: Questionnaire + QuestionnaireResponse → Bundle of FHIR
// resources constructed from item.definition mappings.
//
// SDC spec: https://hl7.org/fhir/uv/sdc/extraction.html#definition-based-extraction
//
// Scope (MVP):
// • Scans for group items annotated with sdc-questionnaire-definitionExtract.
// • Each annotated group defines one resource instance of the type encoded in
//   item.definition (or child item definitions).
// • Child items with item.definition = '...StructureDefinition/{Type}#{path}'
//   map their QR answers to element paths in the target resource.
// • Supports: Patient, Condition, Observation, Encounter, Practitioner,
//   Medication, MedicationRequest, Procedure, AllergyIntolerance and any other
//   type with simple (non-nested) element paths.
// • Nested paths like 'name.family' are set as deep properties.
// • A transaction Bundle is returned; each resource gets a temporary id.

const DEFINITION_EXTRACT_URL =
  FHIR.definitionExtract;

const DEFINITION_EXTRACT_CONTEXT_URL =
  FHIR.definitionExtractContext;

/**
 * Check if a questionnaire item has the definitionExtract extension.
 */
function hasExtractExtension(qItem) {
  return (qItem.extension || []).some(e =>
    e.url === DEFINITION_EXTRACT_URL || e.url === DEFINITION_EXTRACT_CONTEXT_URL
  );
}

/**
 * Parse a definition URL into { resourceType, path }.
 * Example: 'http://hl7.org/fhir/StructureDefinition/Patient#Patient.name.family'
 *   → { resourceType: 'Patient', path: 'name.family' }
 */
function parseDefinition(definition) {
  if (!definition) return null;
  const hashIdx = definition.indexOf('#');
  if (hashIdx === -1) return null;
  const fragment = definition.slice(hashIdx + 1); // 'Patient.name.family'
  const dotIdx = fragment.indexOf('.');
  if (dotIdx === -1) {
    return { resourceType: fragment, path: '' };
  }
  const resourceType = fragment.slice(0, dotIdx);
  const path         = fragment.slice(dotIdx + 1);  // 'name.family'
  return { resourceType, path };
}

/**
 * Convert a QR answer object to a raw FHIR value.
 */
function answerToValue(answer) {
  if (answer.valueString    !== undefined) return answer.valueString;
  if (answer.valueInteger   !== undefined) return answer.valueInteger;
  if (answer.valueDecimal   !== undefined) return answer.valueDecimal;
  if (answer.valueBoolean   !== undefined) return answer.valueBoolean;
  if (answer.valueDate      !== undefined) return answer.valueDate;
  if (answer.valueDateTime  !== undefined) return answer.valueDateTime;
  if (answer.valueCoding    !== undefined) return answer.valueCoding;
  if (answer.valueQuantity  !== undefined) return answer.valueQuantity;
  if (answer.valueReference !== undefined) return answer.valueReference;
  return null;
}

/**
 * Set a value at a dot-notation path in an object.
 * 'name.family' → obj.name.family = value
 * 'name[0].family' → obj.name = [{ family: value }]
 */
function setPath(obj, path, value) {
  if (!path) return;
  const parts = path.split('.');
  // Guard against prototype pollution from attacker-controlled item.definition paths.
  const isUnsafeKey = (k) => k === '__proto__' || k === 'constructor' || k === 'prototype';
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    if (isUnsafeKey(key)) return;
    if (!(key in cur)) cur[key] = {};
    // If existing value is array, use first element
    if (Array.isArray(cur[key])) {
      if (cur[key].length === 0) cur[key].push({});
      cur = cur[key][0];
    } else {
      cur = cur[key];
    }
  }
  const lastKey = parts[parts.length - 1];
  if (isUnsafeKey(lastKey)) return;
  // If path ends in array-like field (name, identifier, address, telecom), wrap in array
  const ARRAY_FIELDS = new Set(['name','identifier','address','telecom','code','coding',
    'category','reasonCode','note','performer','contained','extension','modifierExtension']);
  if (ARRAY_FIELDS.has(lastKey) && !Array.isArray(cur[lastKey])) {
    // If value is already an object, wrap; if existing has value, push
    cur[lastKey] = [value];
  } else if (Array.isArray(cur[lastKey])) {
    cur[lastKey].push(value);
  } else if (cur[lastKey] !== undefined) {
    // Repeating field value on a non-array leaf → promote the scalar to an array.
    cur[lastKey] = [cur[lastKey], value];
  } else {
    cur[lastKey] = value;
  }
}

/**
 * Recursively collect every QR item matching a linkId across the whole tree.
 * Repeating groups appear as multiple items with the same linkId.
 * @returns {object[]} matching QR items (each a group instance)
 */
function findGroupInstances(qrItems, linkId, out = []) {
  for (const it of (qrItems || [])) {
    if (it.linkId === linkId) out.push(it);
    if (it.item) findGroupInstances(it.item, linkId, out);
  }
  return out;
}

/**
 * Build a QR item lookup: linkId → answer[].
 */
function buildQRIndex(qrItems, out = {}) {
  for (const item of (qrItems || [])) {
    out[item.linkId] = item.answer || [];
    buildQRIndex(item.item, out);
  }
  return out;
}

/**
 * Walk Questionnaire items and collect extraction groups.
 * A group with definitionExtract = extraction context. Repeating groups yield
 * one entry per QR instance (so a repeating group extracts multiple resources).
 * Returns array of { resourceType, fields: [{linkId, path, answers[]}] }
 */
function collectGroups(qItems, qr, parentResourceType = null) {
  const groups = [];

  for (const qItem of (qItems || [])) {
    const isGroup = qItem.type === 'group';
    const isExtractGroup = isGroup && hasExtractExtension(qItem);

    // Determine resource type for this scope
    let localType = parentResourceType;
    if (qItem.definition) {
      const parsed = parseDefinition(qItem.definition);
      if (parsed?.resourceType) localType = parsed.resourceType;
    }

    if (isExtractGroup) {
      // This group defines a new resource instance (one per QR occurrence)
      const resourceType = localType || _inferResourceType(qItem);
      if (!resourceType) {
        // recurse into children with parent context
        groups.push(...collectGroups(qItem.item, qr, localType));
        continue;
      }

      // Each QR occurrence of this group (repeats) → its own resource, scoped
      // to that instance's answers. Falls back to the whole QR when the group
      // linkId is not present (flat / implicit responses).
      const instances = findGroupInstances(qr.item, qItem.linkId);
      const scopes = instances.length ? instances.map(i => i.item) : [qr.item];
      for (const scopeItems of scopes) {
        const qrIndex = buildQRIndex(scopeItems);
        const fields = [];
        _collectFields(qItem.item, qrIndex, resourceType, fields);
        if (fields.length > 0) {
          groups.push({ resourceType, fields, linkId: qItem.linkId });
        }
      }
    } else {
      // Not an extract group — recurse
      groups.push(...collectGroups(qItem.item, qr, localType));
    }
  }

  return groups;
}

/**
 * Infer resource type from first child item's definition.
 */
function _inferResourceType(groupItem) {
  for (const child of (groupItem.item || [])) {
    if (child.definition) {
      const parsed = parseDefinition(child.definition);
      if (parsed?.resourceType) return parsed.resourceType;
    }
  }
  return null;
}

/**
 * Recursively collect {path, answers} from items within an extraction group.
 */
function _collectFields(qItems, qrIndex, resourceType, out) {
  for (const qItem of (qItems || [])) {
    if (qItem.definition) {
      const parsed = parseDefinition(qItem.definition);
      if (parsed && parsed.resourceType === resourceType && parsed.path) {
        const answers = qrIndex[qItem.linkId] || [];
        if (answers.length > 0) {
          out.push({ linkId: qItem.linkId, path: parsed.path, answers });
        }
      }
    }
    // Recurse into sub-groups (non-extract)
    if (qItem.item && !hasExtractExtension(qItem)) {
      _collectFields(qItem.item, qrIndex, resourceType, out);
    }
  }
}

/**
 * Build a FHIR resource from a group definition.
 */
function buildResource(group, index) {
  const resource = {
    resourceType: group.resourceType,
    id: `extracted-${group.resourceType.toLowerCase()}-${index + 1}`,
    meta: {
      profile: [`${FHIR.sd}/${group.resourceType}`],
    },
  };

  for (const field of group.fields) {
    for (const answer of field.answers) {
      const value = answerToValue(answer);
      if (value != null) {
        setPath(resource, field.path, value);
      }
    }
  }

  return resource;
}

/**
 * Main extraction function.
 *
 * @param {object} questJson - FHIR Questionnaire resource
 * @param {object} qr        - FHIR QuestionnaireResponse resource
 * @returns {{ bundle: object, count: number, warnings: string[] }}
 */
export function definitionExtract(questJson, qr) {
  const warnings = [];

  if (!qr || qr.resourceType !== 'QuestionnaireResponse') {
    return { bundle: null, count: 0, warnings: ['No QuestionnaireResponse provided.'] };
  }

  const groups = collectGroups(questJson.item, qr);

  if (groups.length === 0) {
    warnings.push(
      'No extraction groups found. Add the sdc-questionnaire-definitionExtract ' +
      'extension to a group item and set item.definition on child items.'
    );
    return { bundle: null, count: 0, warnings };
  }

  const resources = groups.map((g, i) => buildResource(g, i));
  const bundle = {
    resourceType: 'Bundle',
    type: 'transaction',
    entry: resources.map(r => ({
      fullUrl: `urn:uuid:${r.id}`,
      resource: r,
      request: { method: 'POST', url: r.resourceType },
    })),
  };

  return { bundle, count: resources.length, warnings };
}
