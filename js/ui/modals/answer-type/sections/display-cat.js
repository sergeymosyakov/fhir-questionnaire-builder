import { AnswerTypeSection } from '../base-section.js';
import { ANSWER_TYPE_SECTIONS } from '../registry.js';
import { createCustomSelect } from '../../../custom-select.js';

class DisplayCatSection extends AnswerTypeSection {
  isVisible(type) { return type === 'display'; }

  build(pending) {
    const section = document.createElement('div');
    section.className = 'at-modal-sub';

    const displayCatLbl = document.createElement('div');
    displayCatLbl.className        = 'at-modal-sub-lbl at-modal-sub-lbl--tip';
    displayCatLbl.textContent      = 'Display category:';
    displayCatLbl.dataset.tipTitle = 'Display Category';
    displayCatLbl.dataset.tipBody  = 'Controls the visual style of this display item. "Instructions" shows an info block, "Security" shows a warning notice, "Help" renders as a collapsible help toggle. Note: this extension is valid in FHIR R5; R4 validators may flag it on display-type items.';
    displayCatLbl.dataset.tipFhir  = 'item.extension[questionnaire-displayCategory].valueCodeableConcept.coding[0].code';
    displayCatLbl.dataset.tipSpec  = 'R5';

    const displayCatSel = createCustomSelect({
      items: [
        { value: '',             label: '\u2014 none \u2014' },
        { value: 'instructions', label: 'Instructions (\u2139 info block)' },
        { value: 'security',     label: 'Security notice (\u26A0 warning)' },
        { value: 'help',         label: 'Help (? collapsible)' },
      ],
      value:     pending.draftDisplayCategory,
      className: 'at-modal-sub-sel sc-trigger--full',
      testid:    'display-category-select',
      onChange:  v => { pending.draftDisplayCategory = v; },
    });

    section.append(displayCatLbl, displayCatSel.el);
    return section;
  }

  commit(pending, node) {
    if (node.itemType === 'display' && pending.draftDisplayCategory) {
      node._displayCategory = pending.draftDisplayCategory;
    } else {
      delete node._displayCategory;
    }
  }

  initPending(node) {
    return { draftDisplayCategory: node._displayCategory || '' };
  }
}

ANSWER_TYPE_SECTIONS.push(new DisplayCatSection());
