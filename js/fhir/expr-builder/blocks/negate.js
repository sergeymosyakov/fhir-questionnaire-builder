// A negation: -value. A bare negative number is read as a number, not as a negation of one.
import { registerBlock } from './registry.js';
import { literal, BlockKind } from '../model.js';

export const NEGATE = 'negate';

export const negate = (target) => ({ kind: NEGATE, target });

const compound = (b) => b?.kind === BlockKind.ARITH;

// The number a `-` is applied to directly, when it is just a number literal.
const numberOf = (node, { kids }) => {
  let t = node;
  if (t?.type === 'TermExpression') t = kids(t)[0];
  const lit = t?.type === 'LiteralTerm' ? kids(t)[0] : null;
  return lit?.type === 'NumberLiteral' ? Number(lit.text) : null;
};

registerBlock({
  kind: NEGATE,
  emit: (b, { wrapTarget }) => `-${wrapTarget(b.target)}`,
  describe: (b, { describe }) => {
    const t = describe(b.target);
    return t == null ? null : `minus ${compound(b.target) ? `(${t})` : t}`;
  },
  formula: (b, labelOf, text) => `−${compound(b.target) ? `(${text(b.target)})` : text(b.target)}`,
  parseNode: (node, ctx) => {
    if (node.type !== 'PolarityExpression' || node.text !== '-') return null;
    const operand = ctx.kids(node)[0];
    const n = numberOf(operand, ctx);
    if (n != null) return literal('number', -n);
    const target = ctx.toBlock(operand);
    return target ? negate(target) : null;
  },
});
