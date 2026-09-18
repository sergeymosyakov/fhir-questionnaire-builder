import { AnswerTypeSection } from '../base-section.js';
import { ANSWER_TYPE_SECTIONS } from '../registry.js';
import { createCustomSelect } from '../../../custom-select.js';

// _itemControl values this section manages — mutually exclusive display text reveal styles.
const CONTROL_VALUES = new Set(['flyover', 'help']);

class DisplayControlSection extends AnswerTypeSection {
  isVisible(type) { return type === 'display'; }

  build(pending) {
    const section = document.createElement('div');
    section.className = 'at-modal-sub';

    const lbl = document.createElement('div');
    lbl.className        = 'at-modal-sub-lbl at-modal-sub-lbl--tip';
    lbl.textContent      = 'Display control:';
    lbl.dataset.tipTitle = 'Display Control';
    lbl.dataset.tipBody  = 'Controls how this display item\u2019s text is revealed to the user: always shown inline, on hover (Flyover), or behind a button the user must click (Help button).';
    lbl.dataset.tipFhir  = 'item.extension[questionnaire-itemControl].valueCodeableConcept.coding.code';
    lbl.dataset.tipSpec  = 'R4';

    const sel = createCustomSelect({
      items: [
        { value: '',        label: 'Inline (default)' },
        { value: 'flyover', label: 'Flyover (show on hover)' },
        { value: 'help',    label: 'Help button (show on click)' },
      ],
      value:     pending.draftDisplayControl,
      className: 'at-modal-sub-sel sc-trigger--full',
      testid:    'display-control-select',
      onChange:  v => { pending.draftDisplayControl = v; },
    });

    section.append(lbl, sel.el);
    return section;
  }

  commit(pending, node, _questDoc, _answerStore) {
    if (node.itemType === 'display' && CONTROL_VALUES.has(pending.draftDisplayControl)) {
      node._itemControl = pending.draftDisplayControl;
    } else if (CONTROL_VALUES.has(node._itemControl)) {
      delete node._itemControl;
    }
  }

  initPending(node) {
    return { draftDisplayControl: CONTROL_VALUES.has(node._itemControl) ? node._itemControl : '' };
  }
}

ANSWER_TYPE_SECTIONS.push(new DisplayControlSection());
