// Operand "Text / part of text / whole number of ( … )": turns a value into text, takes characters out of that text
// and reads them as a whole number. Chained, they take the year, month or day out of a date.
import { registerOperand } from './registry.js';
import { OperandKind } from './operand-kind.js';
import { createCustomSelect } from '../../../custom-select.js';
import { textFn, TEXT_FN } from '../../../../fhir/expr-builder/blocks/index.js';

const LABELS = { toString: 'text', substring: 'part of text', toInteger: 'whole number' };
const newChain = (ctx) => ctx.createChain({ inlineAdd: true, chainTestid: 'eb-textfn-chain' });

const text = (str, className) => {
  const span = document.createElement('span');
  span.className = className;
  span.textContent = str;
  return span;
};

const countInput = (value, testid, label, placeholder, onInput) => {
  const inp = document.createElement('input');
  inp.type = 'number';
  inp.min = '0';
  inp.step = '1';
  inp.className = 'eb-val-inp eb-wrap-arg';
  inp.placeholder = placeholder;
  inp.dataset.testid = testid;
  inp.setAttribute('aria-label', label);
  inp.value = value;
  inp.addEventListener('input', () => onInput(inp.value));
  return inp;
};

const count = (s) => (s === '' || !/^\d+$/.test(s) ? null : Number(s));

export class TextFnOperand extends OperandKind {
  static id = 'text-fn';
  static label = 'Text / part of text / whole number of ( … )';
  static block = true;

  static fromBlock(block, ctx) {
    if (block.kind !== TEXT_FN) return null;
    const chain = newChain(ctx);
    if (!chain.setBlock(block.target)) return null;
    return new TextFnOperand(ctx, { fn: block.fn, from: block.args[0] != null ? String(block.args[0]) : '', length: block.args[1] != null ? String(block.args[1]) : '', chain });
  }

  constructor(ctx, parts = {}) {
    super(ctx);
    this.fn = parts.fn ?? 'toString';
    this.from = parts.from ?? '';
    this.length = parts.length ?? '';
    this.chain = parts.chain ?? newChain(ctx);
  }

  toBlock() {
    const inner = this.chain.getBlock();
    if (!inner) return null;
    if (this.fn !== 'substring') return textFn(this.fn, inner);
    const from = count(this.from);
    if (from == null) return null;
    if (this.length === '') return textFn('substring', inner, [from]);
    const length = count(this.length);
    return length == null ? null : textFn('substring', inner, [from, length]);
  }

  render(host) {
    const box = document.createElement('span');
    box.className = 'eb-math';
    box.dataset.testid = 'eb-textfn';
    const sel = createCustomSelect({
      items: Object.entries(LABELS).map(([value, label]) => ({ value, label })),
      value: this.fn,
      className: 'sc-trigger--sm',
      testid: 'eb-textfn-fn',
      ariaLabel: 'Function',
      onChange: (v) => { this.fn = v; host.innerHTML = ''; this.render(host); this.ctx.onChange(); },
    });
    box.append(sel.el, text('of (', 'eb-val-group-paren'), this.chain.el, text(')', 'eb-val-group-paren'));
    if (this.fn === 'substring') {
      box.append(
        text('from character', 'eb-leaf-tail'),
        countInput(this.from, 'eb-textfn-from', 'First character (0 is the first)', '0', (v) => { this.from = v; this.ctx.onChange(); }),
        text('length', 'eb-leaf-tail'),
        countInput(this.length, 'eb-textfn-length', 'Number of characters (empty: to the end)', 'to end', (v) => { this.length = v; this.ctx.onChange(); }),
      );
    }
    host.appendChild(box);
  }
}

registerOperand(TextFnOperand);
