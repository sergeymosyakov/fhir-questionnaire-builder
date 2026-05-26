import { StatesSection } from './base-section.js';
import { STATES_SECTIONS } from './registry.js';

class ReadOnlySection extends StatesSection {
  initPending(node) {
    return { draftReadOnly: !!node._readOnly };
  }

  isVisible(node) { return node.type === 'item'; }

  build(pending) {
    const row = document.createElement('div');
    row.className = 'states-modal-check-row';

    const chk = document.createElement('input');
    chk.type             = 'checkbox';
    chk.id               = 'statesReadOnly';
    chk.dataset.testid   = 'states-readonly-chk';
    chk.checked          = pending.draftReadOnly;
    chk.addEventListener('change', () => { pending.draftReadOnly = chk.checked; });

    const lbl = document.createElement('label');
    lbl.htmlFor     = 'statesReadOnly';
    lbl.className   = 'states-modal-chk-label';
    lbl.textContent = 'Read-only';

    const hint = document.createElement('span');
    hint.className   = 'states-modal-chk-hint';
    hint.textContent = 'Value set programmatically \u2014 user cannot edit. Typically combined with a calculatedExpression.';

    row.appendChild(chk);
    row.appendChild(lbl);
    row.appendChild(hint);
    return row;
  }

  commit(pending, node) {
    if (node.type === 'item') node._readOnly = pending.draftReadOnly || undefined;
  }
}

STATES_SECTIONS.push(new ReadOnlySection());
