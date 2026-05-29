import { AnswerTypeSection } from '../base-section.js';
import { ANSWER_TYPE_SECTIONS } from '../registry.js';
import { createCustomSelect } from '../../../custom-select.js';
import { BUILDER_UNITS } from '../data.js';

class UnitSection extends AnswerTypeSection {
  isVisible(type) { return type === 'quantity'; }

  build(pending) {
    const section = document.createElement('div');
    section.className = 'at-modal-sub';

    // ── Default unit (fixed) ──────────────────────────────────────────────────
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

    // ── Unit ValueSet URL ─────────────────────────────────────────────────────
    const vsLbl = document.createElement('div');
    vsLbl.className        = 'at-modal-sub-lbl';
    vsLbl.textContent      = 'Unit ValueSet URL:';
    vsLbl.dataset.tipTitle = 'questionnaire-unitValueSet';
    vsLbl.dataset.tipBody  = 'Canonical URL of a ValueSet containing selectable UCUM units. When set, a unit dropdown is rendered next to the number input. Overrides "Default unit" in the preview.';
    vsLbl.dataset.tipFhir  = 'item.extension[questionnaire-unitValueSet].valueCanonical';
    vsLbl.dataset.tipSpec  = 'R4';

    const vsInp = document.createElement('textarea');
    vsInp.rows             = 1;
    vsInp.className        = 'at-modal-sub-inp';
    vsInp.placeholder      = 'http://unitsofmeasure.org/vs/…';
    vsInp.dataset.testid   = 'unit-valueset-url';
    vsInp.value            = pending.draftUnitValueSet || '';
    vsInp.oninput = () => { pending.draftUnitValueSet = vsInp.value.trim(); };

    section.append(unitLbl, unitSel.el, vsLbl, vsInp);
    return section;
  }

  commit(pending, node) {
    node.quantityUnit = (node.itemType === 'quantity' && pending.draftUnit) ? pending.draftUnit : undefined;
    if (node.itemType === 'quantity' && pending.draftUnitValueSet)
      node._unitValueSet = pending.draftUnitValueSet;
    else
      delete node._unitValueSet;
  }

  initPending(node) {
    return { draftUnit: node.quantityUnit || '', draftUnitValueSet: node._unitValueSet || '' };
  }
}

ANSWER_TYPE_SECTIONS.push(new UnitSection());
