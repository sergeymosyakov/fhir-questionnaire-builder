// Combination of several values into one set: (a | b | c).
import { registerBlock } from './registry.js';
import { BlockKind } from '../model.js';

export const UNION = 'union';

export const union = (operands) => ({ kind: UNION, operands: [...operands] });

const list = (parts) => parts.length > 1 ? `${parts.slice(0, -1).join(', ')} or ${parts[parts.length - 1]}` : parts[0];

// A question reads as its title, anything else as its own description.
const COMPOUND = new Set([BlockKind.ARITH, BlockKind.COMPARE, BlockKind.LOGIC]);
const label = (b, { describe, title }) => {
  if (b.kind === BlockKind.ITEM_REF) return b.segments.map(title).join(' → ');
  const text = describe(b);
  return text != null && COMPOUND.has(b.kind) ? `(${text})` : text;
};

registerBlock({
  kind: UNION,
  // `|` binds tighter than comparisons and and/or, so those operands need their own parentheses.
  emit: (b, { wrap }) => `(${b.operands.map(wrap).join(' | ')})`,
  describe: (b, ctx) => {
    const parts = b.operands.map((o) => label(o, ctx));
    return parts.some((p) => p == null) ? null : `any of ${list(parts)}`;
  },
  describeExists: (b, negate, ctx) => {
    const parts = b.operands.map((o) => label(o, ctx));
    if (parts.some((p) => p == null)) return null;
    return negate ? `none of ${list(parts)} has an answer` : `at least one of ${list(parts)} has an answer`;
  },
  // `a | b | c` parses left-nested; flatten into one N-ary block.
  parseNode: (node, { toBlock, kids }) => {
    if (node.type !== 'UnionExpression') return null;
    const left = toBlock(kids(node)[0]);
    const right = toBlock(kids(node)[1]);
    if (!left || !right) return null;
    return union([...(left.kind === UNION ? left.operands : [left]), right]);
  },
});
