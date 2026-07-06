import { StatesSection } from './base-section.js';
import { STATES_SECTIONS } from './registry.js';

class IsSubjectSection extends StatesSection {
  initPending(node) {
    return { draftIsSubject: !!node._isSubject };
  }

  isVisible(node) { return node.type === 'item' && node.itemType !== 'display'; }

  build(pending) {
    const row = document.createElement('div');
    row.className = 'states-modal-check-row';

    const chk = document.createElement('input');
    chk.type           = 'checkbox';
    chk.id             = 'statesIsSubject';
    chk.dataset.testid = 'states-issubject-chk';
    chk.checked        = pending.draftIsSubject;
    chk.addEventListener('change', () => { pending.draftIsSubject = chk.checked; });

    const lbl = document.createElement('label');
    lbl.htmlFor          = 'statesIsSubject';
    lbl.className        = 'states-modal-chk-label';
    lbl.textContent      = 'Is subject';
    lbl.dataset.tipTitle = 'sdc-questionnaire-isSubject';
    lbl.dataset.tipBody  = 'Marks the item whose answer identifies the subject of the QuestionnaireResponse (QuestionnaireResponse.subject). Only one item per questionnaire may be the subject.';
    lbl.dataset.tipFhir  = 'item.extension[sdc-questionnaire-isSubject].valueBoolean';
    lbl.dataset.tipSpec  = 'SDC';

    const hint = document.createElement('span');
    hint.className   = 'states-modal-chk-hint';
    hint.textContent = 'This item\u2019s answer becomes QuestionnaireResponse.subject (sdc-questionnaire-isSubject). At most one per form.';

    row.appendChild(chk);
    row.appendChild(lbl);
    row.appendChild(hint);
    return row;
  }

  commit(pending, node) {
    node._isSubject = pending.draftIsSubject || undefined;
  }

  buildPatch(pending, _node) {
    return { _isSubject: pending.draftIsSubject || null };
  }
}

STATES_SECTIONS.push(new IsSubjectSection());
