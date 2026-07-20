// ── item.definition → StructureDefinition resolver ───────────────────────────
// Pure, client-side resolution of a Questionnaire `item.definition` canonical
// URL against a supplied StructureDefinition. No server required — the profile
// is provided by the caller (uploaded file or a fetched canonical).
//
// A definition URL has the form:
//   https://example.org/StructureDefinition/Patient#Patient.name.family
//   └────────────── canonical ──────────────┘ └──── elementId ────┘
//
// Public API:
//   parseDefinitionUrl(definition)        → { canonical, elementId } | null
//   findElement(structureDefinition, id)  → ElementDefinition | null
//   fhirDatatypeToItemType(code)          → internal itemType string
//   resolveDefinition(sd, definition)     → normalized element info | null
// ─────────────────────────────────────────────────────────────────────────────
import { fhirTypeToItemType } from './import-helpers.js';

// FHIR datatype (StructureDefinition element.type[].code) → Questionnaire
// item.type. The result is then normalised to an internal node itemType via
// fhirTypeToItemType (e.g. 'choice' → 'select', 'boolean' → 'checkbox').
const DATATYPE_TO_Q_TYPE = {
  boolean:         'boolean',
  integer:         'integer',
  positiveInt:     'integer',
  unsignedInt:     'integer',
  decimal:         'decimal',
  Quantity:        'quantity',
  SimpleQuantity:  'quantity',
  Age:             'quantity',
  Duration:        'quantity',
  Count:           'quantity',
  Distance:        'quantity',
  Money:           'quantity',
  code:            'choice',
  Coding:          'choice',
  CodeableConcept: 'choice',
  date:            'date',
  dateTime:        'dateTime',
  instant:         'dateTime',
  time:            'time',
  uri:             'url',
  url:             'url',
  canonical:       'url',
  oid:             'url',
  uuid:            'url',
  Attachment:      'attachment',
  Reference:       'reference',
  string:          'string',
  markdown:        'string',
  id:              'string',
  base64Binary:    'string',
};

/**
 * Split a definition URL into its canonical StructureDefinition URL and the
 * element id fragment (after `#`). Returns null for empty input.
 * @param {string} definition
 * @returns {{canonical: string, elementId: string} | null}
 */
export function parseDefinitionUrl(definition) {
  if (!definition || typeof definition !== 'string') return null;
  const hashIdx = definition.indexOf('#');
  if (hashIdx === -1) return { canonical: definition, elementId: '' };
  return {
    canonical: definition.slice(0, hashIdx),
    elementId: definition.slice(hashIdx + 1),
  };
}

/**
 * Map a FHIR datatype code to an internal node itemType.
 * @param {string} code
 * @returns {string} internal itemType (defaults to 'text')
 */
export function fhirDatatypeToItemType(code) {
  const qType = DATATYPE_TO_Q_TYPE[code] || 'string';
  return fhirTypeToItemType(qType);
}

/**
 * Find an ElementDefinition in a StructureDefinition by id or path.
 * Snapshot is preferred over differential.
 * @param {object} sd         StructureDefinition
 * @param {string} elementId  e.g. 'Patient.name.family'
 * @returns {object|null}
 */
export function findElement(sd, elementId) {
  if (!sd || !elementId) return null;
  const lists = [sd.snapshot?.element, sd.differential?.element];
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    const byId = list.find(e => e.id === elementId);
    if (byId) return byId;
    const byPath = list.find(e => e.path === elementId);
    if (byPath) return byPath;
  }
  return null;
}

/**
 * Resolve a definition URL against a StructureDefinition into normalized item
 * fields. Returns null when the element cannot be located.
 * @param {object} sd          StructureDefinition
 * @param {string} definition  item.definition canonical URL (with `#element`)
 * @returns {object|null}
 */
export function resolveDefinition(sd, definition) {
  const parsed = parseDefinitionUrl(definition);
  if (!parsed || !parsed.elementId) return null;
  const el = findElement(sd, parsed.elementId);
  if (!el) return null;

  const typeCode = el.type?.[0]?.code || '';
  const itemType = typeCode ? fhirDatatypeToItemType(typeCode) : undefined;

  const text = el.short
    || el.label
    || (typeof el.definition === 'string' ? el.definition.replace(/\s+/g, ' ').trim() : '')
    || '';

  const min = typeof el.min === 'number' ? el.min : undefined;
  const max = el.max;
  const mandatory = min === undefined ? undefined : min >= 1;
  const repeats = max === '*' || (typeof max === 'string' && /^\d+$/.test(max) && Number(max) > 1);
  const maxLength = typeof el.maxLength === 'number' ? el.maxLength : undefined;
  const answerValueSet = el.binding?.valueSet || undefined;

  return {
    elementId: parsed.elementId,
    canonical: parsed.canonical,
    fhirType: typeCode || undefined,
    itemType,
    text: text || undefined,
    mandatory,
    repeats,
    maxLength,
    answerValueSet,
    min,
    max,
  };
}
