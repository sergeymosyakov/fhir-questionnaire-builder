// Value strategy: an operand chain combined with + − × ÷, plus count/sum/…
// aggregates. Owns its operand state; the shell reads getExpr() and shows a live
// preview via onChange. Extracted from the modal so each result type is its own
// strategy (condition = expr-tree, value = here, pipeline = expr-pipeline).
import { createCustomSelect } from '../../custom-select.js';
import {
  itemRef, variable, literal, arith, aggregate, mathFn, MATH_WRAP_FNS, BlockKind,
} from '../../../fhir/expr-builder/model.js';
import { emit } from '../../../fhir/expr-builder/emit.js';
import { valueAccessor } from '../../../fhir/expr-builder/value-paths.js';
import { parseExpression } from '../../../fhir/expr-builder/parse.js';

const ARITH_LABEL = { '+': '+', '-': '\u2212', '*': '\u00d7', '/': '\u00f7' };
const AGG_FN_ITEMS = [
  { value: 'count', label: 'count of' },
  { value: 'sum', label: 'sum of' },
  { value: 'avg', label: 'average of' },
  { value: 'min', label: 'minimum of' },
  { value: 'max', label: 'maximum of' },
];
const MATH_WRAP_LABELS = { round: 'round', abs: 'absolute value', ceiling: 'round up (ceiling)', floor: 'round down (floor)', truncate: 'truncate' };
const MATH_WRAP_ITEMS = MATH_WRAP_FNS.map((v) => ({ value: v, label: MATH_WRAP_LABELS[v] }));

// { items: numeric-answerable, allItems: every answerable, variables, fp,
//   initialExpr, onChange, onEditAsText } → { el, getExpr }.
export function createValueEditor(opts) {
  return new ValueEditor(opts).mount();
}

class ValueEditor {
  constructor({ items = [], allItems = [], variables = [], fp = null, initialExpr = '', onChange, onEditAsText } = {}) {
    this._items = items;
    this._allItems = allItems;
    this._variables = variables;
    this._fp = fp;
    this._onChange = onChange || (() => {});
    this._onEditAsText = onEditAsText || (() => {});
    this._operands = [];
    this._valOps = [];
    this._wrapFn = '';
    this._wrapArg = '';
    this._seed(initialExpr);
  }

  _seed(text) {
    const t = (text || '').trim();
    const block = t && this._fp ? parseExpression(t, this._fp) : null;
    let target = block;
    this._wrapFn = '';
    this._wrapArg = '';
    if (block && block.kind === BlockKind.MATH_FN) {
      this._wrapFn = block.fn;
      this._wrapArg = block.arg != null ? String(block.arg) : '';
      target = block.target;
    }
    const seed = target && this._blockToOperands(target);
    this.seeded = !!seed;
    if (seed) { this._operands = seed.operands; this._valOps = seed.ops; } else { this._operands = [this._blankOperand()]; this._valOps = []; }
  }

  getExpr() {
    const root = this._valueRoot();
    return root ? emit(root) : '';
  }

