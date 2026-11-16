// A calculation as a short formula for people: "Weight (kg) ÷ ((Height (cm) ÷ 100) × (Height (cm) ÷ 100))".
// Pure, no DOM. A block it does not know is shown as its FHIRPath, so nothing is ever hidden or invented.
import { BlockKind } from './model.js';
import { emit } from './emit.js';

const SYMBOL = { '+': '+', '-': '−', '*': '×', '/': '÷' };
const FN_WORDS = { round: 'round', abs: 'absolute value', ceiling: 'round up', floor: 'round down', truncate: 'truncate' };

/** @param {object} block @param {(linkId: string) => string} labelOf the question's title for a linkId */
export function formulaText(block, labelOf = (id) => id) {
  const operand = (b) => (b?.kind === BlockKind.ARITH ? `(${text(b)})` : text(b));
  const text = (b) => {
    if (!b) return '';
    switch (b.kind) {
      case BlockKind.ITEM_REF: return labelOf(b.segments.at(-1));
      case BlockKind.VARIABLE: return '%' + b.name;
      case BlockKind.LITERAL: return b.dataType === 'string' ? `"${b.value}"` : String(b.value);
      case BlockKind.ARITH: return `${operand(b.left)} ${SYMBOL[b.op] ?? b.op} ${operand(b.right)}`;
      case BlockKind.MATH_FN: return b.fn === 'round' && b.arg != null ? `round(${text(b.target)}, ${b.arg})` : `${FN_WORDS[b.fn] ?? b.fn}(${text(b.target)})`;
      case BlockKind.AGGREGATE: return `${b.fn} of ${b.source?.kind === BlockKind.ITEM_REF ? labelOf(b.source.segments.at(-1)) : emit(b.source)}`;
      default: return emit(b);
    }
  };
  return text(block);
}
