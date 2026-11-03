// ── Unit tests: js/fhir/sdc-definition-extract.js ────────────────────────────
// definitionExtract() is a pure FHIR transformation — no DOM, no state.

import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import fhirpath from 'fhirpath';
import { definitionExtract as extract } from '../js/fhir/sdc-definition-extract.js';
import { FHIR } from '../js/fhir/urls/fhir.js';
import { LOINC_URL } from '../js/fhir/urls/loinc.js';

const require = createRequire(import.meta.url);
const model = require('fhirpath/fhir-context/r4');
const evaluate = (expression, context, qr) => fhirpath.evaluate(context, { base: 'QuestionnaireResponse.item', expression }, { resource: qr, context }, model);
const definitionExtract = (q, qr, opts = {}) => extract(q, qr, { model, evaluate, ...opts });

const EXTRACT_URL     = FHIR.definitionExtract;
const EXTRACT_CTX_URL = FHIR.definitionExtractContext;
const SD_BASE         = FHIR.sd + '/';

function makeQ(items)  { return { resourceType: 'Questionnaire', item: items }; }
function makeQR(items) { return { resourceType: 'QuestionnaireResponse', item: items }; }

// ── Early-return paths ────────────────────────────────────────────────────────

describe('definitionExtract — guard paths', () => {
  it('returns warning when QR is null', () => {
    const { bundle, count, warnings } = definitionExtract(makeQ([]), null);
    expect(bundle).toBeNull();
    expect(count).toBe(0);
    expect(warnings[0]).toContain('No QuestionnaireResponse');
  });

  it('returns warning when resourceType is not QuestionnaireResponse', () => {
    const { bundle, count, warnings } = definitionExtract(makeQ([]), { resourceType: 'Patient' });
    expect(bundle).toBeNull();
    expect(count).toBe(0);
    expect(warnings[0]).toContain('No QuestionnaireResponse');
  });

  it('returns warning when no extraction groups found', () => {
    const q  = makeQ([{ linkId: 'g1', type: 'group', item: [] }]);
    const qr = makeQR([]);
    const { bundle, count, warnings } = definitionExtract(q, qr);
    expect(bundle).toBeNull();
    expect(count).toBe(0);
    expect(warnings).toContainEqual(expect.stringContaining('No extraction groups'));
  });
});

// ── Happy path: simple Patient extraction ─────────────────────────────────────

describe('definitionExtract — Patient resource', () => {
  const q = makeQ([{
    linkId: 'patient-g',
    type: 'group',
    definition: `${SD_BASE}Patient#Patient`,
    extension: [{ url: EXTRACT_URL }],
    item: [
      { linkId: 'family',  type: 'string', definition: `${SD_BASE}Patient#Patient.name.family` },
      { linkId: 'birthdt', type: 'date',   definition: `${SD_BASE}Patient#Patient.birthDate` },
    ],
  }]);

  const qr = makeQR([{
    linkId: 'patient-g',
    item: [
      { linkId: 'family',  answer: [{ valueString: 'Doe' }] },
      { linkId: 'birthdt', answer: [{ valueDate: '1990-05-15' }] },
    ],
  }]);

  it('returns a transaction Bundle with one Patient', () => {
    const { bundle, count, warnings } = definitionExtract(q, qr);
    expect(warnings).toHaveLength(0);
    expect(count).toBe(1);
    expect(bundle.resourceType).toBe('Bundle');
    expect(bundle.type).toBe('transaction');
    expect(bundle.entry).toHaveLength(1);
  });

  it('resource has the expected type and no invented id or profile', () => {
    const { bundle } = definitionExtract(q, qr);
    const r = bundle.entry[0].resource;
    expect(r.resourceType).toBe('Patient');
    expect(r.id).toBeUndefined();
    expect(r.meta).toBeUndefined();
  });

  it('sets nested name.family correctly', () => {
    const { bundle } = definitionExtract(q, qr);
    const r = bundle.entry[0].resource;
    expect(r.name).toEqual([{ family: 'Doe' }]);
  });

  it('sets birthDate correctly', () => {
    const { bundle } = definitionExtract(q, qr);
    expect(bundle.entry[0].resource.birthDate).toBe('1990-05-15');
  });

  it('entry has correct fullUrl and request', () => {
    const { bundle } = definitionExtract(q, qr);
    const entry = bundle.entry[0];
    expect(entry.fullUrl).toMatch(/^urn:uuid:/);
    expect(entry.request.method).toBe('POST');
    expect(entry.request.url).toBe('Patient');
  });
});

