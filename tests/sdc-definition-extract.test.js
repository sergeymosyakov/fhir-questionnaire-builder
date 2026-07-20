// ── Unit tests: js/fhir/sdc-definition-extract.js ────────────────────────────
// definitionExtract() is a pure FHIR transformation — no DOM, no state.

import { describe, it, expect } from 'vitest';
import { definitionExtract } from '../js/fhir/sdc-definition-extract.js';

const EXTRACT_URL     = 'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-definitionExtract';
const EXTRACT_CTX_URL = 'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-definitionExtractContext';
const SD_BASE         = 'http://hl7.org/fhir/StructureDefinition/';

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
    expect(warnings.some(w => w.includes('No extraction groups'))).toBe(true);
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

  it('resource has expected resourceType and id', () => {
    const { bundle } = definitionExtract(q, qr);
    const r = bundle.entry[0].resource;
    expect(r.resourceType).toBe('Patient');
    expect(r.id).toMatch(/^extracted-patient-1$/i);
  });

  it('sets nested name.family correctly', () => {
    const { bundle } = definitionExtract(q, qr);
    const r = bundle.entry[0].resource;
    expect(r.name.family).toBe('Doe');
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

  it('handles valueCoding (array field)', () => {
    const coding = { system: 'http://loinc.org', code: '8310-5' };
    const q  = makeQ([{ linkId:'g', type:'group', definition:`${SD_BASE}Obs#Obs`, extension:[{url:EXTRACT_URL}], item:[{linkId:'c',type:'choice',definition:`${SD_BASE}Obs#Obs.category`}] }]);
    const qr = makeQR([{ linkId:'g', item:[{linkId:'c',answer:[{valueCoding:coding}]}] }]);
    const { bundle } = definitionExtract(q, qr);
    expect(bundle.entry[0].resource.category[0]).toEqual(coding);
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

  it('creates resource but sets no fields when answer value type is unrecognized', () => {
    const q  = makeQ([{ linkId:'g', type:'group', definition:`${SD_BASE}Obs#Obs`, extension:[{url:EXTRACT_URL}], item:[{linkId:'x',type:'string',definition:`${SD_BASE}Obs#Obs.valueString`}] }]);
    const qr = makeQR([{ linkId:'g', item:[{linkId:'x',answer:[{}]}] }]);
    // answer has no value → answerToValue returns null → setPath not called
    // but resource IS created (field was found with answer.length > 0)
    const { bundle, count } = definitionExtract(q, qr);
    expect(count).toBe(1);
    expect(bundle.entry[0].resource.resourceType).toBe('Obs');
    expect(bundle.entry[0].resource.valueString).toBeUndefined();
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
    expect(bundle.entry[0].resource.identifier).toEqual(['MRN-001']);
  });

  it('appends to existing array field on second answer', () => {
    const q  = makeQ([{
      linkId: 'g',
      type: 'group',
      definition: `${SD_BASE}Patient#Patient`,
      extension: [{ url: EXTRACT_URL }],
      item: [{ linkId: 'code-f', type: 'string', definition: `${SD_BASE}Patient#Patient.code` }],
    }]);
    const qr = makeQR([{
      linkId: 'g',
      item: [{ linkId: 'code-f', answer: [{ valueString: 'A' }, { valueString: 'B' }] }],
    }]);
    const { bundle } = definitionExtract(q, qr);
    expect(bundle.entry[0].resource.code).toEqual(['A', 'B']);
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
    expect(bundle.entry[0].resource.name.given).toBe('Alice');
  });
});

// ── Repeating field values → arrays ──────────────────────────────────────────

describe('definitionExtract — repeating field values', () => {
  it('promotes a repeated non-array leaf (name.given) to an array', () => {
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
    expect(bundle.entry[0].resource.name.given).toEqual(['John', 'James']);
  });

  it('keeps a single value scalar', () => {
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
    expect(bundle.entry[0].resource.name.given).toBe('Solo');
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
    expect(bundle.entry.map(e => e.resource.name.family)).toEqual(['Doe', 'Roe']);
  });

  it('gives each extracted resource a unique id', () => {
    const qr = makeQR([
      { linkId: 'contact-g', item: [{ linkId: 'family', answer: [{ valueString: 'Doe' }] }] },
      { linkId: 'contact-g', item: [{ linkId: 'family', answer: [{ valueString: 'Roe' }] }] },
    ]);
    const { bundle } = definitionExtract(q, qr);
    const ids = bundle.entry.map(e => e.resource.id);
    expect(new Set(ids).size).toBe(2);
  });

  it('scopes each instance to its own answers (no cross-contamination)', () => {
    const qr = makeQR([
      { linkId: 'contact-g', item: [{ linkId: 'family', answer: [{ valueString: 'First' }] }] },
      { linkId: 'contact-g', item: [{ linkId: 'family', answer: [{ valueString: 'Second' }] }] },
    ]);
    const { bundle } = definitionExtract(q, qr);
    expect(bundle.entry[0].resource.name.family).toBe('First');
    expect(bundle.entry[1].resource.name.family).toBe('Second');
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
