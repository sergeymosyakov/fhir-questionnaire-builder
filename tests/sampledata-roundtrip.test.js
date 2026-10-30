// Round-trip sweep: every shipped sample / fixture Questionnaire must survive import → export → import → export.
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

globalThis.CustomEvent = class CustomEvent {
  constructor(type, init) { this.type = type; this.detail = init?.detail; }
};
const _listeners = {};
globalThis.document = {
  dispatchEvent(e) { (_listeners[e.type] || []).forEach(fn => fn(e)); },
  addEventListener(type, fn) { (_listeners[type] = _listeners[type] || []).push(fn); },
};

const questDoc = { tree: [], meta: {}, rawFhir: null, variables: [], contained: [], translations: {} };

vi.mock('../js/ui/toast.js', () => ({ showError: vi.fn(), showWarn: vi.fn(), showInfo: vi.fn() }));
vi.mock('../js/builder/index.js', () => ({ renderTree: vi.fn() }));

const { importFHIR } = await import('../js/fhir/import.js');
const { buildFHIRObject } = await import('../js/fhir/export.js');
const { AppEvents, EventState } = await import('../js/events.js');
EventState._set(AppEvents.APP_CONTEXT_READY, { questDoc });

const ROOT = path.resolve(import.meta.dirname, '..');
const DIRS = ['sampledata', 'tests/fixtures'];

const all = DIRS.flatMap(d =>
  fs.readdirSync(path.join(ROOT, d))
    .filter(f => f.endsWith('.json'))
    .map(f => ({ rel: `${d}/${f}`, json: JSON.parse(fs.readFileSync(path.join(ROOT, d, f), 'utf8')) })));

const questionnaires = all.filter(f => f.json.resourceType === 'Questionnaire').map(f => [f.rel, f.json]);
// Non-Questionnaire resources (QuestionnaireResponse, StructureDefinition, ...) are not importable by design.
// Plain JSON that is not a FHIR resource (e.g. library.json, an array) is ignored.
const nonQuestionnaires = all.filter(f => f.json.resourceType && f.json.resourceType !== 'Questionnaire').map(f => [f.rel, f.json.resourceType]);

function linkIds(items = [], out = []) {
  for (const it of items) { out.push(it.linkId); linkIds(it.item, out); }
  return out;
}

const clone = o => JSON.parse(JSON.stringify(o));

function roundTrip(json) {
  expect(importFHIR(clone(json))).not.toBe(false);
  const first = clone(buildFHIRObject(questDoc));
  expect(importFHIR(clone(first))).not.toBe(false);
  const second = clone(buildFHIRObject(questDoc));
  return { first, second };
}

describe('sample / fixture Questionnaire round-trip', () => {
  beforeAll(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-01-01T00:00:00Z')); });
  afterAll(() => { vi.useRealTimers(); });

  it('discovers Questionnaires', () => {
    expect(questionnaires.length).toBeGreaterThan(40);
  });

  it('only non-Questionnaire resources are excluded from the sweep', () => {
    const types = new Set(nonQuestionnaires.map(([, t]) => t));
    expect([...types].sort()).toEqual(['QuestionnaireResponse', 'StructureDefinition']);
  });

  it.each(questionnaires)('%s: second export equals first export (idempotent)', (_rel, json) => {
    const { first, second } = roundTrip(json);
    expect(second).toEqual(first);
  });

  it.each(questionnaires)('%s: no item linkId is lost', (_rel, json) => {
    const { first } = roundTrip(json);
    const missing = linkIds(json.item).filter(id => !linkIds(first.item).includes(id));
    expect(missing).toEqual([]);
  });
});
