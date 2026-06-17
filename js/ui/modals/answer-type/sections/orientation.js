import { AnswerTypeSection } from '../base-section.js';
import { ANSWER_TYPE_SECTIONS } from '../registry.js';
import { createCustomSelect } from '../../../custom-select.js';

class OrientationSection extends AnswerTypeSection {
  isVisible(type) { return type === 'radio'; }

  build(pending) {
    const section = document.createElement('div');
    section.className = 'at-modal-sub';

    const orientLbl = document.createElement('div');
    orientLbl.className        = 'at-modal-sub-lbl at-modal-sub-lbl--tip';
    orientLbl.textContent      = 'Choice orientation:';
    orientLbl.dataset.tipTitle = 'Choice Orientation';
    orientLbl.dataset.tipBody  = 'Controls whether radio buttons are stacked vertically or placed side by side horizontally. Exported as the questionnaire-choiceOrientation extension.';
    orientLbl.dataset.tipFhir  = 'item.extension[questionnaire-choiceOrientation].valueCode';
    orientLbl.dataset.tipSpec  = 'R4';

    const orientSel = createCustomSelect({
      items: [
        { value: '',           label: '\u2014 default \u2014' },
        { value: 'vertical',   label: 'Vertical (stacked)' },
        { value: 'horizontal', label: 'Horizontal (inline)' },
      ],
      value:     pending.draftOrientation,
      className: 'at-modal-sub-sel sc-trigger--full',
      testid:    'orientation-select',
      onChange:  v => { pending.draftOrientation = v; },
    });

    section.append(orientLbl, orientSel.el);
    return section;
  }

  commit(pending, node, _questDoc, _answerStore) {
    if (node.itemType === 'radio' && pending.draftOrientation) {
      node._choiceOrientation = pending.draftOrientation;
    } else {
      delete node._choiceOrientation;
    }
  }

  initPending(node) {
    return { draftOrientation: node._choiceOrientation || '' };
  }
}

ANSWER_TYPE_SECTIONS.push(new OrientationSection());
