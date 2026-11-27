// Widget releases carry hand-written notes: the workflow requires them and never lists commits.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';

const read = (name) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const notes = readdirSync(new URL('../docs/releases/widget/', import.meta.url)).filter((f) => f.endsWith('.md'));

describe('release-widget workflow', () => {
  const wf = read('.github/workflows/release-widget.yml');
  const step = (name) => { const at = wf.indexOf(`- name: ${name}`); return at < 0 ? '' : wf.slice(at, wf.indexOf('\n      - ', at + 1)); };

  it('does not generate a commit list; the release body is the notes file', () => {
    expect(wf).not.toMatch(/generate-notes/);
    expect(step('Create release')).toContain('docs/releases/widget/$SEMVER.md');
  });

  it('checks for the notes (not on a NuGet-only republish), after the version and before install and tests', () => {
    const check = step('Release notes are written');
    expect(check).toContain('docs/releases/widget/${SEMVER}.md');
    expect(check).toContain('!inputs.nuget_only');
    expect(check).toContain('SEMVER: ${{ steps.ver.outputs.semver }}');
    const at = (needle) => wf.indexOf(needle);
    expect(at('- name: Compute version')).toBeLessThan(at('- name: Release notes are written'));
    expect(at('- name: Release notes are written')).toBeLessThan(at('- run: npm ci'));
  });
});

describe('widget release notes', () => {
  it('there is a notes file', () => {
    expect(notes.length).toBeGreaterThan(0);
  });

  it.each(notes)('%s is written for readers, not a list of commits', (file) => {
    expect(file).toMatch(/^\d+\.\d+\.\d+\.md$/);
    const text = read(`docs/releases/widget/${file}`);
    expect(text).not.toMatch(/^# /m); // the GitHub Release already has the title
    expect(text.split('\n')[0].length).toBeGreaterThan(40); // starts with a summary paragraph
    expect(text).not.toMatch(/What's Changed|Full Changelog|\bby @\w+ in https?:/i); // GitHub's generated list
    expect(text).toMatch(/^## API$/m);
    expect(text.split('\n').filter((l) => l.startsWith('- ')).length).toBeGreaterThan(3);
  });
});
