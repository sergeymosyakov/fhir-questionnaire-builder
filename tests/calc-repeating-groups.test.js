// Calculated values inside repeating groups: computed per entry, from that entry's own answers.
import { describe, it, expect } from 'vitest';
import { evalCalcNodes, buildCalcCache } from '../js/fhir/calc.js';
import { buildQR } from '../js/fhir/qr-builder.js';
import { loadFhirpath } from './helpers/fhirpath-node.js';

const fp = loadFhirpath();
const ref = (id) => `%resource.repeat(item).where(linkId='${id}').answer.valueDecimal`;
const num = (id, extra = {}) => ({ id, type: 'item', itemType: 'decimal', children: [], ...extra });
const group = (id, repeats, children) => ({ id, type: 'group', repeats, children });

const base = {
  resourceType: 'Questionnaire',
  item: [
    { linkId: 'rate', type: 'decimal' },
    { linkId: 'rate10', type: 'decimal' },
    { linkId: 'lines', type: 'group', repeats: true, item: [
      { linkId: 'qty', type: 'decimal' },
      { linkId: 'total', type: 'decimal' },
      { linkId: 'viaOutside', type: 'decimal' },
      { linkId: 'tags', type: 'group', repeats: true, item: [{ linkId: 'w', type: 'decimal' }, { linkId: 'w2', type: 'decimal' }] },
    ] },
    { linkId: 'grand', type: 'decimal' },
    { linkId: 'sumW2', type: 'decimal' },
  ],
};
const tree = [
  num('rate'),
  num('rate10', { _calculatedExpr: `${ref('rate')} * 10` }),
  group('lines', true, [
    num('qty'),
    num('total', { _calculatedExpr: `${ref('qty')} * ${ref('rate')}` }),
    num('viaOutside', { _calculatedExpr: `${ref('rate10')} + ${ref('qty')}` }),
    group('tags', true, [num('w'), num('w2', { _calculatedExpr: `${ref('w')} * ${ref('qty')}` })]),
  ]),
  num('grand', { _calculatedExpr: `${ref('total')}.sum()` }),
  num('sumW2', { _calculatedExpr: `${ref('w2')}.sum()` }),
];

const run = (values) => {
  const qr = buildQR(base, values);
  evalCalcNodes(tree, qr, fp, values, {}, base, buildCalcCache(tree));
  return { values, qr };
};

describe('calculated values inside repeating groups', () => {
  it('computes each entry from its own answers and the fields outside the group', () => {
    const { values } = run({ rate: [2], lines: [{ qty: [3] }, { qty: [8] }] });
    expect(values.lines.map((l) => l.total)).toEqual([['6'], ['16']]);
    expect(values.total).toBeUndefined();
  });

  it('computes a nested repeating group from its own answer and the entry it sits in', () => {
    const { values } = run({ rate: [1], lines: [{ qty: [3], tags: [{ w: [2] }] }, { qty: [8], tags: [{ w: [2] }, { w: [5] }] }] });
    expect(values.lines[0].tags.map((t) => t.w2)).toEqual([['6']]);
    expect(values.lines[1].tags.map((t) => t.w2)).toEqual([['16'], ['40']]);
  });

  it('writes a nested entry\'s result into the response where a calculation outside the group reads it', () => {
    const { values, qr } = run({ rate: [1], lines: [{ qty: [3], tags: [{ w: [2] }] }, { qty: [8], tags: [{ w: [2] }, { w: [5] }] }] });
    expect(values.sumW2).toEqual('62'); // 6 + 16 + 40
    const second = qr.item.filter((i) => i.linkId === 'lines')[1];
    expect(second.item.filter((i) => i.linkId === 'tags').map((t) => t.item.find((c) => c.linkId === 'w2').answer[0].valueDecimal)).toEqual([16, 40]);
  });

  it('lets a calculation outside the group see every entry\'s computed value', () => {
    const { values } = run({ rate: [2], lines: [{ qty: [3] }, { qty: [8] }] });
    expect(values.grand).toEqual('22');
  });

  it('writes each entry\'s result into the matching entry of the response', () => {
    const { qr } = run({ rate: [2], lines: [{ qty: [3] }, { qty: [8] }] });
    const totals = qr.item.filter((i) => i.linkId === 'lines').map((l) => l.item.find((c) => c.linkId === 'total').answer[0].valueDecimal);
    expect(totals).toEqual([6, 16]);
  });

  it('leaves an entry blank while its inputs are missing, without touching the others', () => {
    const { values } = run({ rate: [2], lines: [{}, { qty: [8] }] });
    expect(values.lines[0].total).toEqual(['']);
    expect(values.lines[1].total).toEqual(['16']);
  });

  it('lets an entry use a value another calculation computed outside the group', () => {
    const { values } = run({ rate: [2], lines: [{ qty: [3] }, { qty: [8] }] });
    expect(values.lines.map((l) => l.viaOutside)).toEqual([['23'], ['28']]);
  });

  it('shows a calculation the values computed after an unrelated calculation already used the same entry', () => {
    const t = [num('rate'), group('lines', true, [
      num('qty'),
      num('c0', { _calculatedExpr: `${ref('qty')} + 1` }), // runs first and reads the entry
      group('tags', true, [num('w'), num('w1', { _calculatedExpr: `${ref('w')} + 1` })]),
      num('late', { _calculatedExpr: `${ref('w1')}.sum() + ${ref('qty')}` }),
    ])];
    const b = { resourceType: 'Questionnaire', item: [{ linkId: 'rate', type: 'decimal' }, { linkId: 'lines', type: 'group', repeats: true, item: [
      { linkId: 'qty', type: 'decimal' }, { linkId: 'c0', type: 'decimal' },
      { linkId: 'tags', type: 'group', repeats: true, item: [{ linkId: 'w', type: 'decimal' }, { linkId: 'w1', type: 'decimal' }] },
      { linkId: 'late', type: 'decimal' }] }] };
    const values = { rate: [1], lines: [{ qty: [10], tags: [{ w: [1] }, { w: [2] }] }, { qty: [1], tags: [{ w: [4] }] }] };
    evalCalcNodes(t, buildQR(b, values), fp, values, {}, b, buildCalcCache(t));
    expect(values.lines.map((l) => l.tags.map((x) => x.w1))).toEqual([[['2'], ['3']], [['5']]]);
    expect(values.lines.map((l) => l.late)).toEqual([['15'], ['6']]); // (2 + 3) + 10, 5 + 1
  });

  it('evaluates once over the whole form when the group has no entries yet', () => {
    const { values } = run({ rate: [2] });
    expect(values.lines).toBeUndefined();
    expect(values.rate10).toEqual('20'); // outside calculations still run
  });
});