// ── definitionExtractContext URL ──────────────────────────────────────────────

describe('definitionExtract — context URL extension', () => {
  it('accepts sdc-questionnaire-definitionExtractContext as extract marker', () => {
    const q  = makeQ([{
      linkId: 'obs-g',
      type: 'group',
      definition: `${SD_BASE}Observation#Observation`,
      extension: [{ url: EXTRACT_CTX_URL }],
      item: [{ linkId: 'status', type: 'string', definition: `${SD_BASE}Observation#Observation.status` }],
    }]);
    const qr = makeQR([{
      linkId: 'obs-g',
      item: [{ linkId: 'status', answer: [{ valueString: 'final' }] }],
    }]);
    const { count } = definitionExtract(q, qr);
    expect(count).toBe(1);
    expect(definitionExtract(q, qr).bundle.entry[0].resource.status).toBe('final');
  });
});

// ── Resource type inference from child definitions ────────────────────────────

describe('definitionExtract — _inferResourceType', () => {
  it('infers resource type from first child definition when group has no definition', () => {
    const q  = makeQ([{
      linkId: 'infer-g',
      type: 'group',
      extension: [{ url: EXTRACT_URL }],   // no definition on the group itself
      item: [
        { linkId: 'bdate', type: 'date', definition: `${SD_BASE}Patient#Patient.birthDate` },
      ],
    }]);
    const qr = makeQR([{
      linkId: 'infer-g',
      item: [{ linkId: 'bdate', answer: [{ valueDate: '2000-01-01' }] }],
    }]);
    const { count } = definitionExtract(q, qr);
    expect(count).toBe(1);
    expect(definitionExtract(q, qr).bundle.entry[0].resource.resourceType).toBe('Patient');
  });

  it('returns no resources when group and all children lack definitions', () => {
    const q  = makeQ([{
      linkId: 'empty-g',
      type: 'group',
      extension: [{ url: EXTRACT_URL }],
      item: [{ linkId: 'q1', type: 'string' }],   // no definition
    }]);
    const qr = makeQR([{
      linkId: 'empty-g',
      item: [{ linkId: 'q1', answer: [{ valueString: 'x' }] }],
    }]);
    const { count } = definitionExtract(q, qr);
    expect(count).toBe(0);
  });
});

// ── All answer value types ────────────────────────────────────────────────────

