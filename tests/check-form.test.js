// "Check my form": generated answer sets reach every text result of a calculation, and an unreachable one is reported.
import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { loadFhirpath } from './helpers/fhirpath-node.js';

globalThis.CustomEvent = class CustomEvent { constructor(type, init) { this.type = type; this.detail = init?.detail; } };
const _listeners = {};
globalThis.document = {
  dispatchEvent(e) { (_listeners[e.type] || []).forEach((fn) => fn(e)); },
  addEventListener(type, fn) { (_listeners[type] = _listeners[type] || []).push(fn); },
};
const questDoc = { tree: [], meta: {}, rawFhir: null, variables: [], contained: [], translations: {} };
vi.mock('../js/ui/toast.js', () => ({ showError: vi.fn(), showWarn: vi.fn(), showInfo: vi.fn() }));
vi.mock('../js/builder/index.js', () => ({ renderTree: vi.fn() }));
const { importFHIR } = await import('../js/fhir/import.js');
const { AppEvents, EventState } = await import('../js/events.js');
const { checkForm } = await import('../js/fhir/check/reachability.js');
const { buildReport } = await import('../js/fhir/check/report.js');
EventState._set(AppEvents.APP_CONTEXT_READY, { questDoc });

const fp = loadFhirpath();
const DIR = path.resolve('templates');
const read = (name) => fs.readFileSync(path.join(DIR, `${name}.template.json`), 'utf8');
const run = (json) => {
  const base = JSON.parse(json);
  importFHIR(base);
  return checkForm({ tree: questDoc.tree, base, fp, variables: questDoc.variables });
};

describe('check my form', () => {
  it('reaches every result band of PHQ-9', async () => {
    const { calcs } = await run(read('phq-9'));
    const sev = calcs.find((c) => c.id === 'phq9-severity');
    expect(sev.status).toBe('ok');
    expect(sev.reached).toHaveLength(5);
    expect(calcs.every((c) => c.status === 'ok')).toBe(true);
  });

  it('reports a band that no answers can produce (threshold moved)', async () => {
    const json = read('phq-9');
    expect(json).toContain('< 15');
    const { calcs } = await run(json.replace('< 15', '< 10'));
    const bad = calcs.find((c) => c.id === 'phq9-severity');
    expect(bad.status).toBe('unreachable');
    expect(bad?.missed).toContain('Moderate depression');
    expect(bad.details.find((d) => d.text === 'Moderate depression').when).toBe('PHQ-9 total score < 10');
  });

  it('lists every answer set with a result per calculation, and the results that never appeared', async () => {
    const result = await run(read('phq-9').replace('< 15', '< 10'));
    const report = buildReport({ tree: questDoc.tree, result, title: 'PHQ-9', questionnaire: { resourceType: 'Questionnaire' } });
    expect(report.questionnaire).toEqual({ resourceType: 'Questionnaire' });
    const ids = report.calcs.map((c) => c.id);
    expect(ids).toEqual(['phq9-total', 'phq9-severity']);
    expect(report.trials).toHaveLength(report.scenarios);
    expect(report.trials.every((t) => t.results.length === ids.length)).toBe(true); // one column per calculation
    const sevCol = ids.indexOf('phq9-severity');
    const seen = new Set(report.trials.map((t) => t.results[sevCol]));
    expect(seen).toContain('Mild depression');
    expect(seen).not.toContain('Moderate depression');
    const row = report.trials.find((t) => t.results[sevCol] === 'Mild depression');
    expect(row.answers[0]).toMatch(/ = /); // "Question = answer", one entry per question
    expect(report.trials[0]).toMatchObject({ answers: [], results: [null, null] }); // nothing answered, nothing calculated
    const sev = report.calcs[sevCol];
    expect(sev.missed[0]).toMatchObject({ text: 'Moderate depression', when: 'PHQ-9 total score < 10' });
    expect(sev.seen.reduce((n, r) => n + r.count, 0)).toBe(report.scenarios);
  });

  it('finds no problems in any shipped template', async () => {
    const names = fs.readdirSync(DIR).filter((f) => f.endsWith('.template.json')).map((f) => f.replace('.template.json', ''));
    const lines = [];
    for (const name of names) {
      const { calcs } = await run(read(name));
      for (const c of calcs) if (c.status === 'unreachable' || c.status === 'no-result') lines.push(`${name}/${c.id}: ${c.status} ${c.missed ?? ''}`);
    }
    expect(lines).toEqual([]);
    expect(names.length).toBeGreaterThan(10);
  }, 120000);
});
