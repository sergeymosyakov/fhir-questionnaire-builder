// ── Boolean leaf editor ───────────────────────────────────────────────────────
// Edits a single leaf of the expression tree. If the leaf parses into a known
// shape (item compare / exists) it shows friendly controls; otherwise the raw
// leaf text stays editable. Reuses the block model, emit and parse.
import { createCustomSelect } from '../../custom-select.js';
import { parseOptions } from '../../../utils.js';
import { itemRef, literal, compare, exists, BlockKind } from '../../../fhir/expr-builder/model.js';
import { emit } from '../../../fhir/expr-builder/emit.js';
import { parseExpression } from '../../../fhir/expr-builder/parse.js';
import { valueAccessor } from '../../../fhir/expr-builder/value-paths.js';

const NUM_OPS = ['=', '!=', '>', '<', '>=', '<='];
const OP_LABEL = { '=': '=', '!=': '\u2260', '>': '>', '<': '<', '>=': '\u2265', '<=': '\u2264' };
const EXISTS_OPS = [{ value: 'answered', label: 'has answer' }, { value: 'empty', label: 'has no answer' }];

const itemBySegments = (items, segments) => {
  const segs = segments || [];
  const exact = items.find((it) => it.segments.join('/') === segs.join('/'));
  if (exact) return exact;
  // Loose match by leaf id only for a single-segment reference — a full path
  // that no longer matches (e.g. an edited prefix) must NOT silently re-bind.
  return segs.length === 1 ? (items.find((it) => it.id === segs[0]) || null) : null;
};

// A recognised leaf → row state, else null (leaf stays as text).
function blockToRow(block, items) {
  if (!block) return null;
  if (block.kind === BlockKind.EXISTS && block.target?.kind === BlockKind.ITEM_REF) {
    const item = itemBySegments(items, block.target.segments);
    return item ? { item, mode: 'exists', op: '=', value: '', existsValue: block.negate ? 'empty' : 'answered' } : null;
  }
  if (block.kind === BlockKind.COMPARE && block.left?.kind === BlockKind.ITEM_REF && block.right?.kind === BlockKind.LITERAL) {
    const item = itemBySegments(items, block.left.segments);
    return item ? { item, mode: 'compare', op: block.op, value: String(block.right.value), existsValue: 'answered' } : null;
  }
  return null;
}

function compareOpsFor(t) {
  if (t === 'integer' || t === 'decimal') return NUM_OPS;
  if (t === 'checkbox') return ['='];
  if (t === 'select' || t === 'radio' || t === 'open-choice' || t === 'checklist') return ['=', '!='];
  if (t === 'text' || t === 'string' || t === 'url') return ['=', '!='];
  return [];
}

function valueLiteral(row, t) {
  if (t === 'integer' || t === 'decimal') return literal('number', Number(row.value));
  if (t === 'checkbox') return literal('boolean', row.value !== 'false');
  return literal('string', row.value ?? '');
}

function rowToBlock(row) {
  if (!row.item) return null;
  const seg = row.item.segments;
  const at = row.item.answerAt;
  if (row.mode === 'exists') return exists(itemRef(seg, '', at), row.existsValue === 'empty');
  const accessor = valueAccessor(row.item.itemType);
  if (!accessor) return null;
  return compare(row.op, itemRef(seg, accessor, at), valueLiteral(row, row.item.itemType));
}

