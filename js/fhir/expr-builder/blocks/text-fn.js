// Text and number conversion of a value: x.toString(), x.substring(start[, length]), x.toInteger() —
// e.g. the year of a date is date.toString().substring(0, 4).toInteger().
import { registerBlock } from './registry.js';
import { literal } from '../model.js';

export const TEXT_FN = 'textFn';

export const TEXT_FNS = ['toString', 'substring', 'toInteger'];

// substring's start and optional length are whole numbers written in the expression.
export const textFn = (fn, target, args = []) => ({ kind: TEXT_FN, fn, target, args: [...args] });

const WORDS = { toString: 'the text of', substring: 'part of the text of', toInteger: 'the whole number of' };

const isCount = (n) => Number.isInteger(n) && n >= 0;

// The number as written, when it reads back as the same text (not 1.0, 01 or 1e21): a call on a number sees its text.
const plainNumberText = (node, kids) => {
  let n = node;
  while (n && n.type !== 'NumberLiteral') n = kids(n).length === 1 ? kids(n)[0] : null;
  return n && String(Number(n.text)) === n.text ? n.text : null;
};

registerBlock({
  kind: TEXT_FN,
  emit: (b, { emit, wrapTarget }) => `${wrapTarget(b.target)}.${b.fn}(${b.args.map((n) => emit(literal('number', n))).join(', ')})`,
  describe: (b, { describe }) => {
    const t = describe(b.target);
    if (t == null) return null;
    const range = b.fn === 'substring' ? ` (from character ${b.args[0]}${b.args.length > 1 ? `, ${b.args[1]} characters` : ''})` : '';
    return `${WORDS[b.fn]} ${t}${range}`;
  },
  formula: (b, labelOf, text) => `${b.fn}(${[text(b.target), ...b.args].join(', ')})`,
  parsePath: ({ steps, receiver }, { toBlock, kids }) => {
    const step = steps[steps.length - 1];
    if (step?.kind !== 'func' || !TEXT_FNS.includes(step.name) || steps.some((s) => s.kind === 'bad')) return null;
    const want = step.name === 'substring' ? [1, 2] : [0];
    if (!want.includes(step.args.length)) return null;
    if (step.args.some((a) => plainNumberText(a, kids) == null)) return null;
    const args = step.args.map((a) => toBlock(a));
    if (!args.every((a) => a?.kind === 'literal' && a.dataType === 'number' && isCount(a.value))) return null;
    const target = receiver();
    if (target?.kind === 'literal' && target.dataType === 'number') return null; // its written form is observable here
    return target ? textFn(step.name, target, args.map((a) => a.value)) : null;
  },
});
