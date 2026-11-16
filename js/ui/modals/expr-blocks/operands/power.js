// Operand "… to the power of …": a value raised to a power, e.g. a cube root as the power 1 ÷ 3. Both the value
// and the exponent are chains of their own.
import { registerOperand } from './registry.js';
import { OperandKind } from './operand-kind.js';
import { power, POWER } from '../../../../fhir/expr-builder/blocks/index.js';

const newChain = (ctx, chainTestid) => ctx.createChain({ inlineAdd: true, chainTestid });

const text = (str, className) => {
  const span = document.createElement('span');
  span.className = className;
  span.textContent = str;
  return span;
};

export class PowerOperand extends OperandKind {
  static id = 'power';
  static label = '( … ) to the power of ( … )';
  static block = true;

  static fromBlock(block, ctx) {
    if (block.kind !== POWER) return null;
    const base = newChain(ctx, 'eb-power-base-chain');
    const exponent = newChain(ctx, 'eb-power-exp-chain');
    return base.setBlock(block.base) && exponent.setBlock(block.exponent) ? new PowerOperand(ctx, { base, exponent }) : null;
  }

  constructor(ctx, parts = {}) {
    super(ctx);
    this.base = parts.base ?? newChain(ctx, 'eb-power-base-chain');
    this.exponent = parts.exponent ?? newChain(ctx, 'eb-power-exp-chain');
  }

  toBlock() {
    const base = this.base.getBlock();
    const exponent = this.exponent.getBlock();
    return base && exponent ? power(base, exponent) : null;
  }

  render(host) {
    const box = document.createElement('span');
    box.className = 'eb-math eb-power';
    box.dataset.testid = 'eb-power';
    box.append(
      text('(', 'eb-val-group-paren'), this.base.el, text(')', 'eb-val-group-paren'),
      text('to the power of', 'eb-leaf-tail'),
      text('(', 'eb-val-group-paren'), this.exponent.el, text(')', 'eb-val-group-paren'),
    );
    host.appendChild(box);
  }
}

registerOperand(PowerOperand);
