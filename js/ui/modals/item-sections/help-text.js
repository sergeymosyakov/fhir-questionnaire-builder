import { ItemSection } from './base-section.js';
import { ITEM_SECTIONS } from './registry.js';

class HelpTextSection extends ItemSection {
  initPending(node) {
    return { helpText: node._helpText || '' };
  }

  build(pending) {
    const row = document.createElement('div');
    row.className = 'meta-modal-row';

    const lbl = document.createElement('label');
    lbl.className        = 'meta-modal-lbl';
    lbl.htmlFor          = 'itemPropsHelpTextInput';
    lbl.textContent      = 'Help Text';
    lbl.dataset.tipTitle = 'Help text';
    lbl.dataset.tipBody  = 'Shown as a "? Help" button next to this item; clicking reveals the text. Stored as a nested display item with questionnaire-itemControl = help — not applicable to display items themselves.';
    lbl.dataset.tipFhir  = 'item.item[].extension[questionnaire-itemControl].valueCodeableConcept.coding.code = help';
    lbl.dataset.tipSpec  = 'R4';

    const inp = document.createElement('textarea');
    inp.id             = 'itemPropsHelpTextInput';
    inp.className      = 'meta-modal-inp';
    inp.rows           = 3;
    inp.placeholder    = 'Extra guidance shown behind a Help button\u2026';
    inp.dataset.testid = 'item-props-help-text';
    inp.value          = pending.helpText;
    inp.oninput = () => { pending.helpText = inp.value; };

    row.append(lbl, inp);
    return row;
  }

  commit(pending, node) {
    if (pending.helpText.trim()) node._helpText = pending.helpText.trim();
    else delete node._helpText;
  }

  buildPatch(pending, _node) {
    return { _helpText: pending.helpText.trim() || null };
  }
}

ITEM_SECTIONS.push(new HelpTextSection());
