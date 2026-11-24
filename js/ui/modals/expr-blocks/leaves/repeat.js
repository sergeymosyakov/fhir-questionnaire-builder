// Leaf "repeat over answers [<op> value]": the answers of a question anywhere in the form, filtered and reduced
// (e.g. "any answer exists"), optionally compared with a value. A plain "question <op> value" is the ordinary row.
import { registerLeafKind } from './registry.js';
import { LeafKind } from './leaf-kind.js';
import { createCustomSelect } from '../../../custom-select.js';
import { createPipelineEditor, isNumericAccessor } from '../../expr-pipeline/pipeline-editor.js';
import { compare, literal, pipeline, BlockKind } from '../../../../fhir/expr-builder/model.js';
import { valueAccessor } from '../../../../fhir/expr-builder/value-paths.js';

const OP_LABEL = { '=': '=', '!=': '≠', '>': '>', '<': '<', '>=': '≥', '<=': '≤' };
const NO_COMPARE = '';
const OPS = Object.keys(OP_LABEL);
const knows = (items, pipe) => items.some((it) => it.id === pipe.source.linkId);

export class RepeatLeaf extends LeafKind {
  static id = 'repeat';
  static switchLabel = 'repeat over answers';

  // A new leaf asks "does it have an answer" (a yes/no), not for a joined text; the question of the row it replaces carries over.
  static create(items, from) {
    const start = from?.item ? pipeline({ linkId: from.item.id, accessor: valueAccessor(from.item.itemType, { leaf: true }) || '' }, [], { fn: 'exists' }) : null;
    return new RepeatLeaf(items, start, null, 'exists');
  }

  static fromBlock(block, items) {
    // A question that is not in the form stays visible as text instead of a blank picker; a bare pipeline is a condition only as a yes/no.
    if (block.kind === BlockKind.PIPELINE) return knows(items, block) && block.reduce?.fn === 'exists' ? new RepeatLeaf(items, block, null) : null;
    const withValue = block.kind === BlockKind.COMPARE && block.left.kind === BlockKind.PIPELINE && block.right.kind === BlockKind.LITERAL && knows(items, block.left);
    return withValue ? new RepeatLeaf(items, block.left, { op: block.op, value: String(block.right.value), dataType: block.right.dataType }) : null;
  }

  constructor(items, block, cmp, defaultReduce) {
    super(items);
    this.cmp = cmp;
    this.backLabel = 'one question';
    this.editor = createPipelineEditor({ items, initialBlock: block, defaultReduce, note: false, onChange: () => { this._syncValueType(); this.changed(); } });
    if (cmp?.dataType) cmp.basis = this._derive(); // the shape the literal's type was read with
  }

  firstItem() { return this.items.find((it) => it.id === this.editor.getBlock()?.source.linkId) ?? null; }

  toBlock() {
    const pipe = this.editor.getBlock();
    if (!pipe) return null;
    if (!this.cmp) return pipe.reduce?.fn === 'exists' ? pipe : null; // without a comparison only a yes/no is a condition
    const { op, value } = this.cmp;
    const dataType = this._type();
    if (value === '' || (dataType === 'number' && isNaN(Number(value))) || (dataType === 'boolean' && value !== 'true' && value !== 'false')) return null;
    return compare(op, pipe, literal(dataType, dataType === 'number' ? Number(value) : value));
  }

  // What the pipeline yields: exists → yes/no, count → number, join → text; first / last / a list follow the answer's own type.
  _derive() {
    const pipe = this.editor.getBlock();
    const fn = pipe?.reduce?.fn;
    if (fn === 'exists') return 'boolean';
    if (fn === 'count') return 'number';
    if (fn === 'join') return 'string';
    const acc = pipe?.source.accessor ?? '';
    if (isNumericAccessor(acc)) return 'number';
    return acc.includes('valueBoolean') ? 'boolean' : 'string';
  }

  // A literal read from an expression keeps its type while the pipeline keeps the shape it was read with; otherwise the type follows what the pipeline yields.
  _type() {
    const derived = this._derive();
    return this.cmp.dataType && this.cmp.basis === derived ? this.cmp.dataType : derived;
  }

  _syncValueType() { if (this._valueInput && this.cmp) this._valueInput.type = this._type() === 'number' ? 'number' : 'text'; }

  render(host, { notify, rerender }) {
    this._notify = notify;
    const ops = [{ value: NO_COMPARE, label: 'no comparison' }, ...OPS.map((o) => ({ value: o, label: OP_LABEL[o] }))];
    const op = createCustomSelect({
      items: ops,
      value: this.cmp?.op ?? NO_COMPARE,
      className: 'sc-trigger--sm',
      testid: 'eb-repeat-op',
      ariaLabel: 'Compare the result',
      onChange: (v) => { this.cmp = v === NO_COMPARE ? null : (this.cmp ? { ...this.cmp, op: v } : { op: v, value: '', dataType: null }); rerender(); notify(); },
    });
    host.append(this.editor.el, op.el);
    this._valueInput = null;
    if (!this.cmp) return;
    const val = document.createElement('input');
    this._valueInput = val;
    this._syncValueType();
    val.className = 'eb-val-inp';
    val.dataset.testid = 'eb-repeat-value';
    val.setAttribute('aria-label', 'Compare with');
    val.value = this.cmp.value;
    val.addEventListener('input', () => { this.cmp.value = val.value; notify(); });
    host.append(val);
  }
}

registerLeafKind(RepeatLeaf);
