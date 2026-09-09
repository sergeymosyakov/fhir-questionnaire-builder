// ── Expression Gallery modal ──────────────────────────────────────────────────
// Browse named FHIRPath calculation templates (issue #122), fill each slot by
// picking a questionnaire item (+ optional unit/rounding transform), and hand
// the resolved FHIRPath string back to the opening Expression Builder — which
// treats it exactly like any other raw text (its own "Switch to visual" still
// applies if the result happens to parse).
import { Modal } from './modal-base.js';
import { createCustomSelect } from '../custom-select.js';
import { itemRef } from '../../fhir/expr-builder/model.js';
import { emit } from '../../fhir/expr-builder/emit.js';
import { valueAccessor } from '../../fhir/expr-builder/value-paths.js';
import { flattenItems } from '../../fhir/expr-builder/flatten-items.js';
import { EXPR_GALLERY, resolveGalleryPattern } from '../../fhir/expr-builder/gallery/index.js';

function itemRefExpr(item) {
  return emit(itemRef(item.segments, valueAccessor(item.itemType), item.answerAt));
}

class ExpressionGalleryModal extends Modal {
  getName() { return 'expressionGalleryModal'; }

  constructor() {
    super({ applyLabel: 'Insert', cancelLabel: 'Cancel', maxWidth: '560px', bodyClass: 'eg-body' });
  }

  open({ tree, onInsert } = {}) {
    this._onInsert = onInsert;
    this._allItems = flattenItems(tree || []);
    this._pattern = null;
    this._selections = {};
    this._listSearch = '';
    this.setTitle('Choose from gallery');
    this._render();
    super.open();
  }

  _render() {
    this.body.innerHTML = '';
    if (!this._pattern) this._renderList();
    else this._renderSlots();
  }

  _renderList() {
    const search = document.createElement('input');
    search.type = 'search';
    search.className = 'eg-search';
    search.placeholder = 'Search patterns\u2026';
    search.dataset.testid = 'eg-search';
    search.value = this._listSearch;
    search.addEventListener('input', () => { this._listSearch = search.value; this._renderRows(); });
    this.body.appendChild(search);

    this._listEl = document.createElement('div');
    this._listEl.className = 'eg-list';
    this._listEl.dataset.testid = 'eg-list';
    this.body.appendChild(this._listEl);
    this._renderRows();
  }

  _renderRows() {
    const q = this._listSearch.trim().toLowerCase();
    const matches = !q
      ? EXPR_GALLERY
      : EXPR_GALLERY.filter((p) => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q));

