// Value strategy: an operand chain combined with + − × ÷, plus count/sum/…
// aggregates, conditionals and an optional rounding of the result. Owns the chain
// and the rounding; the shell reads getExpr() and shows a live preview via onChange.
// Extracted from the modal so each result type is its own strategy (condition =
// expr-tree, value = here, pipeline = expr-pipeline).
import { createCustomSelect } from '../../custom-select.js';
import { mathFn, MATH_WRAP_FNS, BlockKind } from '../../../fhir/expr-builder/model.js';
import { emit } from '../../../fhir/expr-builder/emit.js';
import { parseExpression } from '../../../fhir/expr-builder/parse.js';
import { ChainEditor } from './chain-editor.js';

const MATH_WRAP_LABELS = { round: 'round', abs: 'absolute value', ceiling: 'round up (ceiling)', floor: 'round down (floor)', truncate: 'truncate' };
const MATH_WRAP_ITEMS = MATH_WRAP_FNS.map((v) => ({ value: v, label: MATH_WRAP_LABELS[v] }));

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
    if (block && block.kind === BlockKind.MATH_FN) {
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
    const fnSel = createCustomSelect({
      items: [{ value: '', label: 'No rounding' }, ...MATH_WRAP_ITEMS],
      value: this._wrapFn,
      className: 'sc-trigger--sm',
      testid: 'eb-wrap-fn',
      onChange: (v) => { this._wrapFn = v; this._renderWrapRow(); this._onChange(); },
    });
    this._wrapRow.appendChild(fnSel.el);
    if (this._wrapFn === 'round') {
      const inp = document.createElement('input');
      inp.type = 'number';
      inp.step = '1';
      inp.min = '0';
      inp.className = 'eb-val-inp eb-wrap-arg';
      inp.placeholder = 'decimals';
      inp.dataset.testid = 'eb-wrap-arg';
      inp.value = this._wrapArg;
      inp.addEventListener('input', () => { this._wrapArg = inp.value; this._onChange(); });
      this._wrapRow.appendChild(inp);
    }
  }

  _valueRoot() {
    const root = this._chain.getBlock();
    if (!root) return null;
    if (!this._wrapFn) return root;
    const arg = this._wrapFn === 'round' ? this._roundArgNum() : null;
    return mathFn(this._wrapFn, arg, root);
  }

  _roundArgNum() {
    if (this._wrapArg === '' || this._wrapArg == null) return null;
    const n = Number(this._wrapArg);
    return isNaN(n) ? null : n;
  }
}
