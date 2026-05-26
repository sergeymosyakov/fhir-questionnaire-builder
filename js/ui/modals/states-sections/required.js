import { StatesSection } from './base-section.js';
import { STATES_SECTIONS } from './registry.js';
import { createCustomSelect, toKey, fromKey, REQUIRED_OPTIONS } from './helpers.js';

class RequiredSection extends StatesSection {
  initPending(node) {
    return { draftMandatory: node.mandatory };
  }

  build(pending) {
    const row = document.createElement('div');
    row.className = 'states-modal-row';

    const lbl = document.createElement('label');
    lbl.className   = 'states-modal-label';
    lbl.textContent = 'Required:';

    const sel = createCustomSelect({
      items:     REQUIRED_OPTIONS,
      value:     toKey(pending.draftMandatory),
      onChange:  v => { pending.draftMandatory = fromKey(v); },
      className: 'states-modal-sel sc-trigger--full',
      testid:    'states-required-sel',
    });

    row.appendChild(lbl);
    row.appendChild(sel.el);
    return row;
  }

  commit(pending, node) {
    node.mandatory = pending.draftMandatory;
  }
}

STATES_SECTIONS.push(new RequiredSection());
