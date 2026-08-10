// Pipeline strategy: build a collection expression over one question's answers —
//   source (a question's answers) → filters (keep/drop value sets, unique, value
//   comparison) → reduce (join to text / count / exists / first / last).
// Owns its own state; the shell reads getExpr() and shows a live preview.
import { createCustomSelect } from '../../custom-select.js';
import { setLiteral, pipeline } from '../../../fhir/expr-builder/model.js';
import { emit } from '../../../fhir/expr-builder/emit.js';
import { valueAccessor } from '../../../fhir/expr-builder/value-paths.js';

const FILTER_OPS = [
  { value: 'intersect', label: 'keep only values in set' },
  { value: 'exclude', label: 'remove values in set' },
  { value: 'distinct', label: 'unique' },
  { value: 'cmp:=', label: 'keep where value =' },
  { value: 'cmp:!=', label: 'keep where value \u2260' },
  { value: 'cmp:>', label: 'keep where value >' },
  { value: 'cmp:<', label: 'keep where value <' },
  { value: 'cmp:>=', label: 'keep where value \u2265' },
  { value: 'cmp:<=', label: 'keep where value \u2264' },
];
const REDUCE_OPS = [
  { value: 'join', label: 'join into text' },
  { value: 'count', label: 'count' },
  { value: 'exists', label: 'any exists (yes/no)' },
  { value: 'first', label: 'first' },
  { value: 'last', label: 'last' },
  { value: '', label: 'leave as list' },
];

// { items: answerable, initialBlock, onChange } → { el, getExpr }.
export function createPipelineEditor(opts) {
  return new PipelineEditor(opts).mount();
}

class PipelineEditor {
  constructor({ items = [], initialBlock = null, onChange } = {}) {
    this._items = items;
    this._onChange = onChange || (() => {});
    this._seed(initialBlock);
  }

  _seed(block) {
    const first = this._items[0] || null;
    this._source = {
      linkId: block?.source?.linkId ?? (first?.id || ''),
      accessor: block?.source?.accessor ?? (first ? accessorFor(first) : ''),
    };
    this._filters = (block?.filters || []).map((f) => {
      if (f.op === 'distinct') return { op: 'distinct' };
      if (f.op === 'compare') return { op: 'compare', cmp: f.cmp, value: String(f.value), dataType: f.dataType };
      return { op: f.op, members: [...(f.set?.members || [])] };
    });
    this._reduce = block?.reduce
      ? { fn: block.reduce.fn, sep: block.reduce.sep ?? ', ' }
      : { fn: 'join', sep: ', ' };
  }

  getExpr() {
    if (!this._source.linkId) return '';
    const numeric = this._numericSource();
    const filters = this._filters
      .filter((f) => {
        if (f.op === 'distinct') return true;
        if (f.op === 'compare') { const dt = f.dataType || (numeric ? 'number' : 'string'); return f.value !== '' && f.value != null && !(dt === 'number' && isNaN(Number(f.value))); }
        return f.members.length;
      })
      .map((f) => {
        if (f.op === 'distinct') return { op: 'distinct' };
        if (f.op === 'compare') { const dt = f.dataType || (numeric ? 'number' : 'string'); return { op: 'compare', cmp: f.cmp, value: dt === 'number' ? Number(f.value) : f.value, dataType: dt }; }
        return { op: f.op, set: setLiteral(f.members) };
      });
    const reduce = this._reduce.fn === 'join'
      ? { fn: 'join', sep: this._reduce.sep }
      : (this._reduce.fn ? { fn: this._reduce.fn } : null);
    return emit(pipeline({ linkId: this._source.linkId, accessor: this._source.accessor }, filters, reduce));
  }

  mount() {
    this.el = document.createElement('div');
    this.el.className = 'eb-pipe';

    const note = document.createElement('div');
    note.className = 'eb-note';
    note.textContent = 'Take the answers of one question, filter them, then reduce to a single value.';
    this.el.appendChild(note);

    this.el.appendChild(this._buildSourceRow());

    this._filtersWrap = document.createElement('div');
    this._filtersWrap.className = 'eb-pipe-filters';
    this._filtersWrap.dataset.testid = 'eb-pipe-filters';
    this.el.appendChild(this._filtersWrap);
    this._renderFilters();

    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'eb-add';
    addBtn.textContent = '+ Add filter';
    addBtn.dataset.testid = 'eb-pipe-add-filter';
    addBtn.addEventListener('click', () => {
      this._filters.push({ op: 'intersect', members: [] });
      this._renderFilters();
      this._onChange();
    });
    this.el.appendChild(addBtn);

    this.el.appendChild(this._buildReduceRow());
    return this;
  }

  _buildSourceRow() {
    const row = document.createElement('div');
    row.className = 'eb-pipe-row';
    const lbl = document.createElement('span');
    lbl.className = 'eb-pipe-lbl';
    lbl.textContent = 'Answers of';
    const sel = createCustomSelect({
      items: [{ value: '', label: '\u2014 question \u2014' }, ...this._items.map((it) => ({ value: it.id, label: it.label }))],
      value: this._source.linkId,
      className: 'sc-trigger--sm eb-item',
      testid: 'eb-pipe-source',
      searchable: true,
      onChange: (id) => {
        const it = this._items.find((x) => x.id === id) || null;
        this._source = { linkId: it?.id || '', accessor: it ? accessorFor(it) : '' };
        this._onChange();
      },
    });
    row.append(lbl, sel.el);
    return row;
  }

