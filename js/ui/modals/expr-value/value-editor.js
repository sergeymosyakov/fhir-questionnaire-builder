// Value strategy: an operand chain combined with + − × ÷, plus count/sum/…
// aggregates. Owns its operand state; the shell reads getExpr() and shows a live
// preview via onChange. Extracted from the modal so each result type is its own
// strategy (condition = expr-tree, value = here, pipeline = expr-pipeline).
import { createCustomSelect } from '../../custom-select.js';
import {
  itemRef, variable, literal, arith, aggregate, BlockKind,
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
    this._seed(initialExpr);
  }

  _seed(text) {
    const t = (text || '').trim();
    const block = t && this._fp ? parseExpression(t, this._fp) : null;
    const seed = block && this._blockToOperands(block);
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
    hint.textContent = 'Combine questions, variables and numbers with \u00d7 \u00f7 + \u2212. Use \u201cEdit as text\u201d for complex grouping.';
    this.el.appendChild(hint);

    this._chain = document.createElement('div');
    this._chain.className = 'eb-chain';
    this._chain.dataset.testid = 'eb-chain';
    this.el.appendChild(this._chain);
    this._renderChain();

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
    this._operands.forEach((operand, i) => {
      if (i > 0) this._chain.appendChild(this._renderOperator(i - 1));
      this._chain.appendChild(this._renderOperand(operand));
    });
  }

  _renderOperator(opIdx) {
    const sel = createCustomSelect({
      items: ['+', '-', '*', '/'].map((o) => ({ value: o, label: ARITH_LABEL[o] })),
      value: this._valOps[opIdx] || '+',
      className: 'sc-trigger--sm eb-arith-op',
      testid: 'eb-arith-op',
      onChange: (v) => { this._valOps[opIdx] = v; this._onChange(); },
    });
    return sel.el;
  }

  _renderOperand(operand) {
    const el = document.createElement('span');
    el.className = 'eb-operand';
    el.dataset.testid = 'eb-operand';

    const kinds = [{ value: 'item', label: 'Question' }, { value: 'var', label: 'Variable' }, { value: 'num', label: 'Number' }, { value: 'agg', label: 'Aggregate' }]
      .filter((k) => (k.value !== 'item' || this._items.length) && (k.value !== 'var' || this._variables.length) && (k.value !== 'agg' || this._allItems.length));
    const valWrap = document.createElement('span');
    valWrap.className = 'eb-operand-val';

    const kindSel = createCustomSelect({
      items: kinds,
      value: operand.kind,
      className: 'sc-trigger--sm',
      testid: 'eb-operand-kind',
      onChange: (v) => { operand.kind = v; operand.item = null; operand.varName = ''; operand.value = ''; this._renderOperandVal(operand, valWrap); this._onChange(); },
    });

    const rm = document.createElement('button');
    rm.type = 'button';
    rm.className = 'eb-rm';
    rm.textContent = '\u2715';
    rm.dataset.testid = 'eb-remove-operand';
    rm.style.display = this._operands.length > 1 ? '' : 'none';
    rm.addEventListener('click', () => {
      const idx = this._operands.indexOf(operand);
      if (idx < 0) return;
      this._operands.splice(idx, 1);
      this._valOps.splice(idx > 0 ? idx - 1 : 0, 1);
      this._renderChain();
      this._onChange();
    });

    el.append(kindSel.el, valWrap, rm);
    this._renderOperandVal(operand, valWrap);
    return el;
  }

  _renderOperandVal(operand, valWrap) {
    valWrap.innerHTML = '';
    if (operand.kind === 'agg') { this._renderAggOperand(operand, valWrap); return; }
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
    const ok = this._walkArith(block, operands, ops);
    return ok ? { operands, ops } : null;
  }

  _walkArith(block, operands, ops) {
    if (block.kind === BlockKind.ARITH) {
      if (!this._walkArith(block.left, operands, ops)) return false;
      ops.push(block.op);
      const right = this._blockToOperand(block.right);
      if (!right) return false;
      operands.push(right);
      return true;
    }
    const o = this._blockToOperand(block);
    if (!o) return false;
    operands.push(o);
    return true;
  }

  _blockToOperand(block) {
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
    return null;
  }

  _operandBlock(operand) {
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

  _valueRoot() {
    const blocks = this._operands.map((o) => this._operandBlock(o));
    if (blocks.some((b) => !b)) return null;
    if (blocks.length === 0) return null;
    let acc = blocks[0];
    for (let i = 1; i < blocks.length; i++) acc = arith(this._valOps[i - 1] || '+', acc, blocks[i]);
    return acc;
  }
}
