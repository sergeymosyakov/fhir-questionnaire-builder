// ── Unit tests: format registry (versionRegistry facade + per-format builds) ─
import { describe, it, expect, beforeEach } from 'vitest';

const VERSION_EXT_URL =
  'https://sergeymosyakov.github.io/fhir-questionnaire-builder/StructureDefinition/builder-target-version';
const ANSWER_CONSTRAINT_EXT_URL =
  'https://sergeymosyakov.github.io/fhir-questionnaire-builder/StructureDefinition/item-answerConstraint';
const DISABLED_DISPLAY_EXT_URL =
  'https://sergeymosyakov.github.io/fhir-questionnaire-builder/StructureDefinition/item-disabledDisplay';
/** Read the builder-target-version code from a built Questionnaire. */
function versionCode(q) {
  return (q.extension || []).find(e => e.url === VERSION_EXT_URL)?.valueCode;
}
/** Read a builder-private item extension valueCode. */
function itemExtCode(item, url) {
  return (item.extension || []).find(e => e.url === url)?.valueCode;
}

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

  it('detectVersion reads the builder-target-version extension', () => {
    const mk = (code) => ({
      resourceType: 'Questionnaire',
      extension: [{
        url: 'https://sergeymosyakov.github.io/fhir-questionnaire-builder/StructureDefinition/builder-target-version',
        valueCode: code,
      }],
      item: [],
    });
    expect(registry.detectVersion(mk('4.0.1'))).toBe('R4');
    expect(registry.detectVersion(mk('4.3.0'))).toBe('R4B');
    expect(registry.detectVersion(mk('5.0.0'))).toBe('R5');
  });

  it('detectVersion falls back to feature heuristics when no extension', () => {
    // disabledDisplay → R5 (added in R5)
    expect(registry.detectVersion({
      resourceType: 'Questionnaire',
      item: [{ linkId: 'q1', type: 'choice', disabledDisplay: 'hidden' }],
    })).toBe('R5');
    // answerConstraint → R5 (added in R5)
    expect(registry.detectVersion({
      resourceType: 'Questionnaire',
      item: [{ linkId: 'q1', type: 'choice', answerConstraint: 'optionsOrString' }],
    })).toBe('R5');
  });

  it('detectVersion finds heuristic fields in nested items', () => {
    expect(registry.detectVersion({
      resourceType: 'Questionnaire',
      item: [{ linkId: 'g1', type: 'group', item: [{ linkId: 'q1', type: 'choice', disabledDisplay: 'protected' }] }],
    })).toBe('R5');
  });

  it('detectVersion defaults to R4 when nothing matches', () => {
    expect(registry.detectVersion({ resourceType: 'Questionnaire', item: [{ linkId: 'q1', type: 'string' }] })).toBe('R4');
    expect(registry.detectVersion({})).toBe('R4');
    expect(registry.detectVersion(null)).toBe('R4');
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

  it('stamps builder-target-version: 4.0.1', () => {
    const base = { resourceType: 'Questionnaire', id: 'test', item: [] };
    const result = fmt.build(base);
    expect(versionCode(result)).toBe('4.0.1');
    expect(result.meta.fhirVersion).toBeUndefined();
  });

  it('preserves existing meta fields', () => {
    const base = {
      resourceType: 'Questionnaire',
      meta: { versionId: 'v1', lastUpdated: '2024-01-01T00:00:00Z' },
      item: [],
    };
    const result = fmt.build(base);
    expect(result.meta.versionId).toBe('v1');
    expect(versionCode(result)).toBe('4.0.1');
  });

  it('does not mutate the original base object', () => {
    const base = { resourceType: 'Questionnaire', item: [] };
    fmt.build(base);
    expect(base.meta).toBeUndefined();
  });

  it('downgrades R5-only item fields to builder-private extensions', () => {
    const base = {
      resourceType: 'Questionnaire',
      item: [{ linkId: 'q1', type: 'choice', answerConstraint: 'optionsOrString', disabledDisplay: 'hidden' }],
    };
    const result = fmt.build(base);
    expect(result.item[0].answerConstraint).toBeUndefined();
    expect(result.item[0].disabledDisplay).toBeUndefined();
    expect(itemExtCode(result.item[0], ANSWER_CONSTRAINT_EXT_URL)).toBe('optionsOrString');
    expect(itemExtCode(result.item[0], DISABLED_DISPLAY_EXT_URL)).toBe('hidden');
  });

  it('downgrades R5-only fields recursively in nested items', () => {
    const base = {
      resourceType: 'Questionnaire',
      item: [{ linkId: 'g1', type: 'group', item: [{ linkId: 'q1', type: 'choice', disabledDisplay: 'protected' }] }],
    };
    const result = fmt.build(base);
    expect(result.item[0].item[0].disabledDisplay).toBeUndefined();
    expect(itemExtCode(result.item[0].item[0], DISABLED_DISPLAY_EXT_URL)).toBe('protected');
  });
});

// ── R4B format build() ─────────────────────────────────────────────────────
describe('R4B format', () => {
  it('stamps builder-target-version: 4.3.0', async () => {
    const { formatRegistry } = await import('../js/fhir/format-registry.js');
    await import('../js/fhir/formats/r4b.js');
    const fmt = formatRegistry.get('R4B');
    const result = fmt.build({ resourceType: 'Questionnaire', item: [] });
    expect(versionCode(result)).toBe('4.3.0');
    expect(result.meta.fhirVersion).toBeUndefined();
  });

  it('downgrades R5-only item fields to builder-private extensions', async () => {
    const { formatRegistry } = await import('../js/fhir/format-registry.js');
    await import('../js/fhir/formats/r4b.js');
    const fmt = formatRegistry.get('R4B');
    const result = fmt.build({
      resourceType: 'Questionnaire',
      item: [{ linkId: 'q1', type: 'choice', answerConstraint: 'optionsOnly' }],
    });
    expect(result.item[0].answerConstraint).toBeUndefined();
    expect(itemExtCode(result.item[0], ANSWER_CONSTRAINT_EXT_URL)).toBe('optionsOnly');
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

  it('stamps builder-target-version: 5.0.0', () => {
    const base = { resourceType: 'Questionnaire', item: [] };
    const result = fmt.build(base);
    expect(versionCode(result)).toBe('5.0.0');
    expect(result.meta.fhirVersion).toBeUndefined();
  });

  it('converts open-choice items to type=coding + answerConstraint=optionsOrString', () => {
    const base = {
      resourceType: 'Questionnaire',
      item: [{ linkId: 'q1', type: 'open-choice', text: 'Pick one' }],
    };
    const result = fmt.build(base);
    expect(result.item[0].type).toBe('coding');
    expect(result.item[0].answerConstraint).toBe('optionsOrString');
  });

  it('converts choice items to type=coding (R5 renamed choice to coding)', () => {
    const base = {
      resourceType: 'Questionnaire',
      item: [{ linkId: 'q1', type: 'choice', text: 'Pick one' }],
    };
    const result = fmt.build(base);
    expect(result.item[0].type).toBe('coding');
    expect(result.item[0].answerConstraint).toBeUndefined();
  });

  it('does not touch items with a non-choice type', () => {
    const base = {
      resourceType: 'Questionnaire',
      item: [{ linkId: 'q1', type: 'text' }, { linkId: 'q2', type: 'boolean' }],
    };
    const result = fmt.build(base);
    expect(result.item[0].type).toBe('text');
    expect(result.item[1].type).toBe('boolean');
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
    expect(result.item[0].item[0].type).toBe('coding');
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