    this._listEl.innerHTML = '';
    if (!matches.length) {
      const empty = document.createElement('div');
      empty.className = 'eg-note';
      empty.dataset.testid = 'eg-search-empty';
      empty.textContent = 'No patterns match your search.';
      this._listEl.appendChild(empty);
      return;
    }
    for (const pattern of matches) {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'eg-row';
      row.dataset.testid = 'eg-row-' + pattern.id;
      const name = document.createElement('div');
      name.className = 'eg-row-name';
      name.textContent = pattern.name;
      const desc = document.createElement('div');
      desc.className = 'eg-row-desc';
      desc.textContent = pattern.description;
      row.append(name, desc);
      row.addEventListener('click', () => { this._pattern = pattern; this._selections = {}; this._render(); });
      this._listEl.appendChild(row);
    }
  }

  _renderSlots() {
    const back = document.createElement('button');
    back.type = 'button';
    back.className = 'eg-back';
    back.textContent = '\u2190 Back to gallery';
    back.dataset.testid = 'eg-back';
    back.addEventListener('click', () => { this._pattern = null; this._render(); });
    this.body.appendChild(back);

    const desc = document.createElement('div');
    desc.className = 'eg-note';
    desc.textContent = this._pattern.description;
    this.body.appendChild(desc);

    const eligible = this._allItems.filter((it) => this._pattern.itemTypes.includes(it.itemType));
    const slotsWrap = document.createElement('div');
    slotsWrap.className = 'eg-slots';
    for (const slot of this._pattern.slots) {
      slotsWrap.appendChild(this._renderSlot(slot, eligible));
    }
    this.body.appendChild(slotsWrap);

    this._preview = document.createElement('code');
    this._preview.className = 'eg-preview';
    this._preview.dataset.testid = 'eg-preview';
    this.body.appendChild(this._preview);
    this._refreshPreview();
  }

  _renderSlot(slot, eligible) {
    if (slot.repeatable) return this._renderRepeatableSlot(slot, eligible);

    const row = document.createElement('div');
    row.className = 'eg-slot-row';
    row.dataset.testid = 'eg-slot-' + slot.key;

    const lbl = document.createElement('span');
    lbl.className = 'eg-slot-label';
    lbl.textContent = slot.label;
    row.appendChild(lbl);

    const itemSel = createCustomSelect({
      items: eligible.map((it) => ({ value: it.id, label: it.label })),
      value: this._selections[slot.key]?.itemId || '',
      className: 'sc-trigger--sm eg-slot-item',
      testid: 'eg-slot-item-' + slot.key,
      searchable: true,
      onChange: (v) => {
        const item = eligible.find((it) => it.id === v);
        this._selections[slot.key] = { ...this._selections[slot.key], itemId: v, ref: item ? itemRefExpr(item) : null };
        this._refreshPreview();
      },
    });
    row.appendChild(itemSel.el);

    if (slot.transforms.length) {
      // Idempotent: keeps an already-picked transform instead of stomping it
      // back to the default on every re-render (e.g. triggered by a sibling
      // repeatable slot's add/remove row).
      const currentTransformId = this._selections[slot.key]?.transformId || slot.transforms[0].id;
      const transformSel = createCustomSelect({
        items: slot.transforms.map((t) => ({ value: t.id, label: t.label })),
        value: currentTransformId,
        className: 'sc-trigger--sm eg-slot-transform',
        testid: 'eg-slot-transform-' + slot.key,
        onChange: (v) => {
          this._selections[slot.key] = { ...this._selections[slot.key], transformId: v };
          this._refreshPreview();
        },
      });
      row.appendChild(transformSel.el);
      this._selections[slot.key] = { ...this._selections[slot.key], transformId: currentTransformId };
    }
    return row;
  }

  // Repeatable slot: selections[slot.key] is an array of { itemId, ref, transformId? }
  // rows, one per "+ Add" click. Re-renders only its own rows on add/remove,
  // never the whole modal body.
  _renderRepeatableSlot(slot, eligible) {
    if (!this._selections[slot.key]) {
      this._selections[slot.key] = Array.from({ length: slot.min ?? 1 }, () => ({}));
    }

    const wrap = document.createElement('div');
    wrap.className = 'eg-slot-repeat';
    wrap.dataset.testid = 'eg-slot-' + slot.key;

    const lbl = document.createElement('div');
    lbl.className = 'eg-slot-label';
    lbl.textContent = slot.label;
    wrap.appendChild(lbl);

    const rowsWrap = document.createElement('div');
    rowsWrap.className = 'eg-slot-repeat-rows';
    wrap.appendChild(rowsWrap);

    const renderRows = () => {
      const rows = this._selections[slot.key];
      rowsWrap.innerHTML = '';
      rows.forEach((_, i) => rowsWrap.appendChild(this._renderRepeatRow(slot, eligible, i, renderRows)));
    };
    renderRows();

    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'eg-repeat-add';
    addBtn.textContent = '+ Add item';
    addBtn.dataset.testid = 'eg-slot-add-' + slot.key;
    addBtn.addEventListener('click', () => {
      this._selections[slot.key].push({});
      renderRows();
      this._refreshPreview();
    });
    wrap.appendChild(addBtn);

    return wrap;
  }

  _renderRepeatRow(slot, eligible, index, renderRows) {
    const rows = this._selections[slot.key];
    const sel = rows[index] || (rows[index] = {});

    const row = document.createElement('div');
    row.className = 'eg-slot-row eg-slot-repeat-row';
    row.dataset.testid = 'eg-slot-row-' + slot.key + '-' + index;

    const itemSel = createCustomSelect({
      items: eligible.map((it) => ({ value: it.id, label: it.label })),
      value: sel.itemId || '',
      className: 'sc-trigger--sm eg-slot-item',
      testid: 'eg-slot-item-' + slot.key + '-' + index,
      searchable: true,
      onChange: (v) => {
        const item = eligible.find((it) => it.id === v);
        rows[index] = { ...rows[index], itemId: v, ref: item ? itemRefExpr(item) : null };
        this._refreshPreview();
      },
    });
    row.appendChild(itemSel.el);

    if (slot.transforms?.length) {
      const currentTransformId = sel.transformId || slot.transforms[0].id;
      const transformSel = createCustomSelect({
        items: slot.transforms.map((t) => ({ value: t.id, label: t.label })),
        value: currentTransformId,
        className: 'sc-trigger--sm eg-slot-transform',
        testid: 'eg-slot-transform-' + slot.key + '-' + index,
        onChange: (v) => {
          rows[index] = { ...rows[index], transformId: v };
          this._refreshPreview();
        },
      });
      row.appendChild(transformSel.el);
      rows[index] = { ...rows[index], transformId: currentTransformId };
    }

    if (rows.length > (slot.min ?? 1)) {
      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'eg-repeat-remove';
      removeBtn.textContent = '\u2715';
      removeBtn.dataset.tipTitle = 'Remove item';
      removeBtn.dataset.testid = 'eg-slot-remove-' + slot.key + '-' + index;
      removeBtn.addEventListener('click', () => {
        rows.splice(index, 1);
        renderRows();
        this._refreshPreview();
      });
      row.appendChild(removeBtn);
    }

    return row;
  }

  _refreshPreview() {
    if (!this._preview) return;
    const expr = resolveGalleryPattern(this._pattern, this._selections);
    this._preview.textContent = expr || 'Pick an item for every slot\u2026';
  }

  _apply() {
    const expr = this._pattern && resolveGalleryPattern(this._pattern, this._selections);
    if (!expr) return; // incomplete — stay open, preview already says what's missing
    if (typeof this._onInsert === 'function') this._onInsert(expr);
    this._reset();
    this.close();
  }

  _cancel() { this._reset(); this.close(); }

  _reset() {
    this._onInsert = null;
    this._pattern = null;
    this._selections = {};
    this.body.innerHTML = '';
  }
}

export const expressionGalleryModal = typeof document !== 'undefined' ? new ExpressionGalleryModal() : null;
