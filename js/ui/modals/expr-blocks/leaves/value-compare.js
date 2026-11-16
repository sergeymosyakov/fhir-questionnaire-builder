// Leaf "<a calculated value> <op> <number>", e.g. weight ÷ (height × height) < 18.5. The left side is a value chain,
// so a band's threshold reads as a sentence instead of a long expression.
import { registerLeafKind } from './registry.js';
import { LeafKind } from './leaf-kind.js';
import { renderCalc } from './calc-view.js';
import { createCustomSelect } from '../../../custom-select.js';
import { compare, literal, itemRef, BlockKind, COMPARE_OPS } from '../../../../fhir/expr-builder/model.js';
import { valueAccessor } from '../../../../fhir/expr-builder/value-paths.js';

const OP_LABEL = { '=': '=', '!=': '≠', '>': '>', '<': '<', '>=': '≥', '<=': '≤' };
// The calculation's edits must reach the leaf (so the condition text is refreshed), not just the outer editor:
// the chain is made first, so its callback is bound to the leaf late.
function withChain(ctx, make) {
  let leaf = null;
  const chain = ctx.createChain({ inlineAdd: true, chainTestid: 'eb-leaf-chain', onChange: () => leaf?.changed() });
  leaf = make(chain);
  return leaf;
}

export class ValueCompareLeaf extends LeafKind {
  static id = 'value-compare';
  static switchLabel = 'compare a calculation';
  static available(ctx) { return !!ctx?.createChain; }

  // A question already chosen in the row being replaced starts the calculation.
  static create(items, from, ctx) {
    const leaf = withChain(ctx, (chain) => new ValueCompareLeaf(items, chain, from?.op && COMPARE_OPS.includes(from.op) ? from.op : '<', ''));
    if (from?.item) leaf.chain.setBlock(itemRef(from.item.segments, valueAccessor(from.item.itemType), from.item.answerAt));
    leaf.open = true; // a new leaf is built, not just read
    return leaf;
  }

  // A plain "question <op> value" is the ordinary row; this is for a calculation on the left.
  static fromBlock(block, items, ctx) {
    if (block.kind !== BlockKind.COMPARE || block.left.kind === BlockKind.ITEM_REF) return null;
    if (block.right.kind !== BlockKind.LITERAL || block.right.dataType !== 'number') return null;
    const leaf = withChain(ctx, (chain) => new ValueCompareLeaf(items, chain, block.op, String(block.right.value)));
    return leaf.chain.setBlock(block.left) ? leaf : null;
  }

  constructor(items, chain, op, value) {
    super(items);
    this.chain = chain;
    this.op = op;
    this.value = value;
    this.open = false;
  }

  toBlock() {
    const left = this.chain.getBlock();
    const n = Number(this.value);
    return left && this.value !== '' && !isNaN(n) ? compare(this.op, left, literal('number', n)) : null;
  }

  render(host, { notify, rerender }) {
    this._notify = notify;
    renderCalc(host, this, { rerender });
    const op = createCustomSelect({
      items: COMPARE_OPS.map((o) => ({ value: o, label: OP_LABEL[o] })),
      value: this.op,
      className: 'sc-trigger--sm',
      testid: 'eb-calc-op',
      ariaLabel: 'Comparison',
      onChange: (v) => { this.op = v; notify(); },
    });
    const num = document.createElement('input');
    num.type = 'number';
    num.step = 'any';
    num.className = 'eb-val-inp';
    num.dataset.testid = 'eb-calc-value';
    num.setAttribute('aria-label', 'Compare with');
    num.value = this.value;
    num.addEventListener('input', () => { this.value = num.value; notify(); });
    host.append(op.el, num);
  }
}

registerLeafKind(ValueCompareLeaf);
