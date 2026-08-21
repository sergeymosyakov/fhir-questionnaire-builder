// Serializes a block tree to a FHIRPath string. Pure, no DOM.
import { BlockKind } from './model.js';

export function emit(block) {
  if (!block || typeof block !== 'object') return '';
  switch (block.kind) {
    case BlockKind.ITEM_REF: return emitItemRef(block);
    case BlockKind.VARIABLE: return '%' + block.name;
    case BlockKind.LITERAL: return emitLiteral(block);
    case BlockKind.COMPARE: return `${wrap(block.left)} ${block.op} ${wrap(block.right)}`;
    case BlockKind.ARITH: return `${wrap(block.left)} ${block.op} ${wrap(block.right)}`;
    case BlockKind.LOGIC: return block.operands.map(wrapLogic).join(` ${block.op} `);
    case BlockKind.EXISTS: return `${emit(block.target)}.${block.negate ? 'empty' : 'exists'}()`;
    case BlockKind.AGGREGATE: return emitAggregate(block);
    case BlockKind.DESCENDANTS: return '%resource.descendants()';
    case BlockKind.SET_LITERAL: return emitSet(block);
    case BlockKind.PIPELINE: return emitPipeline(block);
    case BlockKind.MATH_FN: return emitMathFn(block);
    case BlockKind.RAW: return block.text || '';
    default: return '';
  }
}

// FHIRPath single-quoted string literal. Escape backslash first, then the quote
// (order matters — otherwise the backslashes we add get double-escaped).
function q(s) {
  return `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

function emitSet(b) {
  return `(${(b.members || []).map((m) => q(m)).join('|')})`;
}

function emitPipeline(b) {
  const acc = b.source.accessor ? `.${b.source.accessor}` : '';
  let out = `%resource.repeat(item).where(linkId=${q(b.source.linkId)}).answer${acc}`;
  for (const f of b.filters || []) {
    if (f.op === 'distinct') out += '.distinct()';
    else if (f.op === 'compare') out += `.where($this ${f.cmp} ${emitFilterLiteral(f)})`;
    else out += `.${f.op}(${emit(f.set)})`;
  }
  if (b.reduce) {
    out += b.reduce.fn === 'join' ? `.join(${q(b.reduce.sep ?? '')})` : `.${b.reduce.fn}()`;
  }
  return out;
}

function emitFilterLiteral(f) {
  if (f.dataType === 'string') return q(f.value);
  return String(f.value);
}

function emitAggregate(b) {
  const filter = b.filter ? `.where(${emit(b.filter)})` : '';
  return `${emit(b.source)}${filter}.${b.fn}()`;
}

function emitMathFn(b) {
  const args = b.fn === 'round' && b.arg != null ? String(b.arg) : '';
  return `${wrap(b.target)}.${b.fn}(${args})`;
}

function emitItemRef(b) {
  const at = b.answerAt || [];
  const path = b.segments.map((s, i) => `${at[i] ? '.answer' : ''}.item.where(linkId=${q(s)})`).join('');
  return `%resource${path}${b.value ? `.answer.${b.value}` : '.answer'}`;
}

function emitLiteral(b) {
  if (b.dataType === 'string') return q(b.value);
  return String(b.value);
}

// Parenthesize compound operands so intent survives FHIRPath precedence.
function wrap(b) {
  if (b && (b.kind === BlockKind.LOGIC || b.kind === BlockKind.COMPARE || b.kind === BlockKind.ARITH)) {
    return `(${emit(b)})`;
  }
  return emit(b);
}

function wrapLogic(b) {
  if (b && b.kind === BlockKind.LOGIC) return `(${emit(b)})`;
  return emit(b);
}
