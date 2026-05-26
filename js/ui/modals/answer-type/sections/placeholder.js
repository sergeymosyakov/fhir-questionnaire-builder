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
    return section;
  }

  commit(pending, node) {
    if (ENTRY_FORMAT_TYPES.has(node.itemType) && pending.draftEntryFormat.trim()) {
      node._entryFormat = pending.draftEntryFormat.trim();
    } else {
      delete node._entryFormat;
    }
  }

  initPending(node) {
    return { draftEntryFormat: node._entryFormat || '' };
  }
}

ANSWER_TYPE_SECTIONS.push(new PlaceholderSection());
