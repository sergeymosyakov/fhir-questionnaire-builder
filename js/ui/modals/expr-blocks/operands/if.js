// Operand "If … then … otherwise": picks one of two values by a condition. The condition reuses the
// condition tree editor; each branch is a chain of its own (so a branch can be a sum, a conditional, …).
import { registerOperand } from './registry.js';
import { OperandKind } from './operand-kind.js';
import { createExprTreeEditor } from '../../expr-tree/tree-editor.js';
import { iif, IIF, empty } from '../../../../fhir/expr-builder/blocks/index.js';
import { emit } from '../../../../fhir/expr-builder/emit.js';
import { parseExpression } from '../../../../fhir/expr-builder/parse.js';
import { raw } from '../../../../fhir/expr-builder/model.js';

const newBranch = (ctx) => ctx.createChain({ branch: true, inlineAdd: true, chainTestid: 'eb-if-branch' });
const noValueBranch = (ctx) => { const chain = newBranch(ctx); chain.setBlock(empty()); return chain; };

function branchRow(label, testid, content, ...extra) {
  const row = document.createElement('div');
  row.className = 'eb-if-row';
  row.dataset.testid = testid;
  row.setAttribute('role', 'group');
  row.setAttribute('aria-label', label);
  const lbl = document.createElement('span');
  lbl.className = 'eb-if-label';
  lbl.setAttribute('aria-hidden', 'true');
  lbl.textContent = label;
  row.append(lbl, content, ...extra);
  return row;
}

export class IfOperand extends OperandKind {
  static id = IIF;
  static label = 'If … then … otherwise';
  static block = true;

  // A fresh conditional: empty condition, empty "then", "otherwise" = no value.
  constructor(ctx, parts = {}) {
    super(ctx);
    this.cond = parts.cond ?? createExprTreeEditor({ initialExpr: '', items: ctx.allItems, fp: ctx.fp, onChange: ctx.onChange });
    this.thenChain = parts.thenChain ?? newBranch(ctx);
    this.elseChain = 'elseChain' in parts ? parts.elseChain : noValueBranch(ctx);
  }

  static fromBlock(block, ctx) {
    if (block.kind !== IIF) return null;
    const thenChain = newBranch(ctx);
    if (!thenChain.setBlock(block.then)) return null;
    let elseChain = null;
    if (block.otherwise) {
      elseChain = newBranch(ctx);
      if (!elseChain.setBlock(block.otherwise)) return null;
    }
    const cond = createExprTreeEditor({ initialExpr: emit(block.condition), items: ctx.allItems, fp: ctx.fp, onChange: ctx.onChange });
    return new IfOperand(ctx, { cond, thenChain, elseChain });
  }

  toBlock() {
    const text = this.cond.getExpr().trim();
    if (!text) return null;
    const then = this.thenChain.getBlock();
    const otherwise = this.elseChain ? this.elseChain.getBlock() : null;
    if (!then || (this.elseChain && !otherwise)) return null;
    return iif(this.ctx.fp ? parseExpression(text, this.ctx.fp) : raw(text), then, otherwise);
  }

  render(host) {
    const box = document.createElement('div');
    box.className = 'eb-if';
    box.dataset.testid = 'eb-if';
    box.appendChild(branchRow('If', 'eb-if-cond', this.cond.el));
    box.appendChild(branchRow('Then', 'eb-if-then', this.thenChain.el));
    if (this.elseChain) {
      const rm = document.createElement('button');
      rm.type = 'button';
      rm.className = 'eb-rm';
      rm.textContent = '\u2715';
      rm.dataset.testid = 'eb-if-remove-else';
      rm.setAttribute('aria-label', 'Remove otherwise');
      rm.addEventListener('click', () => { this.elseChain = null; host.innerHTML = ''; this.render(host); this.ctx.onChange(); });
      box.appendChild(branchRow('Otherwise', 'eb-if-else', this.elseChain.el, rm));
    } else {
      const add = document.createElement('button');
      add.type = 'button';
      add.className = 'eb-add';
      add.dataset.testid = 'eb-if-add-else';
      add.textContent = '+ Otherwise';
      add.addEventListener('click', () => {
        this.elseChain = noValueBranch(this.ctx);
        host.innerHTML = '';
        this.render(host);
        this.ctx.onChange();
      });
      box.appendChild(add);
    }
    host.appendChild(box);
  }
}

registerOperand(IfOperand);