describe('definitionExtract — answerToValue covers all value types', () => {
  it('handles valueInteger', () => {
    const q  = makeQ([{ linkId:'g', type:'group', definition:`${SD_BASE}Obs#Obs`, extension:[{url:EXTRACT_URL}], item:[{linkId:'i',type:'integer',definition:`${SD_BASE}Obs#Obs.valueInteger`}] }]);
    const qr = makeQR([{ linkId:'g', item:[{linkId:'i',answer:[{valueInteger:42}]}] }]);
    const { bundle } = definitionExtract(q, qr);
    expect(bundle.entry[0].resource.valueInteger).toBe(42);
  });

  it('handles valueDecimal', () => {
    const q  = makeQ([{ linkId:'g', type:'group', definition:`${SD_BASE}Obs#Obs`, extension:[{url:EXTRACT_URL}], item:[{linkId:'d',type:'decimal',definition:`${SD_BASE}Obs#Obs.valueDecimal`}] }]);
    const qr = makeQR([{ linkId:'g', item:[{linkId:'d',answer:[{valueDecimal:3.14}]}] }]);
    const { bundle } = definitionExtract(q, qr);
    expect(bundle.entry[0].resource.valueDecimal).toBe(3.14);
  });

  it('handles valueBoolean', () => {
    const q  = makeQ([{ linkId:'g', type:'group', definition:`${SD_BASE}Obs#Obs`, extension:[{url:EXTRACT_URL}], item:[{linkId:'b',type:'boolean',definition:`${SD_BASE}Obs#Obs.valueBoolean`}] }]);
    const qr = makeQR([{ linkId:'g', item:[{linkId:'b',answer:[{valueBoolean:true}]}] }]);
    const { bundle } = definitionExtract(q, qr);
    expect(bundle.entry[0].resource.valueBoolean).toBe(true);
  });

  it('handles valueDateTime', () => {
    const q  = makeQ([{ linkId:'g', type:'group', definition:`${SD_BASE}Obs#Obs`, extension:[{url:EXTRACT_URL}], item:[{linkId:'dt',type:'dateTime',definition:`${SD_BASE}Obs#Obs.effective`}] }]);
    const qr = makeQR([{ linkId:'g', item:[{linkId:'dt',answer:[{valueDateTime:'2024-01-01T00:00:00Z'}]}] }]);
    const { bundle } = definitionExtract(q, qr);
    expect(bundle.entry[0].resource.effective).toBe('2024-01-01T00:00:00Z');
  });

  it('handles valueCoding (repeating CodeableConcept element)', () => {
    const coding = { system: LOINC_URL.system, code: '8310-5' };
    const q  = makeQ([{ linkId:'g', type:'group', definition:`${SD_BASE}Observation#Observation`, extension:[{url:EXTRACT_URL}], item:[{linkId:'c',type:'choice',definition:`${SD_BASE}Observation#Observation.category`}] }]);
    const qr = makeQR([{ linkId:'g', item:[{linkId:'c',answer:[{valueCoding:coding}]}] }]);
    const { bundle } = definitionExtract(q, qr);
    expect(bundle.entry[0].resource.category).toEqual([{ coding: [coding] }]);
  });

  it('handles valueQuantity', () => {
    const qty = { value: 70, unit: 'kg' };
    const q  = makeQ([{ linkId:'g', type:'group', definition:`${SD_BASE}Obs#Obs`, extension:[{url:EXTRACT_URL}], item:[{linkId:'q',type:'quantity',definition:`${SD_BASE}Obs#Obs.valueQuantity`}] }]);
    const qr = makeQR([{ linkId:'g', item:[{linkId:'q',answer:[{valueQuantity:qty}]}] }]);
    const { bundle } = definitionExtract(q, qr);
    expect(bundle.entry[0].resource.valueQuantity).toEqual(qty);
  });

  it('handles valueReference', () => {
    const ref = { reference: 'Patient/123' };
    const q  = makeQ([{ linkId:'g', type:'group', definition:`${SD_BASE}Obs#Obs`, extension:[{url:EXTRACT_URL}], item:[{linkId:'r',type:'reference',definition:`${SD_BASE}Obs#Obs.subject`}] }]);
    const qr = makeQR([{ linkId:'g', item:[{linkId:'r',answer:[{valueReference:ref}]}] }]);
    const { bundle } = definitionExtract(q, qr);
    expect(bundle.entry[0].resource.subject).toEqual(ref);
  });

  it('creates no resource when the only answer has no usable value', () => {
    const q  = makeQ([{ linkId:'g', type:'group', definition:`${SD_BASE}Observation#Observation`, extension:[{url:EXTRACT_URL}], item:[{linkId:'x',type:'string',definition:`${SD_BASE}Observation#Observation.status`}] }]);
    const qr = makeQR([{ linkId:'g', item:[{linkId:'x',answer:[{}]}] }]);
    const { bundle, count } = definitionExtract(q, qr);
    expect(count).toBe(0);
    expect(bundle).toBeNull();
  });
});

// ── setPath: prototype pollution guard ───────────────────────────────────────

