// ── Unit tests: format registry (versionRegistry facade + per-format builds) ─
import { describe, it, expect, beforeEach } from 'vitest';

// ── versionRegistry facade ─────────────────────────────────────────────────
describe('versionRegistry facade', () => {
  let registry;

  beforeEach(async () => {
    const { versionRegistry: vr } = await import('../js/fhir/version-registry.js');
    registry = vr;
    // Ensure format registrations are loaded
    await import('../js/fhir/formats/r4.js');
    await import('../js/fhir/formats/r4b.js');
    await import('../js/fhir/formats/r5.js');
  });

  it('retrieves R4 via facade', () => {
    const def = registry.get('R4');
    expect(def).toBeDefined();
    expect(def.id).toBe('R4');
    expect(def.selectorLabel).toBe('FHIR R4');
    expect(def.metaVersion).toBe('4.0.1');
  });

  it('retrieves R4B via facade', () => {
    const def = registry.get('R4B');
    expect(def).toBeDefined();
    expect(def.metaVersion).toBe('4.3.0');
  });

  it('retrieves R5 via facade', () => {
    const def = registry.get('R5');
    expect(def).toBeDefined();
    expect(def.metaVersion).toBe('5.0.0');
  });

  it('getAll() returns only builder versions (isBuilderVersion === true)', () => {
    const ids = registry.getAll().map(v => v.id);
    expect(ids).toContain('R4');
    expect(ids).toContain('R4B');
    expect(ids).toContain('R5');
    // REDCap is export-only, should not appear in version selector list
    expect(ids).not.toContain('redcap');
  });

  it('detectFromMeta matches exact metaVersion strings', () => {
    expect(registry.detectFromMeta('4.0.1')).toBe('R4');
    expect(registry.detectFromMeta('4.3.0')).toBe('R4B');
    expect(registry.detectFromMeta('5.0.0')).toBe('R5');
  });

  it('detectFromMeta does prefix matching for unknown patch versions', () => {
    expect(registry.detectFromMeta('4.0.9')).toBe('R4');
    expect(registry.detectFromMeta('4.3.99')).toBe('R4B');
    expect(registry.detectFromMeta('5.1.0')).toBe('R5');
  });

  it('detectFromMeta returns null for unrecognised version strings', () => {
    expect(registry.detectFromMeta('3.0.0')).toBeNull();
    expect(registry.detectFromMeta('')).toBeNull();
    expect(registry.detectFromMeta(null)).toBeNull();
    expect(registry.detectFromMeta(undefined)).toBeNull();
  });
});

// ── formatRegistry ─────────────────────────────────────────────────────────
describe('formatRegistry', () => {
  let registry;

  beforeEach(async () => {
    const { formatRegistry: fr } = await import('../js/fhir/format-registry.js');
    registry = fr;
    await import('../js/fhir/formats/r4.js');
    await import('../js/fhir/formats/r4b.js');
    await import('../js/fhir/formats/r5.js');
  });

  it('getAll() includes all builder versions', () => {
    const ids = registry.getAll().map(f => f.id);
    expect(ids).toContain('R4');
    expect(ids).toContain('R4B');
    expect(ids).toContain('R5');
  });

  it('getBuilderVersions() filters only isBuilderVersion formats', () => {
    const ids = registry.getBuilderVersions().map(f => f.id);
    expect(ids).toContain('R4');
    expect(ids).not.toContain('redcap');
  });
});

// ── R4 format build() ──────────────────────────────────────────────────────
describe('R4 format', () => {
  let fmt;

  beforeEach(async () => {
    const { formatRegistry } = await import('../js/fhir/format-registry.js');
    await import('../js/fhir/formats/r4.js');
    fmt = formatRegistry.get('R4');
  });

  it('stamps meta.fhirVersion: 4.0.1', () => {
    const base = { resourceType: 'Questionnaire', id: 'test', item: [] };
    const result = fmt.build(base);
    expect(result.meta.fhirVersion).toBe('4.0.1');
  });

  it('preserves existing meta fields', () => {
    const base = {
      resourceType: 'Questionnaire',
      meta: { versionId: 'v1', lastUpdated: '2024-01-01T00:00:00Z' },
      item: [],
    };
    const result = fmt.build(base);
    expect(result.meta.versionId).toBe('v1');
    expect(result.meta.fhirVersion).toBe('4.0.1');
  });

  it('does not mutate the original base object', () => {
    const base = { resourceType: 'Questionnaire', item: [] };
    fmt.build(base);
    expect(base.meta).toBeUndefined();
  });
});

// ── R4B format build() ─────────────────────────────────────────────────────
describe('R4B format', () => {
  it('stamps meta.fhirVersion: 4.3.0', async () => {
    const { formatRegistry } = await import('../js/fhir/format-registry.js');
    await import('../js/fhir/formats/r4b.js');
    const fmt = formatRegistry.get('R4B');
    const result = fmt.build({ resourceType: 'Questionnaire', item: [] });
    expect(result.meta.fhirVersion).toBe('4.3.0');
  });
});

// ── R5 format build() ─────────────────────────────────────────────────────
describe('R5 format', () => {
  let fmt;

  beforeEach(async () => {
    const { formatRegistry } = await import('../js/fhir/format-registry.js');
    await import('../js/fhir/formats/r5.js');
    fmt = formatRegistry.get('R5');
  });

  it('stamps meta.fhirVersion: 5.0.0', () => {
    const base = { resourceType: 'Questionnaire', item: [] };
    const result = fmt.build(base);
    expect(result.meta.fhirVersion).toBe('5.0.0');
  });

  it('converts open-choice items to type=choice + answerConstraint=optionsOrString', () => {
    const base = {
      resourceType: 'Questionnaire',
      item: [{ linkId: 'q1', type: 'open-choice', text: 'Pick one' }],
    };
    const result = fmt.build(base);
    expect(result.item[0].type).toBe('choice');
    expect(result.item[0].answerConstraint).toBe('optionsOrString');
  });

  it('does not touch items with type other than open-choice', () => {
    const base = {
      resourceType: 'Questionnaire',
      item: [{ linkId: 'q1', type: 'text' }, { linkId: 'q2', type: 'choice' }],
    };
    const result = fmt.build(base);
    expect(result.item[0].type).toBe('text');
    expect(result.item[1].type).toBe('choice');
    expect(result.item[1].answerConstraint).toBeUndefined();
  });

  it('recursively converts nested open-choice items', () => {
    const base = {
      resourceType: 'Questionnaire',
      item: [{
        linkId: 'g1',
        type: 'group',
        item: [{ linkId: 'q1', type: 'open-choice' }],
      }],
    };
    const result = fmt.build(base);
    expect(result.item[0].item[0].type).toBe('choice');
    expect(result.item[0].item[0].answerConstraint).toBe('optionsOrString');
  });

  it('preserves existing answerConstraint if already set', () => {
    const base = {
      resourceType: 'Questionnaire',
      item: [{ linkId: 'q1', type: 'open-choice', answerConstraint: 'optionsOnly' }],
    };
    const result = fmt.build(base);
    expect(result.item[0].answerConstraint).toBe('optionsOnly');
  });

  it('does not mutate the original base object', () => {
    const base = {
      resourceType: 'Questionnaire',
      item: [{ linkId: 'q1', type: 'open-choice' }],
    };
    fmt.build(base);
    expect(base.item[0].type).toBe('open-choice');
  });
});
