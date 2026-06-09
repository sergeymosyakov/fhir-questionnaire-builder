// ── Unit tests: REDCap branching-logic ↔ FHIR enableWhen ─────────────────────
import { describe, it, expect } from 'vitest';
import { branchingToEnableWhen, enableWhenToBranching } from '../js/fhir/converters/redcap/branching-logic.js';

describe('branchingToEnableWhen', () => {
  it('returns null for empty string', () => {
    expect(branchingToEnableWhen('')).toBeNull();
    expect(branchingToEnableWhen(null)).toBeNull();
  });

  it('parses simple equality check (string value)', () => {
    const result = branchingToEnableWhen("[gender] = '1'");
    expect(result).not.toBeNull();
    expect(result.enableWhen).toHaveLength(1);
    expect(result.enableWhen[0].question).toBe('gender');
    expect(result.enableWhen[0].operator).toBe('equal');
    expect(result.enableWhen[0].answerCoding).toEqual({ code: '1' });
    expect(result.enableBehavior).toBe('all');
  });

  it('parses >= with numeric value', () => {
    const result = branchingToEnableWhen('[age] >= 18');
    expect(result.enableWhen[0].operator).toBe('>=');
    expect(result.enableWhen[0].answerDecimal).toBe(18);
  });

  it('parses <> (not-equal)', () => {
    const result = branchingToEnableWhen("[status] <> '0'");
    expect(result.enableWhen[0].operator).toBe('not-equal');
  });

  it('parses != (not-equal alternative)', () => {
    const result = branchingToEnableWhen("[status] != '0'");
    expect(result.enableWhen[0].operator).toBe('not-equal');
  });

  it('parses AND joining two clauses → enableBehavior=all', () => {
    const result = branchingToEnableWhen("[age] >= 18 AND [consent] = '1'");
    expect(result.enableBehavior).toBe('all');
    expect(result.enableWhen).toHaveLength(2);
  });

  it('parses OR joining two clauses → enableBehavior=any', () => {
    const result = branchingToEnableWhen("[a] = '1' OR [b] = '2'");
    expect(result.enableBehavior).toBe('any');
    expect(result.enableWhen).toHaveLength(2);
  });

  it('returns null for mixed AND/OR (too complex)', () => {
    expect(branchingToEnableWhen("[a] = '1' AND [b] = '2' OR [c] = '3'")).toBeNull();
  });

  it('handles parenthesised single clause', () => {
    const result = branchingToEnableWhen("([gender] = '1')");
    expect(result).not.toBeNull();
    expect(result.enableWhen[0].question).toBe('gender');
  });

  it('parses < and > operators', () => {
    const r1 = branchingToEnableWhen('[score] < 10');
    const r2 = branchingToEnableWhen('[score] > 5');
    expect(r1.enableWhen[0].operator).toBe('<');
    expect(r2.enableWhen[0].operator).toBe('>');
  });
});

describe('enableWhenToBranching', () => {
  it('returns empty string for empty array', () => {
    expect(enableWhenToBranching([], 'all')).toBe('');
    expect(enableWhenToBranching(null, 'all')).toBe('');
  });

  it('converts single equal condition', () => {
    const result = enableWhenToBranching([
      { question: 'gender', operator: 'equal', answerCoding: { code: '1' } },
    ], 'all');
    expect(result).toBe("[gender] = '1'");
  });

  it('converts numeric >= condition', () => {
    const result = enableWhenToBranching([
      { question: 'age', operator: '>=', answerDecimal: 18 },
    ], 'all');
    expect(result).toBe('[age] >= 18');
  });

  it('wraps multiple conditions with AND', () => {
    const result = enableWhenToBranching([
      { question: 'age', operator: '>=', answerDecimal: 18 },
      { question: 'consent', operator: 'equal', answerCoding: { code: '1' } },
    ], 'all');
    expect(result).toBe("([age] >= 18) AND ([consent] = '1')");
  });

  it('wraps multiple conditions with OR', () => {
    const result = enableWhenToBranching([
      { question: 'a', operator: 'equal', answerCoding: { code: '1' } },
      { question: 'b', operator: 'equal', answerCoding: { code: '2' } },
    ], 'any');
    expect(result).toBe("([a] = '1') OR ([b] = '2')");
  });

  it('round-trips: branching → enableWhen → branching', () => {
    const original = "[age] >= 18 AND [consent] = '1'";
    const ew = branchingToEnableWhen(original);
    const back = enableWhenToBranching(ew.enableWhen, ew.enableBehavior);
    // The reconstructed string may differ in whitespace/parens but should parse identically
    const ew2 = branchingToEnableWhen(back);
    expect(ew2.enableWhen[0].question).toBe(ew.enableWhen[0].question);
    expect(ew2.enableWhen[1].question).toBe(ew.enableWhen[1].question);
  });
});