describe('definitionExtract — setPath prototype pollution guard', () => {
  it('silently ignores __proto__ path segment', () => {
    const q  = makeQ([{
      linkId: 'g',
      type: 'group',
      definition: `${SD_BASE}Patient#Patient`,
      extension: [{ url: EXTRACT_URL }],
      item: [
        { linkId: 'bad',  type: 'string', definition: `${SD_BASE}Patient#Patient.__proto__.polluted` },
        { linkId: 'safe', type: 'string', definition: `${SD_BASE}Patient#Patient.name.family` },
      ],
    }]);
    const qr = makeQR([{
      linkId: 'g',
      item: [
        { linkId: 'bad',  answer: [{ valueString: 'attack' }] },
        { linkId: 'safe', answer: [{ valueString: 'Safe' }] },
      ],
    }]);
    expect(() => definitionExtract(q, qr)).not.toThrow();
    expect(({}).polluted).toBeUndefined();
  });

  it('silently ignores constructor path segment', () => {
    const q  = makeQ([{
      linkId: 'g',
      type: 'group',
      definition: `${SD_BASE}Patient#Patient`,
      extension: [{ url: EXTRACT_URL }],
      item: [
        { linkId: 'bad2', type: 'string', definition: `${SD_BASE}Patient#Patient.constructor.attack` },
      ],
    }]);
    const qr = makeQR([{
      linkId: 'g',
      item: [{ linkId: 'bad2', answer: [{ valueString: 'x' }] }],
    }]);
    expect(() => definitionExtract(q, qr)).not.toThrow();
  });
});

// ── setPath: array fields ─────────────────────────────────────────────────────

describe('definitionExtract — setPath array fields', () => {
  it('wraps "identifier" field value in an array', () => {
    const q  = makeQ([{
      linkId: 'g',
      type: 'group',
      definition: `${SD_BASE}Patient#Patient`,
      extension: [{ url: EXTRACT_URL }],
      item: [{ linkId: 'id-field', type: 'string', definition: `${SD_BASE}Patient#Patient.identifier` }],
    }]);
    const qr = makeQR([{
      linkId: 'g',
      item: [{ linkId: 'id-field', answer: [{ valueString: 'MRN-001' }] }],
    }]);
    const { bundle } = definitionExtract(q, qr);
    expect(bundle.entry[0].resource.identifier).toEqual([{ value: 'MRN-001' }]);
  });

  it('keeps both answers of a repeating element', () => {
    const q  = makeQ([{
      linkId: 'g',
      type: 'group',
      definition: `${SD_BASE}Patient#Patient`,
      extension: [{ url: EXTRACT_URL }],
      item: [{ linkId: 'code-f', type: 'string', definition: `${SD_BASE}Patient#Patient.name.given` }],
    }]);
    const qr = makeQR([{
      linkId: 'g',
      item: [{ linkId: 'code-f', answer: [{ valueString: 'A' }, { valueString: 'B' }] }],
    }]);
    const { bundle } = definitionExtract(q, qr);
    expect(bundle.entry[0].resource.name[0].given).toEqual(['A', 'B']);
  });
});

// ── Nested / recursive structures ─────────────────────────────────────────────

