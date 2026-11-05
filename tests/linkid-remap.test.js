import { describe, it, expect } from 'vitest';
import { remapSubtree, collectLinkIds, linkIdRefsIn } from '../js/fhir/linkid-remap.js';

const CALC = 'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-calculatedExpression';
const fragment = () => ({
  linkId: 'g', type: 'group', item: [
    { linkId: 'a', type: 'integer' },
    {
      linkId: 'b', type: 'integer', enableWhen: [{ question: 'a', operator: 'exists', answerBoolean: true }],
      extension: [
        { url: CALC, valueExpression: { language: 'text/fhirpath', expression: "%resource.repeat(item).where(linkId='a').answer.value + %resource.repeat(item).where(linkId = \"outside\").answer.value" } },
        { url: 'http://hl7.org/fhir/StructureDefinition/questionnaire-constraint', extension: [
          { url: 'expression', valueString: "item.where(linkId='a').exists()" },
          { url: 'human', valueString: "linkId='a' stays in prose" },
        ] },
      ],
    },
  ],
});

describe('remapSubtree — suffix strategy', () => {
  it('keeps ids unchanged when nothing collides', () => {
    const { remapped, idMap } = remapSubtree(fragment(), ['x', 'y']);
    expect(remapped).toEqual(fragment());
    expect([...idMap.values()]).toEqual(['g', 'a', 'b']);
  });

  it('adds ONE shared suffix to every id on collision and rewrites all references', () => {
    const { remapped, idMap } = remapSubtree(fragment(), ['a']);
    const suffix = idMap.get('g').slice('g-'.length);
    expect(suffix).toMatch(/^[0-9a-z]{4}$/);
    expect(collectLinkIds(remapped)).toEqual([`g-${suffix}`, `a-${suffix}`, `b-${suffix}`]);
    const b = remapped.item[1];
    expect(b.enableWhen[0].question).toBe(`a-${suffix}`);
    expect(b.extension[0].valueExpression.expression)
      .toBe(`%resource.repeat(item).where(linkId='a-${suffix}').answer.value + %resource.repeat(item).where(linkId = "outside").answer.value`);
    expect(b.extension[1].extension[0].valueString).toBe(`item.where(linkId='a-${suffix}').exists()`);
    expect(b.extension[1].extension[1].valueString).toBe("linkId='a' stays in prose");
  });

  it('does not mutate the input and never collides with existing ids', () => {
    const input = fragment();
    const existing = new Set(['a']);
    for (let i = 0; i < 50; i++) {
      const { idMap } = remapSubtree(input, existing);
      for (const id of idMap.values()) expect(existing.has(id)).toBe(false);
    }
    expect(input).toEqual(fragment());
  });
});

describe('remapSubtree — copy strategy', () => {
  it('uses -copy, then -copy-2 for taken ids', () => {
    const first = remapSubtree(fragment(), ['g', 'a', 'b'], 'copy');
    expect(collectLinkIds(first.remapped)).toEqual(['g-copy', 'a-copy', 'b-copy']);
    const second = remapSubtree(fragment(), ['g', 'a', 'b', 'g-copy', 'a-copy', 'b-copy'], 'copy');
    expect(collectLinkIds(second.remapped)).toEqual(['g-copy-2', 'a-copy-2', 'b-copy-2']);
  });

  it('rewrites expression references to copied ids', () => {
    const { remapped } = remapSubtree(fragment(), ['g', 'a', 'b'], 'copy');
    expect(remapped.item[1].extension[0].valueExpression.expression).toContain("linkId='a-copy'");
  });
});

describe('linkId in (...) lists', () => {
  const listFragment = () => ({
    linkId: 'g', type: 'group', item: [
      { linkId: 'a', type: 'integer' },
      { linkId: 'b', type: 'integer' },
      { linkId: 't', type: 'decimal', extension: [{ url: CALC, valueExpression: { language: 'text/fhirpath', expression: "%resource.repeat(item).where(linkId in ('a' | \"b\" | 'outside')).answer.value.sum()" } }] },
    ],
  });

  it('rewrites every in-subtree id in the list and leaves outside ids alone', () => {
    const { remapped } = remapSubtree(listFragment(), ['a'], 'suffix');
    const s = remapped.item[0].linkId.slice('a-'.length);
    expect(remapped.item[2].extension[0].valueExpression.expression)
      .toBe(`%resource.repeat(item).where(linkId in ('a-${s}' | "b-${s}" | 'outside')).answer.value.sum()`);
  });

  it('reports the ids of list references', () => {
    expect(linkIdRefsIn("x.where(linkId in ('p' | \"q\")) and y.where(linkId='r')").sort()).toEqual(['p', 'q', 'r']);
  });
});

describe('linkIdRefsIn', () => {
  it('finds single- and double-quoted refs', () => {
    expect(linkIdRefsIn(`x.where(linkId='p') and y.where(linkId = "q")`)).toEqual(['p', 'q']);
  });
});
