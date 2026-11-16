// Leaf "<a calculated value> can be calculated" (every answer it needs is given): (a ÷ b).exists(). This is the usual
// "wait until the inputs are there" guard of a calculation.
import { registerLeafKind } from './registry.js';
import { LeafKind } from './leaf-kind.js';
import { renderCalc } from './calc-view.js';
import { createCustomSelect } from '../../../custom-select.js';
import { exists, itemRef, BlockKind } from '../../../../fhir/expr-builder/model.js';
import { valueAccessor } from '../../../../fhir/expr-builder/value-paths.js';
import { UNION } from '../../../../fhir/expr-builder/blocks/index.js';

// The calculation's edits must reach the leaf (so the condition text is refreshed), not just the outer editor.
function withChain(ctx, make) {
  let leaf = null;
  const chain = ctx.createChain({ inlineAdd: true, chainTestid: 'eb-leaf-chain', onChange: () => leaf?.changed() });
  leaf = make(chain);
  return leaf;
}

export class ValueExistsLeaf extends LeafKind {
  static id = 'value-exists';
  static switchLabel = 'a calculation can be done';
  static available(ctx) { return !!ctx?.createChain; }

  // A question already chosen in the row being replaced starts the calculation.
  static create(items, from, ctx) {
    const leaf = withChain(ctx, (chain) => new ValueExistsLeaf(items, chain, false));
    if (from?.item) leaf.chain.setBlock(itemRef(from.item.segments, valueAccessor(from.item.itemType), from.item.answerAt));
    leaf.open = true; // a new leaf is built, not just read
    return leaf;
  }

  // A question or a set of questions has its own rows; this is for a calculation.
  static fromBlock(block, items, ctx) {
    if (block.kind !== BlockKind.EXISTS || block.target.kind === BlockKind.ITEM_REF || block.target.kind === UNION) return null;
    const leaf = withChain(ctx, (chain) => new ValueExistsLeaf(items, chain, block.negate));
    return leaf.chain.setBlock(block.target) ? leaf : null;
  }

  constructor(items, chain, negate) {
    super(items);
    this.chain = chain;
    this.negate = negate;
    this.open = false;
  }

  toBlock() {
    const target = this.chain.getBlock();
    return target ? exists(target, this.negate) : null;
  }

  render(host, { notify, rerender }) {
    this._notify = notify;
    renderCalc(host, this, { rerender });
    const mode = createCustomSelect({
      items: [{ value: 'can', label: 'can be calculated' }, { value: 'cannot', label: 'cannot be calculated' }],
      value: this.negate ? 'cannot' : 'can',
      className: 'sc-trigger--sm',
      testid: 'eb-calc-mode',
      ariaLabel: 'Calculation state',
      onChange: (v) => { this.negate = v === 'cannot'; notify(); },
    });
    host.append(mode.el);
  }
}

registerLeafKind(ValueExistsLeaf);
