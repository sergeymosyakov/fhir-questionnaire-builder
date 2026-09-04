// ── Plain-English descriptions of expression-builder blocks ───────────────────
// Sibling to emit.js (blocks → FHIRPath): this turns the same block model into
// a human-readable sentence. Returns null for a `raw` block (or any block that
// contains one) — callers show the FHIRPath code with no fabricated guess.
import { BlockKind } from './model.js';

// Exported so doc-generator.js can phrase standard enableWhen[] comparisons
// with the exact same words, keeping both condition mechanisms consistent.
export const COMPARE_WORDS = { '=': 'equals', '!=': 'does not equal', '>': 'is greater than', '<': 'is less than', '>=': 'is at least', '<=': 'is at most' };
const ARITH_WORDS = { '+': 'plus', '-': 'minus', '*': 'multiplied by', '/': 'divided by' };
const AGG_WORDS = { count: 'the count of', sum: 'the sum of', avg: 'the average of', min: 'the minimum of', max: 'the maximum of' };
const MATH_WORDS = { abs: 'the absolute value of', ceiling: 'rounded up', floor: 'rounded down', truncate: 'truncated to a whole number' };

function title(linkId, linkIdMap) {
  return '\u00AB' + ((linkIdMap && linkIdMap[linkId]) || linkId) + '\u00BB';
}

function describeItemRef(b, linkIdMap) {
  return 'the answer to ' + b.segments.map(s => title(s, linkIdMap)).join(' \u2192 ');
}

function describePipeline(b, linkIdMap) {
  let desc = 'the answers to ' + title(b.source.linkId, linkIdMap);
  for (const f of b.filters || []) {
    if (f.op === 'distinct') desc += ', made unique';
    else if (f.op === 'compare') {
      const val = f.dataType === 'string' ? `"${f.value}"` : f.value;
      desc += `, kept only where the value ${COMPARE_WORDS[f.cmp] || f.cmp} ${val}`;
    } else if (f.op === 'intersect') desc += ', keeping only ' + describeBlock(f.set, linkIdMap);
    else if (f.op === 'exclude') desc += ', excluding ' + describeBlock(f.set, linkIdMap);
  }
  if (b.reduce?.fn === 'join') desc = `the${b.reduce.sep ? ` "${b.reduce.sep}"-joined` : ' joined'} list of ${desc}`;
  else if (b.reduce?.fn === 'count') desc = `the count of ${desc}`;
  else if (b.reduce?.fn === 'exists') desc = `whether ${desc} has any answers`;
  else if (b.reduce?.fn === 'first') desc = `the first of ${desc}`;
  else if (b.reduce?.fn === 'last') desc = `the last of ${desc}`;
  return desc;
}

export function describeBlock(block, linkIdMap = {}) {
  if (!block || typeof block !== 'object') return null;
  switch (block.kind) {
    case BlockKind.RAW: return null;
    case BlockKind.ITEM_REF: return describeItemRef(block, linkIdMap);
    case BlockKind.VARIABLE: return 'the variable %' + block.name;
    case BlockKind.LITERAL: return block.dataType === 'string' ? `"${block.value}"` : block.dataType === 'boolean' ? (block.value ? 'Yes' : 'No') : String(block.value);
    case BlockKind.DESCENDANTS: return 'all items in the questionnaire';
    case BlockKind.SET_LITERAL: return 'one of: ' + block.members.map(m => `"${m}"`).join(', ');
    case BlockKind.PIPELINE: return describePipeline(block, linkIdMap);
    case BlockKind.COMPARE: {
      const l = describeBlock(block.left, linkIdMap), r = describeBlock(block.right, linkIdMap);
      return (l == null || r == null) ? null : `${l} ${COMPARE_WORDS[block.op] || block.op} ${r}`;
    }
    case BlockKind.ARITH: {
      const l = describeBlock(block.left, linkIdMap), r = describeBlock(block.right, linkIdMap);
      return (l == null || r == null) ? null : `${l} ${ARITH_WORDS[block.op] || block.op} ${r}`;
    }
    case BlockKind.LOGIC: {
      const parts = block.operands.map(o => describeBlock(o, linkIdMap));
      return parts.some(p => p == null) ? null : parts.join(block.op === 'or' ? ' OR ' : ' AND ');
    }
    case BlockKind.EXISTS: {
      const t = describeBlock(block.target, linkIdMap);
      return t == null ? null : t + (block.negate ? ' has no answer' : ' has an answer');
    }
    case BlockKind.AGGREGATE: {
      const src = block.source?.kind === BlockKind.DESCENDANTS ? 'all items in the questionnaire' : describeBlock(block.source, linkIdMap);
      if (src == null) return null;
      const filter = block.filter ? describeBlock(block.filter, linkIdMap) : null;
      const base = `${AGG_WORDS[block.fn] || block.fn} ${src}`;
      return filter != null ? `${base} where ${filter}` : base;
    }
    case BlockKind.MATH_FN: {
      const t = describeBlock(block.target, linkIdMap);
      if (t == null) return null;
      if (block.fn === 'round') return `${t} rounded${block.arg != null ? ' to ' + block.arg + ' decimal place' + (block.arg === 1 ? '' : 's') : ''}`;
      return `${MATH_WORDS[block.fn] || block.fn} ${t}`;
    }
    default: return null;
  }
}
