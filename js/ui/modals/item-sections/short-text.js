import { ItemSection } from './base-section.js';
import { ITEM_SECTIONS } from './registry.js';

class ShortTextSection extends ItemSection {
  initPending(node) {
    return { shortText: node._shortText || '' };
  }

  build(pending) {
    const row = document.createElement('div');
    row.className = 'meta-modal-row';

    const lbl = document.createElement('label');
    lbl.className        = 'meta-modal-lbl';
    lbl.htmlFor          = 'itemPropsShortTextInput';
    lbl.textContent      = 'Short Text';
    lbl.dataset.tipTitle = 'sdc-questionnaire-shortText';
    lbl.dataset.tipBody  = 'Abbreviated label used in summary views and narrow-screen layouts. Stored as sdc-questionnaire-shortText extension.';
    lbl.dataset.tipFhir  = 'item.extension[sdc-questionnaire-shortText].valueString';
    lbl.dataset.tipSpec  = 'SDC';

    const inp = document.createElement('input');
    inp.type           = 'text';
    inp.id             = 'itemPropsShortTextInput';
    inp.className      = 'meta-modal-inp';
    inp.placeholder    = 'Abbreviated label…';
    inp.dataset.testid = 'item-props-short-text';
    inp.value          = pending.shortText;
    inp.oninput = () => { pending.shortText = inp.value; };

    row.append(lbl, inp);
    return row;
  }

  commit(pending, node) {
    if (pending.shortText.trim()) node._shortText = pending.shortText.trim();
    else delete node._shortText;
  }
}

ITEM_SECTIONS.push(new ShortTextSection());
