// Operand "Today's date": the date the calculation runs on.
import { registerOperand } from './registry.js';
import { OperandKind } from './operand-kind.js';
import { today, TODAY } from '../../../../fhir/expr-builder/blocks/index.js';

export class TodayOperand extends OperandKind {
  static id = 'today';
  static label = "Today's date";

  static fromBlock(block, ctx) { return block.kind === TODAY ? new TodayOperand(ctx) : null; }

  toBlock() { return today(); }

  render(host) {
    const note = document.createElement('span');
    note.className = 'eb-novalue';
    note.dataset.testid = 'eb-today';
    note.textContent = "today's date";
    host.appendChild(note);
  }
}

registerOperand(TodayOperand);
