// Operand "Group ( … )": a chain of its own in parentheses, so a calculation can nest as deeply as it needs
// (e.g. weight ÷ ((height ÷ 100) × (height ÷ 100))).
import { registerOperand } from './registry.js';
import { OperandKind } from './operand-kind.js';
import { BlockKind } from '../../../../fhir/expr-builder/model.js';

const newChain = (ctx) => ctx.createChain({ chainTestid: 'eb-group-chain' });

const paren = (text) => {
  const span = document.createElement('span');
  span.className = 'eb-val-group-paren';
  span.textContent = text;
  return span;
};

export class GroupOperand extends OperandKind {
  static id = 'group';
  static label = 'Group ( … )';
  static block = true;

  static fromBlock(block, ctx) {
    if (block.kind !== BlockKind.ARITH) return null;
    const chain = newChain(ctx);
    return chain.setBlock(block) ? new GroupOperand(ctx, chain) : null;
  }

  constructor(ctx, chain) {
    super(ctx);
    this.chain = chain ?? newChain(ctx);
  }

  toBlock() { return this.chain.getBlock(); }

  render(host) {
    const box = document.createElement('span');
    box.className = 'eb-val-group';
    box.dataset.testid = 'eb-group';
    const add = document.createElement('button');
    add.type = 'button';
    add.className = 'eb-add eb-add--sm';
    add.textContent = '+';
    add.dataset.testid = 'eb-group-add';
    add.setAttribute('aria-label', 'Add an operand to the group');
    add.dataset.tipTitle = 'Add operand';
    add.dataset.tipBody = 'Add another value to this group.';
    add.addEventListener('click', () => this.chain.addOperand());
    box.append(paren('('), this.chain.el, paren(')'), add);
    host.appendChild(box);
  }
}

registerOperand(GroupOperand);