  mount() {
    this.el = document.createElement('div');

    const hint = document.createElement('div');
    hint.className = 'eb-note';
    hint.textContent = 'Combine questions, variables and numbers with \u00d7 \u00f7 + \u2212. Group with parentheses, optionally round the result. Use \u201cEdit as text\u201d for complex grouping.';
    this.el.appendChild(hint);

    this._chain = document.createElement('div');
    this._chain.className = 'eb-chain';
    this._chain.dataset.testid = 'eb-chain';
    this.el.appendChild(this._chain);
    this._renderChain();

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
    addBtn.addEventListener('click', () => {
      this._valOps.push('+');
      this._operands.push(this._blankOperand());
      this._renderChain();
      this._onChange();
    });

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

  _itemBySegments(segments) {
    const segs = segments || [];
    const pool = this._allItems || this._items;
    const exact = pool.find((it) => it.segments.join('/') === segs.join('/'));
    if (exact) return exact;
    return segs.length === 1 ? (pool.find((it) => it.id === segs[0]) || null) : null;
  }

  _blankOperand() {
    return { kind: this._items.length ? 'item' : 'num', item: null, varName: '', value: '' };
  }

  _renderChain() {
    this._chain.innerHTML = '';
    const ctx = { operands: this._operands, ops: this._valOps, rerender: () => this._renderChain(), topLevel: true };
    this._operands.forEach((operand, i) => {
      if (i > 0) this._chain.appendChild(this._renderOperator(i - 1, this._valOps));
      this._chain.appendChild(this._renderOperand(operand, ctx));
    });
  }

  _renderOperator(opIdx, ops) {
    const sel = createCustomSelect({
      items: ['+', '-', '*', '/'].map((o) => ({ value: o, label: ARITH_LABEL[o] })),
      value: ops[opIdx] || '+',
      className: 'sc-trigger--sm eb-arith-op',
      testid: 'eb-arith-op',
      onChange: (v) => { ops[opIdx] = v; this._onChange(); },
    });
    return sel.el;
  }

  _renderOperand(operand, ctx) {
    const el = document.createElement('span');
    el.className = 'eb-operand';
    el.dataset.testid = 'eb-operand';

    const kinds = [
      { value: 'item', label: 'Question' },
      { value: 'var', label: 'Variable' },
      { value: 'num', label: 'Number' },
      { value: 'agg', label: 'Aggregate' },
      ...(ctx.topLevel ? [{ value: 'group', label: 'Group ( \u2026 )' }] : []),
    ].filter((k) => (k.value !== 'item' || this._items.length) && (k.value !== 'var' || this._variables.length) && (k.value !== 'agg' || this._allItems.length));
    const valWrap = document.createElement('span');
    valWrap.className = 'eb-operand-val';

    const kindSel = createCustomSelect({
      items: kinds,
      value: operand.kind,
      className: 'sc-trigger--sm',
      testid: 'eb-operand-kind',
      onChange: (v) => {
        operand.kind = v; operand.item = null; operand.varName = ''; operand.value = '';
        if (v === 'group') { operand.groupOperands = [this._blankOperand()]; operand.groupOps = []; }
        this._renderOperandVal(operand, valWrap);
        this._onChange();
      },
    });

    const rm = document.createElement('button');
    rm.type = 'button';
    rm.className = 'eb-rm';
    rm.textContent = '\u2715';
    rm.dataset.testid = 'eb-remove-operand';
    rm.style.display = ctx.operands.length > 1 ? '' : 'none';
    rm.addEventListener('click', () => {
      const idx = ctx.operands.indexOf(operand);
      if (idx < 0) return;
      ctx.operands.splice(idx, 1);
      ctx.ops.splice(idx > 0 ? idx - 1 : 0, 1);
      ctx.rerender();
      this._onChange();
    });

    el.append(kindSel.el, valWrap, rm);
    this._renderOperandVal(operand, valWrap);
    return el;
  }

  _renderGroupOperand(operand, valWrap) {
    if (!operand.groupOperands || !operand.groupOperands.length) operand.groupOperands = [this._blankOperand()];
    operand.groupOps = operand.groupOps || [];
    const box = document.createElement('span');
    box.className = 'eb-val-group';
    box.dataset.testid = 'eb-group';
    const open = document.createElement('span');
    open.className = 'eb-val-group-paren';
    open.textContent = '(';
    const chain = document.createElement('span');
    chain.className = 'eb-val-group-chain';
    const close = document.createElement('span');
    close.className = 'eb-val-group-paren';
    close.textContent = ')';
    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'eb-add eb-add--sm';
    addBtn.textContent = '+';
    addBtn.dataset.testid = 'eb-group-add';
    const groupCtx = { operands: operand.groupOperands, ops: operand.groupOps, rerender: () => rerenderGroup(), topLevel: false };
    const rerenderGroup = () => {
      chain.innerHTML = '';
      operand.groupOperands.forEach((inner, i) => {
        if (i > 0) chain.appendChild(this._renderOperator(i - 1, operand.groupOps));
        chain.appendChild(this._renderOperand(inner, groupCtx));
      });
    };
    addBtn.addEventListener('click', () => { operand.groupOps.push('+'); operand.groupOperands.push(this._blankOperand()); rerenderGroup(); this._onChange(); });
    rerenderGroup();
    box.append(open, chain, close, addBtn);
    valWrap.appendChild(box);
  }

  _renderWrapRow() {
    this._wrapRow.innerHTML = '';
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

  _renderOperandVal(operand, valWrap) {
    valWrap.innerHTML = '';
    if (operand.kind === 'agg') { this._renderAggOperand(operand, valWrap); return; }
    if (operand.kind === 'group') { this._renderGroupOperand(operand, valWrap); return; }
    if (operand.kind === 'item') {
      const sel = createCustomSelect({
        items: [{ value: '', label: '\u2014 question \u2014' }, ...this._items.map((it) => ({ value: it.id, label: it.label }))],
        value: operand.item?.id || '',
        className: 'sc-trigger--sm eb-item',
        testid: 'eb-operand-item',
        searchable: true,
        onChange: (id) => { operand.item = this._items.find((it) => it.id === id) || null; this._onChange(); },
      });
      valWrap.appendChild(sel.el);
    } else if (operand.kind === 'var') {
      const sel = createCustomSelect({
        items: this._variables.map((v) => ({ value: v.name, label: '%' + v.name })),
        value: operand.varName || (this._variables[0]?.name ?? ''),
        className: 'sc-trigger--sm',
        testid: 'eb-operand-var',
        onChange: (v) => { operand.varName = v; this._onChange(); },
      });
      if (!operand.varName) operand.varName = this._variables[0]?.name ?? '';
      valWrap.appendChild(sel.el);
    } else {
      const inp = document.createElement('input');
      inp.type = 'number';
      inp.step = 'any';
      inp.className = 'eb-val-inp';
      inp.dataset.testid = 'eb-operand-num';
      inp.value = operand.value || '';
      inp.addEventListener('input', () => { operand.value = inp.value; this._onChange(); });
      valWrap.appendChild(inp);
    }
  }

  // Aggregate operand: fn (count/sum/…) over a repeating question's answers.
  _renderAggOperand(operand, valWrap) {
    operand.aggFn = operand.aggFn || 'count';
    // count works on any question; the numeric aggregates need a numeric answer.
    const list = operand.aggFn === 'count' ? this._allItems : this._items;
    if (operand.aggItem && !list.some((it) => it.id === operand.aggItem.id)) operand.aggItem = null;

    const fnSel = createCustomSelect({
      items: AGG_FN_ITEMS,
      value: operand.aggFn,
      className: 'sc-trigger--sm',
      testid: 'eb-agg-fn',
      onChange: (v) => { operand.aggFn = v; this._renderAggOperand(operand, valWrap); this._onChange(); },
    });
    const itemSel = createCustomSelect({
      items: [{ value: '', label: '\u2014 question \u2014' }, ...list.map((it) => ({ value: it.id, label: it.label }))],
      value: operand.aggItem?.id || '',
      className: 'sc-trigger--sm eb-item',
      testid: 'eb-agg-item',
      searchable: true,
      onChange: (id) => { operand.aggItem = list.find((it) => it.id === id) || null; this._onChange(); },
    });
    valWrap.innerHTML = '';
    valWrap.append(fnSel.el, itemSel.el);
  }

  _blockToOperands(block) {
    const operands = [];
    const ops = [];
    const ok = this._walkArith(block, operands, ops, true);
    return ok ? { operands, ops } : null;
  }

  _walkArith(block, operands, ops, allowGroup) {
    if (block.kind === BlockKind.ARITH) {
      if (!this._walkArith(block.left, operands, ops, allowGroup)) return false;
      ops.push(block.op);
      const right = this._blockToOperand(block.right, allowGroup);
      if (!right) return false;
      operands.push(right);
      return true;
    }
    const o = this._blockToOperand(block, allowGroup);
    if (!o) return false;
    operands.push(o);
    return true;
  }

  _blockToOperand(block, allowGroup) {
    if (block.kind === BlockKind.ITEM_REF) {
      const item = this._itemBySegments(block.segments);
      return item ? { kind: 'item', item, varName: '', value: '' } : null;
    }
    if (block.kind === BlockKind.VARIABLE) return { kind: 'var', item: null, varName: block.name, value: '' };
    if (block.kind === BlockKind.LITERAL && block.dataType === 'number') {
      return { kind: 'num', item: null, varName: '', value: String(block.value) };
    }
    if (block.kind === BlockKind.AGGREGATE && block.source?.kind === BlockKind.ITEM_REF && !block.filter) {
      const item = this._itemBySegments(block.source.segments);
      return item ? { kind: 'agg', item: null, varName: '', value: '', aggFn: block.fn, aggItem: item } : null;
    }
    // One level of parenthesized grouping only — leaves must be simple operands.
    if (allowGroup && block.kind === BlockKind.ARITH) {
      const operands = [];
      const ops = [];
      const ok = this._walkArith(block, operands, ops, false);
      return ok ? { kind: 'group', item: null, varName: '', value: '', groupOperands: operands, groupOps: ops } : null;
    }
    return null;
  }

  _operandBlock(operand) {
    if (operand.kind === 'group') {
      const blocks = (operand.groupOperands || []).map((o) => this._operandBlock(o));
      return this._reduceChain(blocks, operand.groupOps || []);
    }
    if (operand.kind === 'agg') {
      if (!operand.aggItem) return null;
      const fn = operand.aggFn || 'count';
      const value = fn === 'count' ? '' : valueAccessor(operand.aggItem.itemType);
      return aggregate(fn, itemRef(operand.aggItem.segments, value, operand.aggItem.answerAt));
    }
    if (operand.kind === 'item') {
      if (!operand.item) return null;
      return itemRef(operand.item.segments, valueAccessor(operand.item.itemType), operand.item.answerAt);
    }
    if (operand.kind === 'var') return operand.varName ? variable(operand.varName) : null;
    if (operand.value === '' || operand.value == null || isNaN(Number(operand.value))) return null;
    return literal('number', Number(operand.value));
  }

  _reduceChain(blocks, ops) {
    if (!blocks.length || blocks.some((b) => !b)) return null;
    let acc = blocks[0];
    for (let i = 1; i < blocks.length; i++) acc = arith(ops[i - 1] || '+', acc, blocks[i]);
    return acc;
  }

  _valueRoot() {
    const blocks = this._operands.map((o) => this._operandBlock(o));
    const root = this._reduceChain(blocks, this._valOps);
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
