// FHIR tooltips: every literal data-tip-fhir is a dotted FHIR path, every literal data-tip-spec starts with R4, SDC or R5.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p); else if (p.endsWith('.js')) files.push(p);
  }
})('js');
const source = files.map((f) => [f, fs.readFileSync(f, 'utf8')]);

const literals = (re) => source.flatMap(([f, text]) => [...text.matchAll(re)].map((m) => `${f}: ${m[1]}`));

describe('tooltip attributes', () => {
  it('data-tip-fhir values are dotted FHIR paths', () => {
    const bad = literals(/tipFhir\s*[:=]\s*'([^'\n]+)'/g).filter((l) => !/^[^:]+: (Questionnaire(Response)? |[A-Za-z]+\.[A-Za-z])/.test(l));
    expect(bad).toEqual([]);
  });
  it('data-tip-spec values start with R4, SDC or R5', () => {
    const bad = literals(/tipSpec\s*[:=]\s*'([^'\n]+)'/g).filter((l) => !/^[^:]+: (R4|SDC|R5)/.test(l));
    expect(bad).toEqual([]);
  });
});
