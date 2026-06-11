// ── Unit tests: version-compat checkers (R5 downgrade + open-choice → R5) ────
// The checkers self-register on import and are not exported individually, so
// they are exercised through versionCompatRegistry.runAll(). Each transition
// activates only one checker, which isolates the assertions.
import { describe, it, expect, beforeAll } from 'vitest';
import { versionCompatRegistry } from '../js/fhir/version-compat-registry.js';

beforeAll(async () => {
  // Import for side-effects: registers R5DowngradeChecker + OpenChoiceToR5Checker.
  await import('../js/fhir/version-compat/r5-downgrade.js');
  await import('../js/fhir/version-compat/open-choice.js');
});

const ac = (linkId, children) => ({ linkId, _answerConstraint: 'optionsOnly', children });
const oc = (children) => ({ itemType: 'open-choice', children });

describe('R5 downgrade checker (answerConstraint)', () => {
  it('does not apply when target stays R5', async () => {
    const msgs = await versionCompatRegistry.runAll('R5', 'R5', [ac('q1')]);
    expect(msgs).toEqual([]);
  });

  it('does not apply when upgrading to R5', async () => {
    const msgs = await versionCompatRegistry.runAll('R4', 'R5', [ac('q1')]);
    // Only the open-choice checker may speak here; the downgrade one is silent.
    expect(msgs.join(' ')).not.toMatch(/answerConstraint/);
  });

  it('returns no warning when no item uses answerConstraint', async () => {
    const msgs = await versionCompatRegistry.runAll('R5', 'R4', [{ linkId: 'q1' }]);
    expect(msgs).toEqual([]);
  });

  it('warns about an R4 backport extension when downgrading R5 → R4', async () => {
    const msgs = await versionCompatRegistry.runAll('R5', 'R4', [ac('q1')]);
    expect(msgs).toHaveLength(1);
    expect(msgs[0]).toContain('1 item use answerConstraint');
    expect(msgs[0]).toContain('q1');
    expect(msgs[0]).toContain('R4 backport extension');
  });

  it('warns about an R4B native field when downgrading R5 → R4B', async () => {
    const msgs = await versionCompatRegistry.runAll('R5', 'R4B', [ac('q1')]);
    expect(msgs[0]).toContain('R4B native field');
  });

  it('counts affected items recursively and pluralises', async () => {
    const tree = [ac('q1', [ac('q2'), { linkId: 'q3' }])];
    const msgs = await versionCompatRegistry.runAll('R5', 'R4', tree);
    expect(msgs[0]).toContain('2 items use answerConstraint');
    expect(msgs[0]).toContain('q1');
    expect(msgs[0]).toContain('q2');
  });

  it('truncates the affected list to 3 with an ellipsis', async () => {
    const tree = [ac('q1'), ac('q2'), ac('q3'), ac('q4')];
    const msgs = await versionCompatRegistry.runAll('R5', 'R4', tree);
    expect(msgs[0]).toContain('q1, q2, q3, …');
    expect(msgs[0]).not.toContain('q4');
  });

  it('falls back to "(no linkId)" for affected items without a linkId', async () => {
    const msgs = await versionCompatRegistry.runAll('R5', 'R4', [{ _answerConstraint: 'optionsOnly' }]);
    expect(msgs[0]).toContain('(no linkId)');
  });
});

describe('open-choice → R5 checker', () => {
  it('does not apply when target is not R5', async () => {
    const msgs = await versionCompatRegistry.runAll('R4', 'R4B', [oc()]);
    expect(msgs).toEqual([]);
  });

  it('does not apply when source is already R5', async () => {
    const msgs = await versionCompatRegistry.runAll('R5', 'R5', [oc()]);
    expect(msgs).toEqual([]);
  });

  it('returns no warning when no open-choice items exist', async () => {
    const msgs = await versionCompatRegistry.runAll('R4', 'R5', [{ itemType: 'choice' }]);
    expect(msgs).toEqual([]);
  });

  it('warns (singular) for a single open-choice item upgrading to R5', async () => {
    const msgs = await versionCompatRegistry.runAll('R4', 'R5', [oc()]);
    expect(msgs).toHaveLength(1);
    expect(msgs[0]).toContain('1 open-choice item will be exported');
    expect(msgs[0]).toContain('optionsOrString');
  });

  it('counts open-choice items recursively and pluralises', async () => {
    const tree = [oc([oc(), { itemType: 'group', children: [oc()] }])];
    const msgs = await versionCompatRegistry.runAll('R4B', 'R5', tree);
    expect(msgs[0]).toContain('3 open-choice items will be exported');
  });
});
