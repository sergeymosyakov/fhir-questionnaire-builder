// Operand "Duration": an amount of calendar time (280 days, 1 week), added to or taken from a date question.
import { registerOperand } from './registry.js';
import { OperandKind } from './operand-kind.js';
import { createCustomSelect } from '../../../custom-select.js';
import { DATE_TYPES } from '../../../../fhir/expr-builder/flatten-items.js';
import { duration, DURATION, DURATION_UNITS, unitBase } from '../../../../fhir/expr-builder/blocks/index.js';

export class DurationOperand extends OperandKind {
  static id = 'duration';
  static label = 'Duration (days, weeks, …)';
  static available(ctx) { return (ctx.allItems || []).some((it) => DATE_TYPES.has(it.itemType)); }

  static fromBlock(block, ctx) {
    return block.kind === DURATION ? new DurationOperand(ctx, { value: String(block.value), unit: block.unit }) : null;
  }

  constructor(ctx, parts = {}) {
    super(ctx);
    this.value = parts.value ?? '';
    this.unit = parts.unit ?? 'days'; // as written, so an unchanged duration reads back exactly
  }

  toBlock() {
    const n = this.value === '' ? NaN : Number(this.value);
    return Number.isFinite(n) && n >= 0 ? duration(n, this.unit) : null;
  }

  // Picking a unit keeps the plural form in step with the amount ("1 week", "2 weeks").
  _unitFor(base, n) { return n === 1 ? base : `${base}s`; }

  render(host) {
    const box = document.createElement('span');
    box.className = 'eb-math';
    box.dataset.testid = 'eb-duration';
    const inp = document.createElement('input');
    inp.type = 'number';
    inp.min = '0';
    inp.step = 'any';
    inp.className = 'eb-val-inp eb-wrap-arg';
    inp.placeholder = '0';
    inp.dataset.testid = 'eb-duration-value';
    inp.setAttribute('aria-label', 'Amount');
    inp.value = this.value;
    const sel = createCustomSelect({
      items: DURATION_UNITS.map((u) => ({ value: u, label: `${u}s` })),
      value: unitBase(this.unit),
      className: 'sc-trigger--sm',
      testid: 'eb-duration-unit',
      ariaLabel: 'Unit',
      onChange: (v) => { this.unit = this._unitFor(v, Number(this.value)); this.ctx.onChange(); },
    });
    inp.addEventListener('input', () => {
      this.value = inp.value;
      const base = unitBase(this.unit);
      if (this.value !== '' && Number.isFinite(Number(this.value))) this.unit = this._unitFor(base, Number(this.value));
      this.ctx.onChange();
    });
    box.append(inp, sel.el);
    host.appendChild(box);
  }
}

registerOperand(DurationOperand);