describe('definitionExtract — nested structures', () => {
  it('recurses into non-extract groups to find extract groups', () => {
    const q  = makeQ([{
      linkId: 'outer',
      type: 'group',
      // No extract extension — should recurse into children
      item: [{
        linkId: 'inner',
        type: 'group',
        definition: `${SD_BASE}Patient#Patient`,
        extension: [{ url: EXTRACT_URL }],
        item: [{ linkId: 'fname', type: 'string', definition: `${SD_BASE}Patient#Patient.name.family` }],
      }],
    }]);
    const qr = makeQR([{
      linkId: 'outer',
      item: [{
        linkId: 'inner',
        item: [{ linkId: 'fname', answer: [{ valueString: 'Smith' }] }],
      }],
    }]);
    const { count } = definitionExtract(q, qr);
    expect(count).toBe(1);
  });

  it('handles multiple resources in one questionnaire', () => {
    const q  = makeQ([
      {
        linkId: 'p-g',
        type: 'group',
        definition: `${SD_BASE}Patient#Patient`,
        extension: [{ url: EXTRACT_URL }],
        item: [{ linkId: 'pname', type: 'string', definition: `${SD_BASE}Patient#Patient.name.family` }],
      },
      {
        linkId: 'o-g',
        type: 'group',
        definition: `${SD_BASE}Observation#Observation`,
        extension: [{ url: EXTRACT_URL }],
        item: [{ linkId: 'ostatus', type: 'string', definition: `${SD_BASE}Observation#Observation.status` }],
      },
    ]);
    const qr = makeQR([
      { linkId: 'p-g', item: [{ linkId: 'pname',  answer: [{ valueString: 'Jones' }] }] },
      { linkId: 'o-g', item: [{ linkId: 'ostatus', answer: [{ valueString: 'final' }] }] },
    ]);
    const { count } = definitionExtract(q, qr);
    expect(count).toBe(2);
  });

  it('recurses into nested QR items via buildQRIndex', () => {
    const q  = makeQ([{
      linkId: 'g',
      type: 'group',
      definition: `${SD_BASE}Patient#Patient`,
      extension: [{ url: EXTRACT_URL }],
      item: [{ linkId: 'deep-q', type: 'string', definition: `${SD_BASE}Patient#Patient.birthDate` }],
    }]);
    // QR has nested structure
    const qr = makeQR([{
      linkId: 'g',
      item: [
        {
          linkId: 'sub-group',
          item: [{ linkId: 'deep-q', answer: [{ valueDate: '1985-03-20' }] }],
        },
      ],
    }]);
    const { count } = definitionExtract(q, qr);
    expect(count).toBe(1);
    expect(definitionExtract(q, qr).bundle.entry[0].resource.birthDate).toBe('1985-03-20');
  });

  it('sub-group with extract extension inside non-extract group', () => {
    // _collectFields recurses into non-extract sub-groups
    const q  = makeQ([{
      linkId: 'g',
      type: 'group',
      definition: `${SD_BASE}Patient#Patient`,
      extension: [{ url: EXTRACT_URL }],
      item: [{
        linkId: 'sub',
        type: 'group',
        // no extract extension — should recurse into its children
        item: [{ linkId: 'given', type: 'string', definition: `${SD_BASE}Patient#Patient.name.given` }],
      }],
    }]);
    const qr = makeQR([{
      linkId: 'g',
      item: [{
        linkId: 'sub',
        item: [{ linkId: 'given', answer: [{ valueString: 'Alice' }] }],
      }],
    }]);
    const { bundle } = definitionExtract(q, qr);
    expect(bundle.entry[0].resource.name[0].given).toEqual(['Alice']);
  });
});

// ── Repeating field values → arrays ──────────────────────────────────────────

describe('definitionExtract — repeating field values', () => {
  it('keeps every answer of a repeating element (name.given) in a list', () => {
    const q  = makeQ([{
      linkId: 'g', type: 'group', definition: `${SD_BASE}Patient#Patient`,
      extension: [{ url: EXTRACT_URL }],
      item: [{ linkId: 'given', type: 'string', definition: `${SD_BASE}Patient#Patient.name.given` }],
    }]);
    const qr = makeQR([{
      linkId: 'g',
      item: [{ linkId: 'given', answer: [{ valueString: 'John' }, { valueString: 'James' }] }],
    }]);
    const { bundle } = definitionExtract(q, qr);
    expect(bundle.entry[0].resource.name[0].given).toEqual(['John', 'James']);
  });

  it('a single answer of a repeating element is still a list', () => {
    const q  = makeQ([{
      linkId: 'g', type: 'group', definition: `${SD_BASE}Patient#Patient`,
      extension: [{ url: EXTRACT_URL }],
      item: [{ linkId: 'given', type: 'string', definition: `${SD_BASE}Patient#Patient.name.given` }],
    }]);
    const qr = makeQR([{
      linkId: 'g',
      item: [{ linkId: 'given', answer: [{ valueString: 'Solo' }] }],
    }]);
    const { bundle } = definitionExtract(q, qr);
    expect(bundle.entry[0].resource.name[0].given).toEqual(['Solo']);
  });
});

// ── Repeating groups → one resource per QR instance ──────────────────────────

