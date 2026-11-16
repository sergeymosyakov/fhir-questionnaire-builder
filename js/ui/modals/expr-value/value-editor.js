// Value strategy: an operand chain combined with + − × ÷, plus count/sum/…
// aggregates, conditionals and an optional rounding of the result. Owns the chain
// and the rounding; the shell reads getExpr() and shows a live preview via onChange.
// Extracted from the modal so each result type is its own strategy (condition =
// expr-tree, value = here, pipeline = expr-pipeline).
import { mathFn, MATH_WRAP_FNS, BlockKind } from '../../../fhir/expr-builder/model.js';
import { emit } from '../../../fhir/expr-builder/emit.js';
import { parseExpression } from '../../../fhir/expr-builder/parse.js';
import { keepIf, KEEP_IF, KEEP_IF_WORDS } from '../../../fhir/expr-builder/blocks/index.js';
import { createCustomSelect } from '../../custom-select.js';
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
    this._keepOp = '';
    this._keepValue = '';
    this._chain = new ChainEditor({ items, allItems, variables, fp, onChange: () => this._onChange() });
    this._seed(initialExpr);
  }

  _seed(text) {
    const t = (text || '').trim();
    const block = t && this._fp ? parseExpression(t, this._fp) : null;
    let target = block;
    if (target?.kind === KEEP_IF) {
      this._keepOp = target.op;
      this._keepValue = String(target.value);
      target = target.target;
    }
    if (target && target.kind === BlockKind.MATH_FN && MATH_WRAP_FNS.includes(target.fn)) {
      this._wrapFn = target.fn;
      this._wrapArg = target.arg != null ? String(target.arg) : '';
      target = target.target;
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
    hint.textContent = 'Combine questions, variables and numbers with × ÷ + −. Group with parentheses, choose a value by a condition, optionally round the result or keep it only if it passes a test. Use “Edit as text” for anything else.';
    this.el.appendChild(hint);

    this.el.appendChild(this._chain.el);

    this._wrapRow = document.createElement('div');
    this._wrapRow.className = 'eb-wrap-row';
    this._wrapRow.dataset.testid = 'eb-wrap-row';
    this.el.appendChild(this._wrapRow);
    this._renderWrapRow();

    this._keepRow = document.createElement('div');
    this._keepRow.className = 'eb-wrap-row';
    this._keepRow.dataset.testid = 'eb-keep-row';
    this.el.appendChild(this._keepRow);
    this._renderKeepRow();

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

  _renderKeepRow() {
    this._keepRow.innerHTML = '';
    const lbl = document.createElement('span');
    lbl.className = 'eb-wrap-label';
    lbl.textContent = 'Keep the result only if it is';
    const sel = createCustomSelect({
      items: [{ value: '', label: 'always kept' }, ...Object.entries(KEEP_IF_WORDS).map(([value, label]) => ({ value, label }))],
      value: this._keepOp,
      className: 'sc-trigger--sm',
      testid: 'eb-keep-op',
      ariaLabel: 'Keep the result only if',
      onChange: (v) => { this._keepOp = v; this._renderKeepRow(); this._onChange(); },
    });
    this._keepRow.append(lbl, sel.el);
    if (!this._keepOp) return;
    const inp = document.createElement('input');
    inp.type = 'number';
    inp.step = 'any';
    inp.className = 'eb-val-inp eb-wrap-arg';
    inp.placeholder = '0';
    inp.dataset.testid = 'eb-keep-value';
    inp.setAttribute('aria-label', 'Number to compare the result with');
    inp.value = this._keepValue;
    inp.addEventListener('input', () => { this._keepValue = inp.value; this._onChange(); });
    this._keepRow.appendChild(inp);
  }

  _valueRoot() {
    let root = this._chain.getBlock();
    if (!root) return null;
    if (this._wrapFn) root = mathFn(this._wrapFn, this._wrapFn === 'round' ? decimalsArg(this._wrapArg) : null, root);
    if (!this._keepOp) return root;
    // An empty or invalid number leaves the expression incomplete rather than dropping the test.
    const n = this._keepValue === '' ? NaN : Number(this._keepValue);
    return Number.isFinite(n) ? keepIf(root, this._keepOp, n) : null;
  }
}
