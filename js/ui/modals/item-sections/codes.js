import { ItemSection } from './base-section.js';
import { ITEM_SECTIONS } from './registry.js';
import { makeCollapsible } from './helpers.js';

class CodesSection extends ItemSection {
  initPending(node) {
    return { codes: JSON.parse(JSON.stringify(node._codes || [])) };
  }

  build(pending) {
    return makeCollapsible({
      testid:      'item-props-codes-toggle',
      tip:         { title: 'Item codes', body: 'Coding(s) that identify the meaning of this question in a clinical terminology (e.g. LOINC, SNOMED CT).', fhir: 'Questionnaire.item.code', spec: 'R4' },
      label:       'Codes',
      countFn:     () => pending.codes.filter(c => c.code.trim()).length,
      initialOpen: true,
      liveUpdate:  true,
      buildBody:   ({ el }) => { renderCodesEditor(pending.codes, el, 'code'); },
    });
  }

  commit(pending, node) {
    const filtered = pending.codes.filter(c => c.code.trim());
    if (filtered.length) node._codes = filtered;
    else delete node._codes;
  }

  buildPatch(pending, _node) {
    const filtered = pending.codes.filter(c => c.code.trim());
    return { _codes: filtered.length ? filtered : null };
  }
}

ITEM_SECTIONS.push(new CodesSection());

/**
 * Shared codes editor — renders system/code/display rows + Add button.
 * Reusable across modals (item codes, questionnaire codes, resource-meta).
 *
 * @param {object[]} draft     — mutable array of {system, code, display}
 * @param {Element}  container — cleared and repopulated on each call
 * @param {string}   prefix    — testid prefix, e.g. 'code' or 'meta-code'
 * @param {string}   [label]   — label for empty-state text and Add button (default 'code')
 */
export function renderCodesEditor(draft, container, prefix = 'code', label = 'code') {
  container.innerHTML = '';

  if (draft.length === 0) {
    const empty = document.createElement('div');
    empty.className   = 'codes-empty-msg';
    empty.textContent = `No ${label}s. Add one below.`;
    container.appendChild(empty);
  }

  draft.forEach((c, idx) => {
    const row = document.createElement('div');
    row.className = 'codes-row';

    const mkInput = (placeholder, field) => {
      const inp = document.createElement('input');
      inp.type           = 'text';
      inp.value          = c[field] || '';
      inp.placeholder    = placeholder;
      inp.className      = 'codes-inp';
      inp.dataset.testid = `${prefix}-${field}-${idx}`;
      inp.oninput = () => { draft[idx][field] = inp.value; };
      return inp;
    };

    row.append(mkInput('system URL', 'system'), mkInput('code *', 'code'), mkInput('display', 'display'));

    const removeBtn = document.createElement('button');
    removeBtn.type             = 'button';
    removeBtn.className        = 'codes-remove-btn';
    removeBtn.textContent      = '\u00D7';
    removeBtn.dataset.tipTitle = 'Remove';
    removeBtn.dataset.testid   = `${prefix}-remove-${idx}`;
    removeBtn.onclick = () => {
      draft.splice(idx, 1);
      renderCodesEditor(draft, container, prefix, label);
    };
    row.appendChild(removeBtn);

    container.appendChild(row);
  });

  const addBtn = document.createElement('button');
  addBtn.type           = 'button';
  addBtn.className      = 'codes-add-btn';
  addBtn.dataset.testid = `${prefix}s-add-btn`;
  addBtn.textContent    = `+ Add ${label}`;
  addBtn.onclick = () => {
    draft.push({ system: '', code: '', display: '' });
    renderCodesEditor(draft, container, prefix, label);
  };
  container.appendChild(addBtn);
}
