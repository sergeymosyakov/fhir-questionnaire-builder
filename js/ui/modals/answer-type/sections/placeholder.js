import { AnswerTypeSection } from '../base-section.js';
import { ANSWER_TYPE_SECTIONS } from '../registry.js';
import { ENTRY_FORMAT_TYPES } from '../data.js';

class PlaceholderSection extends AnswerTypeSection {
  isVisible(type) { return ENTRY_FORMAT_TYPES.has(type); }

  build(pending) {
    const section = document.createElement('div');
    section.className = 'at-modal-sub';

    const placeholderLbl = document.createElement('div');
    placeholderLbl.className        = 'at-modal-sub-lbl at-modal-sub-lbl--tip';
    placeholderLbl.textContent      = 'Placeholder hint (entryFormat):';
    placeholderLbl.dataset.tipTitle = 'Entry Format';
    placeholderLbl.dataset.tipBody  = 'Text shown inside the input field before the user types. Guides the expected format (e.g. MM/DD/YYYY, (999) 999-9999). Exported as the sdc-questionnaire-entryFormat SDC extension.';
    placeholderLbl.dataset.tipFhir  = 'item.extension[sdc-questionnaire-entryFormat].valueString';
    placeholderLbl.dataset.tipSpec  = 'SDC';

    const placeholderInp = document.createElement('input');
    placeholderInp.type           = 'text';
    placeholderInp.className      = 'at-modal-placeholder-inp';
    placeholderInp.dataset.testid = 'entry-format-input';
    placeholderInp.value          = pending.draftEntryFormat;
    placeholderInp.placeholder    = 'e.g. MM/DD/YYYY, (999) 999-9999';
    placeholderInp.oninput = () => { pending.draftEntryFormat = placeholderInp.value; };

    section.append(placeholderLbl, placeholderInp);

    // ── Multi-line toggle (text/string type only) ────────────────────────────
    const mlRow = document.createElement('label');
    mlRow.className = 'at-modal-sub';
    mlRow.style.display = pending.draftType === 'text' ? '' : 'none';
    const mlCb = Object.assign(document.createElement('input'), { type: 'checkbox', checked: !!pending.draftTextArea });
    mlCb.dataset.testid = 'text-area-toggle';
    mlCb.onchange = () => { pending.draftTextArea = mlCb.checked; };
    const mlLbl = document.createTextNode(' Multi-line (text-area control)');
    mlRow.dataset.tipTitle = 'Multi-line text';
    mlRow.dataset.tipBody  = 'Renders the text input as a multi-line textarea. Exports as questionnaire-itemControl = text-area.';
    mlRow.dataset.tipFhir  = 'item.extension[questionnaire-itemControl].valueCodeableConcept.coding.code = text-area';
    mlRow.dataset.tipSpec  = 'R4';
    mlRow.append(mlCb, mlLbl);
    section.appendChild(mlRow);
    this._mlRowEl = mlRow;

    return section;
  }

  onTypeChange(type) {
    if (this._mlRowEl) {
      this._mlRowEl.style.display = type === 'text' ? '' : 'none';
    }
  }

  commit(pending, node) {
    if (ENTRY_FORMAT_TYPES.has(node.itemType) && pending.draftEntryFormat.trim()) {
      node._entryFormat = pending.draftEntryFormat.trim();
    } else {
      delete node._entryFormat;
    }
    // Multi-line (text-area itemControl)
    if (node.itemType === 'text' && pending.draftTextArea) {
      node._itemControl = 'text-area';
    } else if (node._itemControl === 'text-area') {
      delete node._itemControl;
    }
  }

  initPending(node) {
    return {
      draftEntryFormat: node._entryFormat || '',
      draftTextArea:    node._itemControl === 'text-area',
    };
  }
}

ANSWER_TYPE_SECTIONS.push(new PlaceholderSection());
