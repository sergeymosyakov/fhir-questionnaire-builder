// Value strategy: an operand chain combined with + − × ÷, plus count/sum/…
// aggregates, conditionals and an optional rounding of the result. Owns the chain
// and the rounding; the shell reads getExpr() and shows a live preview via onChange.
// Extracted from the modal so each result type is its own strategy (condition =
// expr-tree, value = here, pipeline = expr-pipeline).
import { mathFn, MATH_WRAP_FNS, BlockKind } from '../../../fhir/expr-builder/model.js';
import { emit } from '../../../fhir/expr-builder/emit.js';
import { parseExpression } from '../../../fhir/expr-builder/parse.js';
import { ChainEditor } from './chain-editor.js';
import { createMathFnSelect, createDecimalsInput, decimalsArg } from '../expr-blocks/math-controls.js';

// { items: numeric-answerable, allItems: every answerable, variables, fp,
//   initialExpr, onChange, onEditAsText } → { el, getExpr }.
export function createValueEditor(opts) {
  return new ValueEditor(opts).mount();
}

class ValueEditor {
  constructor({ items = [], allItems = [], variables = [], fp = null, initialExpr = '', onChange, onEditAsText } = {}) {
    this._fp = fp;
    this._onChange = onChange || (() => {});
    this._onEditAsText = onEditAsText || (() => {});
    this._wrapFn = '';
    this._wrapArg = '';
    this._chain = new ChainEditor({ items, allItems, variables, fp, onChange: () => this._onChange() });
    this._seed(initialExpr);
  }

  _seed(text) {
    const t = (text || '').trim();
    const block = t && this._fp ? parseExpression(t, this._fp) : null;
    let target = block;
    if (block && block.kind === BlockKind.MATH_FN && MATH_WRAP_FNS.includes(block.fn)) {
      this._wrapFn = block.fn;
      this._wrapArg = block.arg != null ? String(block.arg) : '';
      target = block.target;
    }
    this.seeded = !!target && this._chain.setBlock(target);
  }

  getExpr() {
    const root = this._valueRoot();
    return root ? emit(root) : '';
  }

  mount() {
    this.el = document.createElement('div');

    const hint = document.createElement('div');
    hint.className = 'eb-note';
    hint.textContent = 'Combine questions, variables and numbers with × ÷ + −. Group with parentheses, choose a value by a condition, optionally round the result. Use “Edit as text” for anything else.';
    this.el.appendChild(hint);

    this.el.appendChild(this._chain.el);

    this._wrapRow = document.createElement('div');
    this._wrapRow.className = 'eb-wrap-row';
    this._wrapRow.dataset.testid = 'eb-wrap-row';
    this.el.appendChild(this._wrapRow);
    this._renderWrapRow();

    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'eb-add';
    addBtn.textContent = '+ Add operand';
    addBtn.dataset.testid = 'eb-add-operand';
    addBtn.addEventListener('click', () => this._chain.addOperand());

    const textBtn = document.createElement('button');
    textBtn.type = 'button';
    textBtn.className = 'eb-text-toggle';
    textBtn.textContent = 'Edit as text';
    textBtn.dataset.testid = 'eb-edit-as-text';
    textBtn.addEventListener('click', () => this._onEditAsText(this.getExpr()));

    const actions = document.createElement('div');
    actions.className = 'eb-actions';
    actions.append(addBtn, textBtn);
    this.el.appendChild(actions);
    return this;
  }

  _renderWrapRow() {
    this._wrapRow.innerHTML = '';
    const lbl = document.createElement('span');
    lbl.className = 'eb-wrap-label';
    lbl.textContent = 'Round the result';
    this._wrapRow.appendChild(lbl);
    const fnSel = createMathFnSelect({
      value: this._wrapFn,
      none: 'No rounding',
      testid: 'eb-wrap-fn',
      onChange: (v) => { this._wrapFn = v; this._renderWrapRow(); this._onChange(); },
    });
    this._wrapRow.appendChild(fnSel.el);
    if (this._wrapFn === 'round') {
      this._wrapRow.appendChild(createDecimalsInput({ value: this._wrapArg, testid: 'eb-wrap-arg', onInput: (v) => { this._wrapArg = v; this._onChange(); } }));
    }
  }

  _valueRoot() {
    const root = this._chain.getBlock();
    if (!root) return null;
    if (!this._wrapFn) return root;
    return mathFn(this._wrapFn, this._wrapFn === 'round' ? decimalsArg(this._wrapArg) : null, root);
  }
}
