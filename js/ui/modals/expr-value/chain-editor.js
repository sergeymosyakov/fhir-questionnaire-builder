// A chain of operands joined by + − × ÷ — the editor behind a value, and behind each branch of a
// conditional. Question / variable / number / aggregate are built in; other kinds (group, conditional, …) come from
// the operand registry (js/ui/modals/expr-blocks/operands/).
import { createCustomSelect } from '../../custom-select.js';
import { itemRef, variable, literal, arith, aggregate, ARITH_OPS, BlockKind } from '../../../fhir/expr-builder/model.js';
import { valueAccessor } from '../../../fhir/expr-builder/value-paths.js';
import { findItemBySegments } from '../../../fhir/expr-builder/flatten-items.js';
import { createQuestionSelect } from '../expr-blocks/question-select.js';
import { operandKinds, operandKind, OperandKind } from '../expr-blocks/operands/index.js';

const ARITH_LABEL = { '+': '+', '-': '−', '*': '×', '/': '÷', div: 'div (whole part)', mod: 'mod (remainder)' };
const AGG_FN_ITEMS = [
  { value: 'count', label: 'count of' },
  { value: 'sum', label: 'sum of' },
  { value: 'avg', label: 'average of' },
  { value: 'min', label: 'minimum of' },
  { value: 'max', label: 'maximum of' },
];

export class ChainEditor {
  // { items: numeric-answerable, allItems: every answerable, variables, fp, onChange,
  //   chainTestid, nested, branch, inlineAdd } — a branch is a chain inside a conditional (it may yield "no value");
  //   inlineAdd puts a "+ Add operand" at the end of the chain (the top-level chain has its own button).
  constructor({ items = [], allItems = [], variables = [], fp = null, onChange, chainTestid = 'eb-chain', nested = false, branch = false, inlineAdd = false } = {}) {
    this._items = items;
    this._allItems = allItems;
    this._variables = variables;
    this._fp = fp;
    this._onChange = onChange || (() => {});
    this._nested = nested;
    this._branch = branch;
    this._inlineAdd = inlineAdd;
    this._operands = [this._blankOperand()];
    this._ops = [];
    this.el = document.createElement('div');
    this.el.className = 'eb-chain';
    this.el.dataset.testid = chainTestid;
    this.render();
  }

  // Seeds the chain from a block; false (chain left blank) when part of it is not representable.
  setBlock(block) {
    const operands = [];
    const ops = [];
    if (!block || !this._walkArith(block, operands, ops)) return false;
    this._operands = operands;
    this._ops = ops;
    this.render();
    return true;
  }

  // The chain as a block; null while any operand is incomplete.
  getBlock() {
    return this._reduceChain(this._operands.map((o) => this._operandBlock(o)), this._ops);
  }

  // The chain's only operand, or null when it has several.
  single() { return this._operands.length === 1 ? this._operands[0] : null; }

  // Makes `operand` the chain's only operand.
  replaceWith(operand) {
    this._operands = [operand];
    this._ops = [];
    this.render();
  }

  // An operand that is only valid as a chain's single value ("No value") gives way to a blank one.
  addOperand() {
    const kctx = { ...this._kindCtx(), alone: false };
    this._operands = this._operands.map((o) => (o instanceof OperandKind && !o.constructor.available(kctx) ? this._blankOperand() : o));
    this._ops.push('+');
    this._operands.push(this._blankOperand());
    this.render();
    this._onChange();
  }

  render() {
    this.el.innerHTML = '';
    const ctx = { operands: this._operands, ops: this._ops, rerender: () => this.render() };
    this._operands.forEach((operand, i) => {
      if (i > 0) this.el.appendChild(this._renderOperator(i - 1, this._ops));
      this.el.appendChild(this._renderOperand(operand, ctx));
    });
    // A solitary operand ("No value") is replaced rather than added to, so no add button next to it.
    const solo = this._operands.length === 1 && this._operands[0] instanceof OperandKind && this._operands[0].constructor.solo;
    if (this._inlineAdd && !solo) {
      const add = document.createElement('button');
      add.type = 'button';
      add.className = 'eb-add';
      add.dataset.testid = 'eb-branch-add';
      add.textContent = '+ Add operand';
      add.addEventListener('click', () => this.addOperand());
      this.el.appendChild(add);
    }
  }

