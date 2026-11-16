// ── Boolean leaf editor ───────────────────────────────────────────────────────
// Edits a single leaf of the expression tree. If the leaf parses into a known
// shape (item compare / exists) it shows friendly controls; otherwise the raw
// leaf text stays editable. Reuses the block model, emit and parse.
import { createCustomSelect } from '../../custom-select.js';
import { rawOptsToPairs } from '../../../utils.js';
import { itemRef, literal, compare, exists, BlockKind } from '../../../fhir/expr-builder/model.js';
import { emit } from '../../../fhir/expr-builder/emit.js';
import { parseExpression } from '../../../fhir/expr-builder/parse.js';
import { valueAccessor } from '../../../fhir/expr-builder/value-paths.js';
import { findItemBySegments } from '../../../fhir/expr-builder/flatten-items.js';
import { createQuestionSelect } from '../expr-blocks/question-select.js';
import { leafKinds, leafFromBlock, LeafKind } from '../expr-blocks/leaves/index.js';

const NUM_OPS = ['=', '!=', '>', '<', '>=', '<='];
const OP_LABEL = { '=': '=', '!=': '\u2260', '>': '>', '<': '<', '>=': '\u2265', '<=': '\u2264' };
const EXISTS_OPS = [{ value: 'answered', label: 'has answer' }, { value: 'empty', label: 'has no answer' }];

// A recognised leaf → row state, else null (leaf stays as text).
// A literal the question's own control could hold; anything else is left as text rather than rewritten (e.g. a
// number box compared with a word would become NaN).
function literalFits(itemType, literalBlock) {
  if (itemType === 'integer' || itemType === 'decimal') return literalBlock.dataType === 'number' && Number.isFinite(literalBlock.value);
  if (itemType === 'checkbox') return literalBlock.dataType === 'boolean';
  return literalBlock.dataType === 'string';
}

function blockToRow(block, items, ctx) {
  if (!block) return null;
  if (block.kind === BlockKind.EXISTS && block.target?.kind === BlockKind.ITEM_REF) {
    const item = findItemBySegments(items, block.target.segments);
    // `accessor` keeps the exact part of the answer the expression looks at, so applying never rewrites it.
    return item ? { item, mode: 'exists', op: '=', value: '', existsValue: block.negate ? 'empty' : 'answered', accessor: block.target.value } : null;
  }
  if (block.kind === BlockKind.COMPARE && block.left?.kind === BlockKind.ITEM_REF && block.right?.kind === BlockKind.LITERAL) {
    const item = findItemBySegments(items, block.left.segments);
    return item && literalFits(item.itemType, block.right) ? { item, mode: 'compare', op: block.op, value: String(block.right.value), existsValue: 'answered', accessor: block.left.value } : null;
  }
  return leafFromBlock(block, items, ctx);
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
  if (row instanceof LeafKind) return row.toBlock();
  if (!row.item) return null;
  const seg = row.item.segments;
  const at = row.item.answerAt;
  if (row.mode === 'exists') return exists(itemRef(seg, row.accessor ?? '', at), row.existsValue === 'empty');
  const accessor = row.accessor ?? valueAccessor(row.item.itemType); // '' is kept: the expression compared the answer itself
  if (row.accessor === undefined && !accessor) return null;
  return compare(row.op, itemRef(seg, accessor, at), valueLiteral(row, row.item.itemType));
}

// initialRow: a half-built row to carry over when the tree is redrawn (an incomplete leaf has no text to re-read).
export function createLeafEditor({ expr, items, fp, onChange, onApply, onDirtyChange, createChain, initialRow }) {
  const kindCtx = { createChain };
  const el = document.createElement('div');
  el.className = 'eb-leaf';
  el.dataset.testid = 'eb-leaf';

  const initialText = expr || '';
  let text = expr || '';
  let row = initialRow ?? blockToRow(fp ? parseExpression(text, fp) : null, items, kindCtx);
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
      const asRow = blockToRow(fp ? parseExpression(text, fp) : null, items, kindCtx);
      if (asRow) { row = asRow; mode = 'row'; render(); notify(); }
    });
    const update = () => {
      const dirty = isDirty();
      // Only an unchanged leaf can go back to the friendly row, so a leaf being typed is not re-parsed on every key.
      const asRow = !dirty && items.length && blockToRow(fp ? parseExpression(text, fp) : null, items, kindCtx);
      applyBtn.style.display = dirty ? '' : 'none';
      visualBtn.style.display = (!dirty && asRow) ? '' : 'none';
      if (onDirtyChange) onDirtyChange();
    };
    inp.addEventListener('input', () => { text = inp.value; notify(); update(); });
    el.append(inp, applyBtn, visualBtn);
    update();
  }

  const toTextLink = () => mkLink('as text', 'eb-leaf-to-text', () => { text = currentExpr(); baseline = text; mode = 'text'; render(); notify(); });

  // A row of a library kind (several questions, …) draws itself.
  function renderCustomRow() {
    const host = document.createElement('span');
    host.className = 'eb-leaf-custom';
    row.render(host, { notify, rerender: render });
    const back = row.backLabel ? mkLink(row.backLabel, 'eb-leaf-kind-back', () => { row = { item: row.firstItem(), mode: 'compare', op: '=', value: '', existsValue: 'answered' }; render(); notify(); }) : null;
    el.append(host, ...(back ? [back] : []), toTextLink());
  }

  function renderRow() {
    if (row instanceof LeafKind) { renderCustomRow(); return; }
    const itemSel = createQuestionSelect({
      items,
      value: row.item?.id,
      testid: 'eb-leaf-item',
      decorate: (it) => ({ title: it.label, tipBody: 'linkId: ' + it.id }),
      onChange: (id) => { row.item = items.find((it) => it.id === id) || null; row.accessor = undefined; setItemTip(); row.mode = 'compare'; row.op = '='; row.value = ''; render(); notify(); },
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
    const switches = leafKinds().filter((Kind) => Kind.switchLabel && Kind.available(kindCtx)).map((Kind) => mkLink(Kind.switchLabel, 'eb-leaf-kind-' + Kind.id, () => { row = Kind.create(items, row, kindCtx); render(); notify(); }));
    el.append(itemSel.el, idChip, opWrap, valWrap, ...switches, toTextLink());
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
        const before = row.mode;
        if (kind === 'ex') { row.mode = 'exists'; row.existsValue = rest; } else { row.mode = 'compare'; row.op = rest; }
        if (row.mode !== before) row.accessor = undefined; // the other mode reads a different part of the answer
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
    if ((t === 'select' || t === 'radio' || t === 'open-choice' || t === 'checklist') && row.item._rawAnswerOptions?.length) {
      const opts = rawOptsToPairs(row.item._rawAnswerOptions).map(({ code, display }) => ({ value: code, label: display || code }));
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
  return { el, getExpr: currentExpr, isDirty, getRow: () => (mode === 'row' ? row : null) };
}
