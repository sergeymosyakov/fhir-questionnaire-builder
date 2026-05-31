import { StatesSection } from './base-section.js';
import { STATES_SECTIONS } from './registry.js';
import { createCustomSelect } from '../../custom-select.js';

const USAGE_MODES = [
  { value: '',                          label: '— not set —' },
  { value: 'capture',                   label: 'capture' },
  { value: 'display',                   label: 'display' },
  { value: 'display-non-empty',         label: 'display-non-empty' },
  { value: 'capture-display',           label: 'capture-display' },
  { value: 'capture-display-non-empty', label: 'capture-display-non-empty' },
];

class UsageModeSection extends StatesSection {
  initPending(node) {
    return { draftUsageMode: node._usageMode || '' };
  }

  build(pending) {
    const row = document.createElement('div');
    row.className = 'states-modal-field-row';

    const lbl = document.createElement('label');
    lbl.className        = 'states-modal-chk-label';
    lbl.textContent      = 'Usage mode:';
    lbl.dataset.tipTitle = 'questionnaire-usageMode';
    lbl.dataset.tipBody  = 'Controls when this item is shown:\n\u2022 capture \u2014 only during data entry\n\u2022 display \u2014 only when displaying completed data\n\u2022 display-non-empty \u2014 display only if answered\n\u2022 capture-display \u2014 both modes\n\u2022 capture-display-non-empty \u2014 capture always, display only if answered';
    lbl.dataset.tipFhir  = 'item.extension[questionnaire-usageMode].valueCode';
    lbl.dataset.tipSpec  = 'R4';

    const sel = createCustomSelect({
      items:    USAGE_MODES,
      value:    pending.draftUsageMode,
      onChange: v => { pending.draftUsageMode = v; },
      testid:   'states-usage-mode',
    });

    row.appendChild(lbl);
    row.appendChild(sel.el);
    return row;
  }

  commit(pending, node) {
    if (pending.draftUsageMode) {
      node._usageMode = pending.draftUsageMode;
    } else {
      delete node._usageMode;
    }
  }
}

STATES_SECTIONS.push(new UsageModeSection());