  // What registered operand kinds are given to work with.
  _kindCtx() {
    return {
      items: this._items,
      allItems: this._allItems,
      variables: this._variables,
      fp: this._fp,
      branch: this._branch,
      onChange: () => this._onChange(),
      createChain: (opts = {}) => new ChainEditor({
        items: this._items, allItems: this._allItems, variables: this._variables, fp: this._fp,
        onChange: () => this._onChange(), nested: true, ...opts,
      }),
    };
  }

  _itemBySegments(segments) {
    return findItemBySegments(this._allItems || this._items, segments);
  }

  _blankOperand() {
    return this._plainOperand(this._items.length ? 'item' : 'num');
  }

  _plainOperand(kind) {
    return { kind, item: null, varName: '', value: '' };
  }

  _renderOperator(opIdx, ops) {
    const sel = createCustomSelect({
      items: ARITH_OPS.map((o) => ({ value: o, label: ARITH_LABEL[o] })),
      value: ops[opIdx] || '+',
      className: 'sc-trigger--sm eb-arith-op',
      testid: 'eb-arith-op',
      ariaLabel: 'Operator',
      onChange: (v) => { ops[opIdx] = v; this._onChange(); },
    });
    return sel.el;
  }

  _renderOperand(operand, ctx) {
    const el = document.createElement('span');
    el.className = 'eb-operand';
    el.dataset.testid = 'eb-operand';

    const kctx = { ...this._kindCtx(), alone: ctx.operands.length === 1 };
    const kinds = [
      { value: 'item', label: 'Question' },
      { value: 'var', label: 'Variable' },
      { value: 'num', label: 'Number' },
      { value: 'agg', label: 'Aggregate' },
    ].filter((k) => (k.value !== 'item' || this._items.length) && (k.value !== 'var' || this._variables.length) && (k.value !== 'agg' || this._allItems.length));
    const offered = operandKinds().filter((Kind) => Kind.available(kctx) || Kind.id === operand.kind);
    kinds.push(...offered.map((Kind) => ({ value: Kind.id, label: Kind.label })));
    const valWrap = document.createElement('span');
    valWrap.className = 'eb-operand-val';

    const kindSel = createCustomSelect({
      items: kinds,
      value: operand.kind,
      className: 'sc-trigger--sm',
      testid: 'eb-operand-kind',
      ariaLabel: 'Kind of value',
      onChange: (v) => {
        if (v === operand.kind) return;
        const idx = ctx.operands.indexOf(operand);
        if (idx < 0) return;
        const Kind = operandKind(v);
        ctx.operands[idx] = Kind ? new Kind(kctx) : this._plainOperand(v);
        ctx.rerender();
        this._onChange();
      },
    });

    const rm = document.createElement('button');
    rm.type = 'button';
    rm.className = 'eb-rm';
    rm.textContent = '✕';
    rm.dataset.testid = 'eb-remove-operand';
    rm.setAttribute('aria-label', 'Remove operand');
    rm.style.display = ctx.operands.length > 1 ? '' : 'none';
    rm.addEventListener('click', () => {
      const idx = ctx.operands.indexOf(operand);
      if (idx < 0) return;
      ctx.operands.splice(idx, 1);
      ctx.ops.splice(idx > 0 ? idx - 1 : 0, 1);
      ctx.rerender();
      this._onChange();
    });

    kindSel.el.classList.add('eb-operand-kind');
    el.append(kindSel.el, valWrap, rm);
    this._renderOperandVal(operand, valWrap);
    return el;
  }

  _renderOperandVal(operand, valWrap) {
    valWrap.innerHTML = '';
    const custom = operand instanceof OperandKind;
    valWrap.parentElement?.classList.toggle('eb-operand--block', custom && operand.constructor.block);
    if (custom) { operand.render(valWrap); return; }
    if (operand.kind === 'agg') { this._renderAggOperand(operand, valWrap); return; }
    if (operand.kind === 'item') {
      const sel = createQuestionSelect({
        items: this._items,
        value: operand.item?.id,
        testid: 'eb-operand-item',
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
    const itemSel = createQuestionSelect({
      items: list,
      value: operand.aggItem?.id,
      testid: 'eb-agg-item',
      onChange: (id) => { operand.aggItem = list.find((it) => it.id === id) || null; this._onChange(); },
    });
    valWrap.innerHTML = '';
    valWrap.append(fnSel.el, itemSel.el);
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
    const kctx = this._kindCtx();
    for (const Kind of operandKinds()) {
      const operand = Kind.available(kctx) ? Kind.fromBlock(block, kctx) : null;
      if (operand) return operand;
    }
    return null;
  }

  _operandBlock(operand) {
    if (operand instanceof OperandKind) return operand.toBlock();
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
}