  _renderFilters() {
    this._filtersWrap.innerHTML = '';
    this._filters.forEach((f) => this._filtersWrap.appendChild(this._buildFilterRow(f)));
  }

  _buildFilterRow(f) {
    const row = document.createElement('div');
    row.className = 'eb-pipe-row eb-pipe-filter';
    row.dataset.testid = 'eb-pipe-filter';

    const opSel = createCustomSelect({
      items: FILTER_OPS,
      value: filterOpValue(f),
      className: 'sc-trigger--sm',
      testid: 'eb-pipe-filter-op',
      onChange: (v) => { this._setFilterOp(f, v); this._renderFilters(); this._onChange(); },
    });
    row.appendChild(opSel.el);

    if (f.op === 'compare') row.appendChild(this._buildCompareEditor(f));
    else if (f.op !== 'distinct') row.appendChild(this._buildSetEditor(f));

    const rm = document.createElement('button');
    rm.type = 'button';
    rm.className = 'eb-rm';
    rm.textContent = '\u2715';
    rm.dataset.testid = 'eb-pipe-remove-filter';
    rm.addEventListener('click', () => {
      const idx = this._filters.indexOf(f);
      if (idx >= 0) this._filters.splice(idx, 1);
      this._renderFilters();
      this._onChange();
    });
    row.appendChild(rm);
    return row;
  }

  _numericSource() {
    return /valueInteger|valueDecimal|valueQuantity/.test(this._source.accessor || ''); // NOSONAR — fixed value-accessor alternation, not user input
  }

  _setFilterOp(f, v) {
    if (v.startsWith('cmp:')) {
      f.op = 'compare';
      f.cmp = v.slice(4);
      if (f.value == null) f.value = '';
      f.dataType = this._numericSource() ? 'number' : 'string';
    } else {
      f.op = v;
      if (v !== 'distinct' && !f.members) f.members = [];
    }
  }

  _buildCompareEditor(f) {
    const inp = document.createElement('input');
    inp.type = this._numericSource() ? 'number' : 'text';
    if (inp.type === 'number') inp.step = 'any';
    inp.className = 'eb-val-inp';
    inp.dataset.testid = 'eb-pipe-cmp-value';
    inp.placeholder = 'value';
    inp.value = f.value ?? '';
    inp.addEventListener('input', () => { f.value = inp.value; this._onChange(); });
    return inp;
  }

  _buildSetEditor(f) {
    const wrap = document.createElement('span');
    wrap.className = 'eb-pipe-set';

    const chips = document.createElement('span');
    chips.className = 'eb-pipe-chips';
    f.members.forEach((m, i) => {
      const chip = document.createElement('span');
      chip.className = 'eb-pipe-chip';
      chip.dataset.testid = 'eb-pipe-set-chip';
      chip.textContent = m;
      const x = document.createElement('button');
      x.type = 'button';
      x.className = 'eb-pipe-chip-rm';
      x.textContent = '\u2715';
      x.dataset.testid = 'eb-pipe-set-chip-rm';
      x.addEventListener('click', () => { f.members.splice(i, 1); this._renderFilters(); this._onChange(); });
      chip.appendChild(x);
      chips.appendChild(chip);
    });
    wrap.appendChild(chips);

    const inp = document.createElement('input');
    inp.type = 'text';
    inp.className = 'eb-val-inp';
    inp.placeholder = 'add value, Enter';
    inp.dataset.testid = 'eb-pipe-set-input';
    const commit = () => {
      const v = inp.value.trim();
      if (!v) return;
      f.members.push(v);
      inp.value = '';
      this._renderFilters();
      this._onChange();
    };
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); commit(); } });
    inp.addEventListener('blur', commit);
    wrap.appendChild(inp);
    return wrap;
  }

  _buildReduceRow() {
    const row = document.createElement('div');
    row.className = 'eb-pipe-row';
    const lbl = document.createElement('span');
    lbl.className = 'eb-pipe-lbl';
    lbl.textContent = 'Then';
    const sel = createCustomSelect({
      items: REDUCE_OPS,
      value: this._reduce.fn,
      className: 'sc-trigger--sm',
      testid: 'eb-pipe-reduce',
      onChange: (v) => { this._reduce.fn = v; this._renderReduceExtra(); this._onChange(); },
    });
    row.append(lbl, sel.el);

    this._reduceExtra = document.createElement('span');
    this._reduceExtra.className = 'eb-pipe-reduce-extra';
    row.appendChild(this._reduceExtra);
    this._renderReduceExtra();
    return row;
  }

  _renderReduceExtra() {
    if (!this._reduceExtra) return;
    this._reduceExtra.innerHTML = '';
    if (this._reduce.fn !== 'join') return;
    const sepLbl = document.createElement('span');
    sepLbl.className = 'eb-pipe-lbl';
    sepLbl.textContent = 'with';
    const inp = document.createElement('input');
    inp.type = 'text';
    inp.className = 'eb-val-inp';
    inp.dataset.testid = 'eb-pipe-join-sep';
    inp.value = this._reduce.sep;
    inp.addEventListener('input', () => { this._reduce.sep = inp.value; this._onChange(); });
    this._reduceExtra.append(sepLbl, inp);
  }
}

// The op-select value for a filter row: compare filters encode the comparator.
function filterOpValue(f) {
  return f.op === 'compare' ? `cmp:${f.cmp}` : f.op;
}

// Accessor after `.answer.` for a source question (coding → valueCoding.code).
function accessorFor(item) {
  return valueAccessor(item.itemType, { leaf: true }) || '';
}
