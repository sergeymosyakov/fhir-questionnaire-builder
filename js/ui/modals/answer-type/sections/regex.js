import { AnswerTypeSection } from '../base-section.js';
import { ANSWER_TYPE_SECTIONS } from '../registry.js';

const REGEX_TYPES = new Set(['text', 'url']);

class RegexSection extends AnswerTypeSection {
  isVisible(type) { return REGEX_TYPES.has(type); }

  build(pending) {
    const section = document.createElement('div');
    section.className = 'at-modal-sub';

    const lbl = document.createElement('div');
    lbl.className        = 'at-modal-sub-lbl at-modal-sub-lbl--tip';
    lbl.textContent      = 'Regex validation pattern:';
    lbl.dataset.tipTitle = 'Regex';
    lbl.dataset.tipBody  = 'A regular expression pattern that the value must match. Shown as a validation error in the preview when the entered value does not match. Exported as the regex extension on the item.';
    lbl.dataset.tipFhir  = 'item.extension[regex].valueString';
    lbl.dataset.tipSpec  = 'R4';

    const inp = document.createElement('input');
    inp.type           = 'text';
    inp.className      = 'at-modal-placeholder-inp';
    inp.dataset.testid = 'regex-input';
    inp.value          = pending.draftRegex;
    inp.placeholder    = 'e.g. [A-Z]{2}\\d{4}';
    inp.oninput = () => { pending.draftRegex = inp.value; };

    section.append(lbl, inp);
    return section;
  }

  commit(pending, node) {
    if (REGEX_TYPES.has(node.itemType) && pending.draftRegex.trim()) {
      node._regex = pending.draftRegex.trim();
    } else {
      delete node._regex;
    }
  }

  initPending(node) {
    return { draftRegex: node._regex || '' };
  }
}

ANSWER_TYPE_SECTIONS.push(new RegexSection());