export function createLeafEditor({ expr, items, fp, onChange, onApply, onDirtyChange }) {
  const el = document.createElement('div');
  el.className = 'eb-leaf';
  el.dataset.testid = 'eb-leaf';

  const initialText = expr || '';
  let text = expr || '';
  let row = blockToRow(fp ? parseExpression(text, fp) : null, items);
  // An empty leaf starts in friendly mode so it can be built from scratch.
  if (!row && !text.trim() && items.length) row = { item: null, mode: 'compare', op: '=', value: '', existsValue: 'answered' };
  let mode = row ? 'row' : 'text';
  // Baseline for "dirty" in text mode — reset whenever we enter text mode.
  let baseline = initialText;

  const notify = () => onChange && onChange();
  // Dirty only in text mode: friendly-control edits apply live.
  const isDirty = () => mode === 'text' && text.trim() !== baseline.trim();
  const currentExpr = () => {
    if (mode === 'text') return (text || '').trim();
    const b = rowToBlock(row);
    return b ? emit(b) : '';
  };

  function render() {
    el.innerHTML = '';
    if (mode === 'text') { renderText(); } else { renderRow(); }
  }

  function renderText() {
    const inp = document.createElement('input');
    inp.type = 'text';
    inp.className = 'eb-leaf-text';
    inp.dataset.testid = 'eb-leaf-text';
    inp.value = text;
    inp.placeholder = 'FHIRPath condition';
    // Apply appears once the text changed; it commits/re-parses this leaf.
    const applyBtn = mkLink('Apply', 'eb-leaf-apply', () => { if (onApply) onApply(); });
    // Return an unchanged recognised expression to friendly controls.
    const visualBtn = mkLink('Edit visually', 'eb-leaf-to-row', () => {
      const asRow = blockToRow(fp ? parseExpression(text, fp) : null, items);
      if (asRow) { row = asRow; mode = 'row'; render(); notify(); }
    });
    const update = () => {
      const dirty = isDirty();
      const asRow = items.length && blockToRow(fp ? parseExpression(text, fp) : null, items);
      applyBtn.style.display = dirty ? '' : 'none';
      visualBtn.style.display = (!dirty && asRow) ? '' : 'none';
      if (onDirtyChange) onDirtyChange();
    };
    inp.addEventListener('input', () => { text = inp.value; notify(); update(); });
    el.append(inp, applyBtn, visualBtn);
    update();
  }

  function renderRow() {
    const itemSel = createCustomSelect({
      items: [{ value: '', label: '\u2014 question \u2014' }, ...items.map((it) => ({ value: it.id, label: it.label }))],
      value: row.item?.id || '',
      className: 'sc-trigger--sm eb-item',
      testid: 'eb-leaf-item',
      searchable: true,
      onChange: (id) => { row.item = items.find((it) => it.id === id) || null; setItemTip(); row.mode = 'compare'; row.op = '='; row.value = ''; render(); notify(); },
    });
    // Titles often share a long prefix and get truncated — full title + linkId on hover.
    const idChip = document.createElement('span');
    idChip.className = 'eb-leaf-id';
    idChip.dataset.testid = 'eb-leaf-id';
    const setItemTip = () => {
      if (row.item) { itemSel.el.dataset.tipTitle = row.item.label; itemSel.el.dataset.tipBody = 'linkId: ' + row.item.id; idChip.textContent = row.item.id; } else { delete itemSel.el.dataset.tipTitle; delete itemSel.el.dataset.tipBody; idChip.textContent = ''; }
    };
    setItemTip();
    const opWrap = document.createElement('span');
    const valWrap = document.createElement('span');
    el.append(itemSel.el, idChip, opWrap, valWrap, mkLink('as text', 'eb-leaf-to-text', () => { text = currentExpr(); baseline = text; mode = 'text'; render(); notify(); }));
    renderOpVal(opWrap, valWrap);
  }

  function renderOpVal(opWrap, valWrap) {
    opWrap.innerHTML = '';
    valWrap.innerHTML = '';
    if (!row.item) return;
    const t = row.item.itemType;
    const opItems = [
      ...compareOpsFor(t).map((o) => ({ value: 'cmp|' + o, label: OP_LABEL[o] || o })),
      ...EXISTS_OPS.map((e) => ({ value: 'ex|' + e.value, label: e.label })),
    ];
    const opSel = createCustomSelect({
      items: opItems,
      value: row.mode === 'exists' ? 'ex|' + row.existsValue : 'cmp|' + row.op,
      className: 'sc-trigger--sm',
      testid: 'eb-leaf-op',
      onChange: (v) => {
        const [kind, rest] = v.split('|');
        if (kind === 'ex') { row.mode = 'exists'; row.existsValue = rest; } else { row.mode = 'compare'; row.op = rest; }
        renderOpVal(opWrap, valWrap); notify();
      },
    });
    opWrap.appendChild(opSel.el);
    if (row.mode !== 'compare') return;
    valWrap.appendChild(buildValueInput(t));
  }

  function buildValueInput(t) {
    if (t === 'checkbox') {
      const sel = createCustomSelect({
        items: [{ value: 'true', label: 'Yes (checked)' }, { value: 'false', label: 'No (unchecked)' }],
        value: row.value === 'false' ? 'false' : 'true',
        className: 'sc-trigger--sm', testid: 'eb-leaf-value-select',
        onChange: (v) => { row.value = v; notify(); },
      });
      row.value = row.value === 'false' ? 'false' : 'true';
      return sel.el;
    }
    if ((t === 'select' || t === 'radio' || t === 'open-choice' || t === 'checklist') && row.item.options) {
      const opts = parseOptions(row.item.options).map(({ code, display }) => ({ value: code, label: display || code }));
      const sel = createCustomSelect({
        items: opts.length ? opts : [{ value: '', label: '\u2014' }],
        value: row.value || (opts[0]?.value ?? ''),
        className: 'sc-trigger--sm', testid: 'eb-leaf-value-select',
        onChange: (v) => { row.value = v; notify(); },
      });
      if (!row.value) row.value = opts[0]?.value ?? '';
      return sel.el;
    }
    const inp = document.createElement('input');
    inp.type = (t === 'integer' || t === 'decimal') ? 'number' : 'text';
    inp.className = 'eb-val-inp';
    inp.dataset.testid = 'eb-leaf-value-input';
    inp.value = row.value || '';
    inp.addEventListener('input', () => { row.value = inp.value; notify(); });
    return inp;
  }

  function mkLink(label, testid, onClick) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'eb-leaf-link';
    b.dataset.testid = testid;
    b.textContent = label;
    b.addEventListener('click', onClick);
    return b;
  }

  render();
  return { el, getExpr: currentExpr, isDirty };
}
