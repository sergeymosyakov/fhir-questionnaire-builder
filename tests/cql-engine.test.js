// ── Unit tests: js/fhir/cql-engine.js ─────────────────────────────────────────
// Runs the real vendored cql-execution + cql-exec-fhir (lib/*.esm.js) — no fakes,
// matches the sdc-structuremap-* test philosophy. ELM below is the real output of
// the official cql-to-elm compiler for:
//   library AgeMonthsDemo version '1.0.0'
//   using FHIR version '4.0.1'
//   context Patient
//   define AgeInMonths: AgeInMonths()
import { describe, it, expect } from 'vitest';
import { runCqlLibrary } from '../js/fhir/cql-engine.js';

const AGE_MONTHS_ELM = {
  library: {
    identifier: { id: 'AgeMonthsDemo', version: '1.0.0' },
    schemaIdentifier: { id: 'urn:hl7-org:elm', version: 'r1' },
    usings: { def: [
      { localIdentifier: 'System', uri: 'urn:hl7-org:elm-types:r1' },
      { localIdentifier: 'FHIR', uri: 'http://hl7.org/fhir', version: '4.0.1' },
    ] },
    statements: { def: [
      {
        name: 'Patient', context: 'Patient',
        expression: { type: 'SingletonFrom', operand: { type: 'Retrieve', dataType: '{http://hl7.org/fhir}Patient' } },
      },
      {
        name: 'AgeInMonths', context: 'Patient', accessLevel: 'Public',
        expression: {
          type: 'CalculateAge', precision: 'Month',
          operand: { type: 'Property', path: 'birthDate.value', source: { type: 'ExpressionRef', name: 'Patient' } },
        },
      },
    ] },
  },
};

describe('runCqlLibrary', () => {
  it('evaluates every define for the given patient', async () => {
    const today = new Date();
    const birthDate = new Date(Date.UTC(today.getUTCFullYear() - 2, today.getUTCMonth(), today.getUTCDate()));
    const patient = { resourceType: 'Patient', id: 'p1', birthDate: birthDate.toISOString().slice(0, 10) };
    const results = await runCqlLibrary(AGE_MONTHS_ELM, patient);
    expect(results.AgeInMonths).toBe(24);
  });

  it('recomputes from the patient\u2019s actual birthDate (not a fixed value)', async () => {
    const today = new Date();
    const birthDate = new Date(Date.UTC(today.getUTCFullYear() - 5, today.getUTCMonth(), today.getUTCDate()));
    const patient = { resourceType: 'Patient', id: 'p2', birthDate: birthDate.toISOString().slice(0, 10) };
    const results = await runCqlLibrary(AGE_MONTHS_ELM, patient);
    expect(results.AgeInMonths).toBe(60);
  });
});

