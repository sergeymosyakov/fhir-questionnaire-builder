import { SECTION_REGISTRY, AnswerTypeSection } from '../base-section.js';
import { createCustomSelect } from '../../custom-select.js';
import { BUILDER_UNITS } from '../data.js';

class UnitSection extends AnswerTypeSection {
  isVisible(type) { return type === 'quantity'; }

  build(pending) {
    const section = document.createElement('div');
    section.className = 'at-modal-sub';

    const unitLbl = document.createElement('div');
    unitLbl.className        = 'at-modal-sub-lbl';
    unitLbl.textContent      = 'Default unit:';
    unitLbl.dataset.tipTitle = 'Quantity unit';
    unitLbl.dataset.tipBody  = 'Default UCUM unit code for this measurement field. Shown next to the numeric input in the preview.';
    unitLbl.dataset.tipFhir  = 'item.extension[questionnaire-unit].valueCoding.code';
    unitLbl.dataset.tipSpec  = 'R4';

    const unitSel = createCustomSelect({
      items: [
        { value: '', label: '\u2014 none \u2014' },
        ...BUILDER_UNITS.map(u => ({ value: u, label: u })),
      ],
      value:     pending.draftUnit || '',
      className: 'at-modal-sub-sel sc-trigger--full',
      testid:    'unit-sel',
      onChange:  v => { pending.draftUnit = v; },
    });

    section.append(unitLbl, unitSel.el);
    return section;
  }

  commit(pending, node) {
    node.quantityUnit = (node.itemType === 'quantity' && pending.draftUnit) ? pending.draftUnit : undefined;
  }

  initDraft(node) {
    return { draftUnit: node.quantityUnit || '' };
  }
}

SECTION_REGISTRY.push(new UnitSection());
