// ── Unit tests: js/fhir/sdc-cql-eval.js ───────────────────────────────────────
// resolveCqlInitialValues() resolves a contained Library's embedded ELM and runs it
// through the real vendored cql-execution/cql-exec-fhir — no fakes (matches the
// sdc-structuremap-* test philosophy). ELM is the real cql-to-elm compiler output
// for `define AgeInMonths: AgeInMonths()` against `using FHIR version '4.0.1'`.
import { describe, it, expect } from 'vitest';
import { resolveCqlInitialValues } from '../js/fhir/sdc-cql-eval.js';
import { FHIR } from '../js/fhir/urls/fhir.js';

const ELM_B64 = 'eyJsaWJyYXJ5Ijp7ImFubm90YXRpb24iOlt7InR5cGUiOiJDcWxUb0VsbUluZm8iLCJ0cmFuc2xhdG9yVmVyc2lvbiI6IjUuMi4wIiwidHJhbnNsYXRvck9wdGlvbnMiOiIiLCJzaWduYXR1cmVMZXZlbCI6Ik5vbmUifV0sImlkZW50aWZpZXIiOnsiaWQiOiJBZ2VNb250aHNEZW1vIiwidmVyc2lvbiI6IjEuMC4wIn0sInNjaGVtYUlkZW50aWZpZXIiOnsiaWQiOiJ1cm46aGw3LW9yZzplbG0iLCJ2ZXJzaW9uIjoicjEifSwidXNpbmdzIjp7ImRlZiI6W3sibG9jYWxJZGVudGlmaWVyIjoiU3lzdGVtIiwidXJpIjoidXJuOmhsNy1vcmc6ZWxtLXR5cGVzOnIxIiwiYW5ub3RhdGlvbiI6W119LHsibG9jYWxJZGVudGlmaWVyIjoiRkhJUiIsInVyaSI6Imh0dHA6Ly9obDcub3JnL2ZoaXIiLCJ2ZXJzaW9uIjoiNC4wLjEiLCJhbm5vdGF0aW9uIjpbXX1dfSwiY29udGV4dHMiOnsiZGVmIjpbeyJuYW1lIjoiUGF0aWVudCIsImFubm90YXRpb24iOltdfV19LCJzdGF0ZW1lbnRzIjp7ImRlZiI6W3sibmFtZSI6IlBhdGllbnQiLCJjb250ZXh0IjoiUGF0aWVudCIsImFubm90YXRpb24iOltdLCJleHByZXNzaW9uIjp7InR5cGUiOiJTaW5nbGV0b25Gcm9tIiwiYW5ub3RhdGlvbiI6W10sInNpZ25hdHVyZSI6W10sIm9wZXJhbmQiOnsidHlwZSI6IlJldHJpZXZlIiwiZGF0YVR5cGUiOiJ7aHR0cDovL2hsNy5vcmcvZmhpcn1QYXRpZW50IiwidGVtcGxhdGVJZCI6Imh0dHA6Ly9obDcub3JnL2ZoaXIvU3RydWN0dXJlRGVmaW5pdGlvbi9QYXRpZW50IiwiYW5ub3RhdGlvbiI6W10sImluY2x1ZGUiOltdLCJjb2RlRmlsdGVyIjpbXSwiZGF0ZUZpbHRlciI6W10sIm90aGVyRmlsdGVyIjpbXX19fSx7Im5hbWUiOiJBZ2VJbk1vbnRocyIsImNvbnRleHQiOiJQYXRpZW50IiwiYWNjZXNzTGV2ZWwiOiJQdWJsaWMiLCJhbm5vdGF0aW9uIjpbXSwiZXhwcmVzc2lvbiI6eyJ0eXBlIjoiQ2FsY3VsYXRlQWdlIiwicHJlY2lzaW9uIjoiTW9udGgiLCJhbm5vdGF0aW9uIjpbXSwic2lnbmF0dXJlIjpbXSwib3BlcmFuZCI6eyJ0eXBlIjoiUHJvcGVydHkiLCJwYXRoIjoiYmlydGhEYXRlLnZhbHVlIiwiYW5ub3RhdGlvbiI6W10sInNvdXJjZSI6eyJ0eXBlIjoiRXhwcmVzc2lvblJlZiIsIm5hbWUiOiJQYXRpZW50IiwiYW5ub3RhdGlvbiI6W119fX19XX19fQ==';

function makeQuestJson({ withLibrary = true, canonical = '#age-months-library' } = {}) {
  return {
    resourceType: 'Questionnaire',
    extension: withLibrary ? [{ url: FHIR.cqfLibrary, valueCanonical: canonical }] : [],
    contained: withLibrary ? [{
      resourceType: 'Library', id: 'age-months-library', status: 'active',
      content: [{ contentType: 'application/elm+json', data: ELM_B64 }],
    }] : [],
  };
}

function cqlNode(id) {
  return { id, itemType: 'integer', _initialExpr: 'AgeInMonths', _initialExprLanguage: 'text/cql-identifier' };
}

describe('resolveCqlInitialValues — guard paths (no-op, no dynamic import triggered)', () => {
  it('returns {} when no node uses text/cql-identifier', async () => {
    const tree = [{ id: 'q1', itemType: 'string', _initialExpr: '%patient.name' }];
    expect(await resolveCqlInitialValues(makeQuestJson(), tree, { age: 2 })).toEqual({});
  });

  it('returns {} when the questionnaire has no cqf-library extension', async () => {
    const tree = [cqlNode('age-in-months')];
    expect(await resolveCqlInitialValues(makeQuestJson({ withLibrary: false }), tree, { age: 2 })).toEqual({});
  });

  it('returns {} when cqf-library points at an external (non-contained) canonical', async () => {
    const tree = [cqlNode('age-in-months')];
    const q = makeQuestJson({ canonical: 'https://example.org/Library/age-months|1.0.0' });
    expect(await resolveCqlInitialValues(q, tree, { age: 2 })).toEqual({});
  });

  it('returns {} when the referenced Library is not found in contained[]', async () => {
    const tree = [cqlNode('age-in-months')];
    const q = makeQuestJson({ canonical: '#missing' });
    expect(await resolveCqlInitialValues(q, tree, { age: 2 })).toEqual({});
  });

  it('returns {} when no %age patient-preset variable is set (nothing to synthesize a Patient from)', async () => {
    const tree = [cqlNode('age-in-months')];
    expect(await resolveCqlInitialValues(makeQuestJson(), tree, {})).toEqual({});
  });
});

describe('resolveCqlInitialValues — happy path', () => {
  it('resolves the CQL define and maps it onto the node id', async () => {
    const tree = [cqlNode('age-in-months')];
    const values = await resolveCqlInitialValues(makeQuestJson(), tree, { age: 2 });
    expect(values['age-in-months']).toBe('24');
  });

  it('finds CQL nodes nested under group children', async () => {
    const tree = [{ id: 'grp', itemType: undefined, children: [cqlNode('age-in-months')] }];
    const values = await resolveCqlInitialValues(makeQuestJson(), tree, { age: 3 });
    expect(values['age-in-months']).toBe('36');
  });
});
