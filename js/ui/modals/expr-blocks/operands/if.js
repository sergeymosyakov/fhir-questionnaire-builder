// Operand "If … then … otherwise": picks one of two values by a condition. The condition reuses the
// condition tree editor; each branch is a chain of its own (so a branch can be a sum, a conditional, …).
import { registerOperand } from './registry.js';
import { OperandKind } from './operand-kind.js';
import { createExprTreeEditor } from '../../expr-tree/tree-editor.js';
import { iif, IIF, empty } from '../../../../fhir/expr-builder/blocks/index.js';
import { emit } from '../../../../fhir/expr-builder/emit.js';
import { parseExpression } from '../../../../fhir/expr-builder/parse.js';
import { raw } from '../../../../fhir/expr-builder/model.js';
import { createRemoveButton } from '../remove-button.js';

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
  const head = document.createElement('span');
  head.className = 'eb-if-head';
  head.append(...extra, lbl); // the remove button (if any) leads the label
  row.append(head, content);
  return row;
}

const removeButton = (label, testid, onClick) => createRemoveButton({ testid, label, tip: label, onClick });

function actionLink(label, testid, onClick) {
  const link = document.createElement('button');
  link.type = 'button';
  link.className = 'eb-add';
  link.dataset.testid = testid;
  link.textContent = label;
  link.addEventListener('click', onClick);
  return link;
}

export class IfOperand extends OperandKind {
  static id = IIF;
  static label = 'If … then … otherwise';
  static block = true;

  // A fresh conditional: empty condition, empty "then", "otherwise" = no value.
  constructor(ctx, parts = {}) {
    super(ctx);
    this.cond = parts.cond ?? createExprTreeEditor({ initialExpr: '', items: ctx.allItems, fp: ctx.fp, onChange: ctx.onChange, createChain: ctx.createChain });
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
    const cond = createExprTreeEditor({ initialExpr: emit(block.condition), items: ctx.allItems, fp: ctx.fp, onChange: ctx.onChange, createChain: ctx.createChain });
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

  // "Otherwise" that is itself a single conditional reads as "Otherwise if" at the same level, not one level deeper;
  // the data stays nested (iif(a, x, iif(b, y, z))), only the picture is flat.
  static elseIf(op) {
    const only = op.elseChain?.single();
    return only instanceof IfOperand ? only : null;
  }

  render(host) {
    const redraw = () => { host.innerHTML = ''; this.render(host); this.ctx.onChange(); };
    const box = document.createElement('div');
    box.className = 'eb-if';
    box.dataset.testid = 'eb-if';
    box.appendChild(branchRow('If', 'eb-if-cond', this.cond.el));
    box.appendChild(branchRow('Then', 'eb-if-then', this.thenChain.el));

    let last = this;
    let stepNo = 0;
    for (let next = IfOperand.elseIf(this); next; next = IfOperand.elseIf(next)) {
      const parent = last;
      const step = next;
      stepNo += 1;
      box.appendChild(branchRow('Otherwise if', 'eb-if-elseif-cond', step.cond.el,
        removeButton(`Remove \u201cotherwise if\u201d step ${stepNo}`, 'eb-if-remove-elseif', () => { parent.elseChain = step.elseChain; redraw(); })));
      box.appendChild(branchRow('Then', 'eb-if-elseif-then', step.thenChain.el));
      last = step;
    }

    const tail = last;
    if (tail.elseChain) {
      box.appendChild(branchRow('Otherwise', 'eb-if-else', tail.elseChain.el,
        removeButton('Remove otherwise', 'eb-if-remove-else', () => { tail.elseChain = null; redraw(); })));
    }
    const actions = document.createElement('div');
    actions.className = 'eb-actions';
    if (!tail.elseChain) actions.appendChild(actionLink('+ Otherwise', 'eb-if-add-else', () => { tail.elseChain = noValueBranch(this.ctx); redraw(); }));
    actions.appendChild(actionLink('+ Otherwise if', 'eb-if-add-elseif', () => {
      const wrapper = newBranch(this.ctx);
      wrapper.replaceWith(new IfOperand(this.ctx, { elseChain: tail.elseChain })); // the old otherwise moves under the new condition
      tail.elseChain = wrapper;
      redraw();
    }));
    box.appendChild(actions);
    host.appendChild(box);
  }
}

registerOperand(IfOperand);
