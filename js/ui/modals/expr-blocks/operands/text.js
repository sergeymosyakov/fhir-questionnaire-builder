// Operand "Text": a fixed piece of text, e.g. the label a conditional gives to a score band ("High risk").
// Offered inside a conditional's branches, where a result can be words rather than a number.
import { registerOperand } from './registry.js';
import { OperandKind } from './operand-kind.js';
import { literal, BlockKind } from '../../../../fhir/expr-builder/model.js';

export class TextOperand extends OperandKind {
  static id = 'text';
  static label = 'Text';
  static available(ctx) { return !!ctx.branch; }

  static fromBlock(block, ctx) {
    // An empty string is left as text: the operand cannot hold it (an empty box means "not filled in yet").
    return block.kind === BlockKind.LITERAL && block.dataType === 'string' && block.value !== '' ? new TextOperand(ctx, block.value) : null;
  }

  constructor(ctx, value = '') {
    super(ctx);
    this.value = value;
  }

  toBlock() { return this.value === '' ? null : literal('string', this.value); }

  render(host) {
    const inp = document.createElement('input');
    inp.type = 'text';
    inp.className = 'eb-val-inp eb-text-inp';
    inp.dataset.testid = 'eb-operand-text';
    inp.placeholder = 'text';
    inp.setAttribute('aria-label', 'Text');
    inp.value = this.value;
    inp.addEventListener('input', () => { this.value = inp.value; this.ctx.onChange(); });
    host.appendChild(inp);
  }
}

registerOperand(TextOperand);
