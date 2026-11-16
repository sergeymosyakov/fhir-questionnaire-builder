// Operand "Round / square root / … of ( … )": a rounding-style function (or the square root) applied to a chain of values. It lets a value be
// rounded where it is used — typically as the result of a conditional branch — not only as the whole result.
import { registerOperand } from './registry.js';
import { OperandKind } from './operand-kind.js';
import { mathFn, BlockKind } from '../../../../fhir/expr-builder/model.js';
import { createMathFnSelect, createDecimalsInput, decimalsArg } from '../math-controls.js';

const newChain = (ctx) => ctx.createChain({ inlineAdd: true, chainTestid: 'eb-math-chain' });

const paren = (text) => {
  const span = document.createElement('span');
  span.className = 'eb-val-group-paren';
  span.textContent = text;
  return span;
};

export class MathOperand extends OperandKind {
  static id = 'math';
  static label = 'Round / square root / … of ( … )';
  static block = true;

  static fromBlock(block, ctx) {
    if (block.kind !== BlockKind.MATH_FN) return null;
    const chain = newChain(ctx);
    if (!chain.setBlock(block.target)) return null;
    return new MathOperand(ctx, { fn: block.fn, arg: block.arg != null ? String(block.arg) : '', chain });
  }

  constructor(ctx, parts = {}) {
    super(ctx);
    this.fn = parts.fn ?? 'round';
    this.arg = parts.arg ?? '';
    this.chain = parts.chain ?? newChain(ctx);
  }

  toBlock() {
    const inner = this.chain.getBlock();
    return inner ? mathFn(this.fn, this.fn === 'round' ? decimalsArg(this.arg) : null, inner) : null;
  }

  render(host) {
    const box = document.createElement('span');
    box.className = 'eb-math';
    box.dataset.testid = 'eb-math';
    const fnSel = createMathFnSelect({
      value: this.fn,
      testid: 'eb-math-fn',
      withSqrt: true,
      onChange: (v) => { this.fn = v; host.innerHTML = ''; this.render(host); this.ctx.onChange(); },
    });
    box.append(fnSel.el, paren('('), this.chain.el, paren(')'));
    if (this.fn === 'round') box.appendChild(createDecimalsInput({ value: this.arg, testid: 'eb-math-arg', onInput: (v) => { this.arg = v; this.ctx.onChange(); } }));
    host.appendChild(box);
  }
}

registerOperand(MathOperand);
