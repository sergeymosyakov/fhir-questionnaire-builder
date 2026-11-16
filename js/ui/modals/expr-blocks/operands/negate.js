// Operand "Minus ( … )": the opposite sign of a value, e.g. −(a + b).
import { registerOperand } from './registry.js';
import { OperandKind } from './operand-kind.js';
import { negate, NEGATE } from '../../../../fhir/expr-builder/blocks/index.js';
import { arith, literal, BlockKind } from '../../../../fhir/expr-builder/model.js';

const newChain = (ctx) => ctx.createChain({ inlineAdd: true, chainTestid: 'eb-negate-chain' });

const text = (str, className) => {
  const span = document.createElement('span');
  span.className = className;
  span.textContent = str;
  return span;
};

export class NegateOperand extends OperandKind {
  static id = 'negate';
  static label = 'Minus ( … )';

  static fromBlock(block, ctx) {
    // fhirpath.js refuses `-<answer>` (an error, not a number), so that text is left as it was.
    if (block.kind !== NEGATE || block.target?.kind === BlockKind.ITEM_REF) return null;
    const chain = newChain(ctx);
    return chain.setBlock(block.target) ? new NegateOperand(ctx, chain) : null;
  }

  constructor(ctx, chain) {
    super(ctx);
    this.chain = chain ?? newChain(ctx);
  }

  toBlock() {
    const inner = this.chain.getBlock();
    if (!inner) return null;
    // `0 - answer` is the same number and, unlike `-answer`, evaluates in fhirpath.js.
    return inner.kind === BlockKind.ITEM_REF ? arith('-', literal('number', 0), inner) : negate(inner);
  }

  render(host) {
    const box = document.createElement('span');
    box.className = 'eb-math';
    box.dataset.testid = 'eb-negate';
    box.append(text('−(', 'eb-val-group-paren'), this.chain.el, text(')', 'eb-val-group-paren'));
    host.appendChild(box);
  }
}

registerOperand(NegateOperand);
