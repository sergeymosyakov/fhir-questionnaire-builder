// GitHub Actions: no checkout keeps the repo token in .git, and every third-party action is pinned to a full SHA.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const DIR = '.github/workflows';
const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.yml'));

describe('workflows', () => {
  it.each(files)('%s pins every action to a commit SHA', (f) => {
    const uses = [...fs.readFileSync(path.join(DIR, f), 'utf8').matchAll(/^\s*-?\s*uses:\s*(\S+)/gm)].map((m) => m[1]);
    for (const u of uses) expect(u, u).toMatch(/@[0-9a-f]{40}$/);
  });

  it.each(files)('%s checks out without persisting credentials', (f) => {
    const lines = fs.readFileSync(path.join(DIR, f), 'utf8').split(/\r?\n/);
    lines.forEach((line, i) => {
      if (!/uses:\s*actions\/checkout@/.test(line)) return;
      expect(lines.slice(i + 1, i + 8).join('\n'), `${f}:${i + 1}`).toMatch(/persist-credentials:\s*false/);
    });
  });
});
