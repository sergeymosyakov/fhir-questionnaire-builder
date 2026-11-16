// A result kept only if it passes a test: target.where($this <op> number), e.g. drop a negative result.
import { registerBlock } from './registry.js';
import { COMPARE_OPS, literal, BlockKind } from '../model.js';

export const KEEP_IF = 'keepIf';

export const keepIf = (target, op, value) => ({ kind: KEEP_IF, target, op, value });

export const KEEP_IF_WORDS = { '>=': 'at least', '>': 'more than', '<=': 'at most', '<': 'less than', '=': 'equal to', '!=': 'not equal to' };

// `$this` itself: only plain term wrappers are looked through, never a sign or an operator.
const TERM_WRAPPERS = new Set(['TermExpression', 'InvocationTerm', 'ParenthesizedTerm']);
const isThis = (node, kids) => {
  let n = node;
  while (n && TERM_WRAPPERS.has(n.type)) n = kids(n).length === 1 ? kids(n)[0] : null;
  return n?.type === 'ThisInvocation';
};

registerBlock({
  kind: KEEP_IF,
  emit: (b, { emit, wrapTarget }) => `${wrapTarget(b.target)}.where($this ${b.op} ${emit(literal('number', b.value))})`,
  describe: (b, { describe }) => {
    const t = describe(b.target);
    return t == null ? null : `${t}, kept only if it is ${KEEP_IF_WORDS[b.op]} ${b.value}`;
  },
  formula: (b, labelOf, text) => `${text(b.target)} (only if ${b.op} ${b.value})`,
  parsePath: ({ steps, receiver }, { toBlock, kids }) => {
    const step = steps[steps.length - 1];
    if (step?.kind !== 'func' || step.name !== 'where' || step.args.length !== 1 || steps.some((s) => s.kind === 'bad')) return null;
    const test = step.args[0];
    if (!['EqualityExpression', 'InequalityExpression'].includes(test.type) || !COMPARE_OPS.includes(test.text) || kids(test).length !== 2) return null;
    if (!isThis(kids(test)[0], kids)) return null;
    const value = toBlock(kids(test)[1]);
    if (value?.kind !== BlockKind.LITERAL || value.dataType !== 'number') return null;
    const target = receiver();
    return target ? keepIf(target, test.text, value.value) : null;
  },
});
