// Operand "Repeat over answers": takes the answers of one question anywhere in the form (repeat(item)), filters
// them and reduces them to a value (exists, count, first, join…). The editing controls are the pipeline editor's.
import { registerOperand } from './registry.js';
import { OperandKind } from './operand-kind.js';
import { createPipelineEditor } from '../../expr-pipeline/pipeline-editor.js';
import { BlockKind } from '../../../../fhir/expr-builder/model.js';

export class RepeatOperand extends OperandKind {
  static id = 'repeat';
  static label = 'Repeat over answers';
  static block = true;
  static available(ctx) { return ctx.allItems.length > 0; }

  static fromBlock(block, ctx) {
    return block.kind === BlockKind.PIPELINE && ctx.allItems.some((it) => it.id === block.source.linkId) ? new RepeatOperand(ctx, block) : null;
  }

  constructor(ctx, block = null) {
    super(ctx);
    this.editor = createPipelineEditor({ items: ctx.allItems, initialBlock: block, note: false, onChange: () => ctx.onChange() });
  }

  toBlock() { return this.editor.getBlock(); }

  render(host) { host.appendChild(this.editor.el); }
}

registerOperand(RepeatOperand);
