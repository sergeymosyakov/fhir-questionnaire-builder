import { AnswerTypeSection } from '../base-section.js';
import { ANSWER_TYPE_SECTIONS } from '../registry.js';

class DisplayFlyoverSection extends AnswerTypeSection {
  isVisible(type) { return type === 'display'; }

  build(pending) {
    const section = document.createElement('div');
    section.className = 'at-modal-sub';

    const row = document.createElement('label');
    row.className        = 'at-modal-multiline-row';
    row.dataset.tipTitle = 'Flyover';
    row.dataset.tipBody  = 'Hides the display text inline and reveals it as a hover tooltip (an ⓘ marker). Useful for optional help that should not clutter the form. Exported as questionnaire-itemControl = flyover.';
    row.dataset.tipFhir  = 'item.extension[questionnaire-itemControl].valueCodeableConcept.coding.code = flyover';
    row.dataset.tipSpec  = 'R4';

    const cb = Object.assign(document.createElement('input'), {
      type:    'checkbox',
      checked: !!pending.draftFlyover,
    });
    cb.dataset.testid = 'display-flyover-toggle';
    cb.onchange = () => { pending.draftFlyover = cb.checked; };

    const lbl = document.createTextNode(' Flyover (show text on hover)');
    row.append(cb, lbl);
    section.appendChild(row);
    return section;
  }

  commit(pending, node, _questDoc, _answerStore) {
    if (node.itemType === 'display' && pending.draftFlyover) {
      node._itemControl = 'flyover';
    } else if (node._itemControl === 'flyover') {
      delete node._itemControl;
    }
  }

  initPending(node) {
    return { draftFlyover: node._itemControl === 'flyover' };
  }
}

ANSWER_TYPE_SECTIONS.push(new DisplayFlyoverSection());
