// Operand "No value": the branch yields nothing, so a calculation stays empty. Offered inside a conditional's
// branches, and only where it is the branch's single value (in a sum it would empty the whole branch).
import { registerOperand } from './registry.js';
import { OperandKind } from './operand-kind.js';
import { empty, EMPTY } from '../../../../fhir/expr-builder/blocks/index.js';

export class EmptyOperand extends OperandKind {
  static id = EMPTY;
  static label = 'No value';
  static solo = true;
  static available(ctx) { return !!ctx.branch && ctx.alone !== false; }
  static fromBlock(block, ctx) { return block.kind === EMPTY ? new EmptyOperand(ctx) : null; }

  render(host) {
    const note = document.createElement('span');
    note.className = 'eb-novalue';
    note.dataset.testid = 'eb-no-value';
    note.textContent = 'leave the result empty';
    host.appendChild(note);
  }

  toBlock() { return empty(); }
}

registerOperand(EmptyOperand);