describe('definitionExtract — repeating groups', () => {
  const q = makeQ([{
    linkId: 'contact-g', type: 'group', repeats: true,
    definition: `${SD_BASE}Patient#Patient`,
    extension: [{ url: EXTRACT_URL }],
    item: [{ linkId: 'family', type: 'string', definition: `${SD_BASE}Patient#Patient.name.family` }],
  }]);

  it('extracts one resource per repeating group instance', () => {
    const qr = makeQR([
      { linkId: 'contact-g', item: [{ linkId: 'family', answer: [{ valueString: 'Doe' }] }] },
      { linkId: 'contact-g', item: [{ linkId: 'family', answer: [{ valueString: 'Roe' }] }] },
    ]);
    const { bundle, count } = definitionExtract(q, qr);
    expect(count).toBe(2);
    expect(bundle.entry.map(e => e.resource.name[0].family)).toEqual(['Doe', 'Roe']);
  });

  it('gives each entry its own fullUrl and invents no resource id', () => {
    const qr = makeQR([
      { linkId: 'contact-g', item: [{ linkId: 'family', answer: [{ valueString: 'Doe' }] }] },
      { linkId: 'contact-g', item: [{ linkId: 'family', answer: [{ valueString: 'Roe' }] }] },
    ]);
    const { bundle } = definitionExtract(q, qr);
    expect(new Set(bundle.entry.map(e => e.fullUrl)).size).toBe(2);
    expect(bundle.entry.every(e => e.resource.id === undefined)).toBe(true);
  });

  it('scopes each instance to its own answers (no cross-contamination)', () => {
    const qr = makeQR([
      { linkId: 'contact-g', item: [{ linkId: 'family', answer: [{ valueString: 'First' }] }] },
      { linkId: 'contact-g', item: [{ linkId: 'family', answer: [{ valueString: 'Second' }] }] },
    ]);
    const { bundle } = definitionExtract(q, qr);
    expect(bundle.entry[0].resource.name[0].family).toBe('First');
    expect(bundle.entry[1].resource.name[0].family).toBe('Second');
  });
});

// ── parseDefinition edge cases ────────────────────────────────────────────────

describe('definitionExtract — parseDefinition edge cases', () => {
  it('handles definition with no dot after type (path is empty string)', () => {
    // 'http://hl7.org/fhir/StructureDefinition/Patient#Patient' — no dot after Patient
    const q  = makeQ([{
      linkId: 'g',
      type: 'group',
      definition: `${SD_BASE}Patient#Patient`,
      extension: [{ url: EXTRACT_URL }],
      item: [{ linkId: 'q1', type: 'string', definition: `${SD_BASE}Patient#Patient.name.family` }],
    }]);
    const qr = makeQR([{
      linkId: 'g',
      item: [{ linkId: 'q1', answer: [{ valueString: 'Test' }] }],
    }]);
    const { count } = definitionExtract(q, qr);
    expect(count).toBe(1);
  });

  it('group with definition without # falls back to child inference', () => {
    const q  = makeQ([{
      linkId: 'g',
      type: 'group',
      definition: `${SD_BASE}Patient`,   // no # fragment
      extension: [{ url: EXTRACT_URL }],
      item: [{ linkId: 'q1', type: 'string', definition: `${SD_BASE}Patient#Patient.name.family` }],
    }]);
    const qr = makeQR([{
      linkId: 'g',
      item: [{ linkId: 'q1', answer: [{ valueString: 'Fallback' }] }],
    }]);
    // parseDefinition returns null for group def (no #), so infers from children
    const { count } = definitionExtract(q, qr);
    expect(count).toBe(1);
  });
});

