import { StatesSection } from './base-section.js';
import { STATES_SECTIONS } from './registry.js';

class HiddenSection extends StatesSection {
  initPending(node) {
    return { draftHidden: !!node._hidden };
  }

  build(pending) {
    const row = document.createElement('div');
    row.className = 'states-modal-check-row';

    const chk = document.createElement('input');
    chk.type           = 'checkbox';
    chk.id             = 'statesHidden';
    chk.dataset.testid = 'states-hidden-chk';
    chk.checked        = pending.draftHidden;
    chk.addEventListener('change', () => { pending.draftHidden = chk.checked; });

    const lbl = document.createElement('label');
    lbl.htmlFor     = 'statesHidden';
    lbl.className   = 'states-modal-chk-label';
    lbl.textContent = 'Hidden';

    const hint = document.createElement('span');
    hint.className   = 'states-modal-chk-hint';
    hint.textContent = 'Excluded from patient view (sdc-questionnaire-hidden). Still participates in calculatedExpression logic.';

    row.appendChild(chk);
    row.appendChild(lbl);
    row.appendChild(hint);
    return row;
  }

  commit(pending, node) {
    node._hidden = pending.draftHidden || undefined;
  }
}

STATES_SECTIONS.push(new HiddenSection());