// ── Element shapes, nested answers, repeating elements, extension parameters ──
describe('definitionExtract — spec-conformant output', () => {
  const group = (type, items, extra = {}) => ({ linkId: 'g', type: 'group', definition: `${SD_BASE}${type}#${type}`, extension: [{ url: EXTRACT_URL }], item: items, ...extra });
  const field = (linkId, type, path, extra = {}) => ({ linkId, type, definition: `${SD_BASE}${type === undefined ? '' : ''}${path.split('.')[0]}#${path}`, ...extra });
  const run = (q, items, opts) => definitionExtract(makeQ(q), makeQR(items), opts);
  const coding = { system: 'http://snomed.info/sct', code: '73211009', display: 'Diabetes mellitus' };

  it('a single coded field becomes one CodeableConcept, not a list', () => {
    const { bundle } = run([group('Condition', [field('c', 'choice', 'Condition.code')])], [{ linkId: 'g', item: [{ linkId: 'c', answer: [{ valueCoding: coding }] }] }]);
    expect(bundle.entry[0].resource.code).toEqual({ coding: [coding] });
  });

  it('a gender coding becomes the code string', () => {
    const { bundle } = run([group('Patient', [field('s', 'choice', 'Patient.gender')])], [{ linkId: 'g', item: [{ linkId: 's', answer: [{ valueCoding: { system: 'http://hl7.org/fhir/administrative-gender', code: 'female', display: 'Female' } }] }] }]);
    expect(bundle.entry[0].resource.gender).toBe('female');
  });

  it('value[x] takes the type of the answer', () => {
    const items = [field('q', 'quantity', 'Observation.value[x]')];
    const qty = { value: 70, unit: 'kg' };
    expect(run([group('Observation', items)], [{ linkId: 'g', item: [{ linkId: 'q', answer: [{ valueQuantity: qty }] }] }]).bundle.entry[0].resource.valueQuantity).toEqual(qty);
    expect(run([group('Observation', items)], [{ linkId: 'g', item: [{ linkId: 'q', answer: [{ valueCoding: coding }] }] }]).bundle.entry[0].resource.valueCodeableConcept).toEqual({ coding: [coding] });
  });

  it('a number is not accepted for a text element and a bad integer is skipped', () => {
    const { bundle } = run([group('Patient', [field('a', 'string', 'Patient.birthDate'), field('b', 'string', 'Patient.multipleBirthInteger')])],
      [{ linkId: 'g', item: [{ linkId: 'a', answer: [{ valueString: '1990-01-01' }] }, { linkId: 'b', answer: [{ valueString: 'x' }] }] }]);
    expect(bundle.entry[0].resource.birthDate).toBe('1990-01-01');
    expect(bundle.entry[0].resource).not.toHaveProperty('multipleBirthInteger');
  });

  it('warns when several answers go to a single-valued element and uses the first', () => {
    const { bundle, warnings } = run([group('Patient', [field('b', 'string', 'Patient.birthDate')])],
      [{ linkId: 'g', item: [{ linkId: 'b', answer: [{ valueString: '1990-01-01' }, { valueString: '1991-01-01' }] }] }]);
    expect(bundle.entry[0].resource.birthDate).toBe('1990-01-01');
    expect(warnings.join(' ')).toMatch(/single value/);
  });

  it('answers nested under an answer are extracted', () => {
    const q = [group('Patient', [{ ...field('top', 'string', 'Patient.name.family'), item: [field('sub', 'string', 'Patient.name.given')] }])];
    const { bundle } = run(q, [{ linkId: 'g', item: [{ linkId: 'top', answer: [{ valueString: 'Doe', item: [{ linkId: 'sub', answer: [{ valueString: 'Jane' }] }] }] }] }]);
    expect(bundle.entry[0].resource.name[0]).toMatchObject({ family: 'Doe', given: ['Jane'] });
  });

  it('a repeating group with a definition gives one element per instance', () => {
    const contactGroup = { linkId: 'contact', type: 'group', repeats: true, definition: `${SD_BASE}Patient#Patient.contact`, item: [field('cf', 'string', 'Patient.contact.name.family')] };
    const { bundle } = run([group('Patient', [contactGroup])], [{ linkId: 'g', item: [
      { linkId: 'contact', item: [{ linkId: 'cf', answer: [{ valueString: 'Doe' }] }] },
      { linkId: 'contact', item: [{ linkId: 'cf', answer: [{ valueString: 'Roe' }] }] },
    ] }]);
    expect(bundle.entry[0].resource.contact.map(c => c.name.family)).toEqual(['Doe', 'Roe']);
  });

  it('uses the extension parameters for the entry and the profile', () => {
    const profile = 'http://example.org/StructureDefinition/my-patient';
    const ext = { url: EXTRACT_URL, extension: [
      { url: 'definition', valueCanonical: profile },
      { url: 'fullUrl', valueString: "'urn:uuid:11111111-1111-1111-1111-111111111111'" },
      { url: 'ifNoneExist', valueString: "'identifier=urn:x|' + item.where(linkId='mrn').answer.value" },
    ] };
    const items = [group('Patient', [field('mrn', 'string', 'Patient.name.family')], { extension: [ext] })];
    const { bundle } = run(items, [{ linkId: 'g', item: [{ linkId: 'mrn', answer: [{ valueString: 'M1' }] }] }]);
    const entry = bundle.entry[0];
    expect(entry.fullUrl).toBe('urn:uuid:11111111-1111-1111-1111-111111111111');
    expect(entry.request).toEqual({ method: 'POST', url: 'Patient', ifNoneExist: 'identifier=urn:x|M1' });
    expect(entry.resource.meta).toEqual({ profile: [profile] });
  });

  it('a nested extract group keeps its own resource type', () => {
    const nested = { linkId: 'cond', type: 'group', extension: [{ url: EXTRACT_URL, extension: [{ url: 'definition', valueCanonical: `${SD_BASE}Condition` }] }],
      item: [field('c', 'choice', 'Condition.code')] };
    const { bundle } = run([group('Encounter', [field('s', 'string', 'Encounter.status'), nested])],
      [{ linkId: 'g', item: [{ linkId: 's', answer: [{ valueString: 'finished' }] }, { linkId: 'cond', item: [{ linkId: 'c', answer: [{ valueCoding: coding }] }] }] }]);
    expect(bundle.entry.map(e => e.resource.resourceType)).toEqual(['Encounter', 'Condition']);
    expect(bundle.entry[1].resource.code).toEqual({ coding: [coding] });
  });

  it('a date answer fits dateTime choices and a decimal fits a Quantity value', () => {
    const { bundle } = run([group('Observation', [field('d', 'date', 'Observation.effective[x]'), field('n', 'decimal', 'Observation.value[x]')])],
      [{ linkId: 'g', item: [{ linkId: 'd', answer: [{ valueDate: '2024-05-01' }] }, { linkId: 'n', answer: [{ valueDecimal: 7.5 }] }] }]);
    expect(bundle.entry[0].resource).toMatchObject({ effectiveDateTime: '2024-05-01', valueQuantity: { value: 7.5 } });
  });

  it('a path that names an inherited property writes nothing onto it', () => {
    run([group('Patient', [field('x', 'string', 'Patient.toString.x')])], [{ linkId: 'g', item: [{ linkId: 'x', answer: [{ valueString: 'v' }] }] }]);
    expect(Object.prototype.toString.x).toBeUndefined();
    expect(({}).toString.x).toBeUndefined();
  });

  it('warns when the instances of a group go into one single-valued element', () => {
    const maritalGroup = { linkId: 'bd', type: 'group', repeats: true, definition: `${SD_BASE}Patient#Patient.maritalStatus`, item: [field('t', 'string', 'Patient.maritalStatus.text')] };
    const { warnings } = run([group('Patient', [maritalGroup])], [{ linkId: 'g', item: [
      { linkId: 'bd', item: [{ linkId: 't', answer: [{ valueString: 'single' }] }] },
      { linkId: 'bd', item: [{ linkId: 't', answer: [{ valueString: 'married' }] }] },
    ] }]);
    expect(warnings.join(' ')).toMatch(/several group instances/);
  });

  it('a base resource canonical adds no profile', () => {
    const ext = { url: EXTRACT_URL, extension: [{ url: 'definition', valueCanonical: `${SD_BASE}Patient` }] };
    const { bundle } = run([group('Patient', [field('f', 'string', 'Patient.name.family')], { extension: [ext] })], [{ linkId: 'g', item: [{ linkId: 'f', answer: [{ valueString: 'X' }] }] }]);
    expect(bundle.entry[0].resource.meta).toBeUndefined();
  });
});
