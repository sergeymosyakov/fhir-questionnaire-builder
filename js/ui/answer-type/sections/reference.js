import { SECTION_REGISTRY, AnswerTypeSection } from '../base-section.js';
import { createCustomSelect } from '../../custom-select.js';
import { FHIR_R4_TYPES } from '../data.js';

class ReferenceSection extends AnswerTypeSection {
  isVisible(type) { return type === 'reference'; }

  build(pending) {
    const section = document.createElement('div');
    section.className = 'at-modal-sub';

    const refLbl = document.createElement('div');
    refLbl.className        = 'at-modal-sub-lbl';
    refLbl.textContent      = 'Allowed resource type:';
    refLbl.dataset.tipTitle = 'Reference resource type';
    refLbl.dataset.tipBody  = 'Restricts which FHIR resource types are valid answer references. Leave blank to allow any type.';
    refLbl.dataset.tipFhir  = 'item.extension[questionnaire-referenceResource].valueCode';
    refLbl.dataset.tipSpec  = 'R4';

    const refSel = createCustomSelect({
      items: [
        { value: '', label: '\u2014 Any (unrestricted) \u2014' },
        ...[...new Set(FHIR_R4_TYPES)].sort().map(t => ({ value: t, label: t })),
      ],
      value:     pending.draftRefRes || '',
      className: 'at-modal-sub-sel sc-trigger--full',
      testid:    'ref-resource-sel',
      onChange:  v => { pending.draftRefRes = v; },
    });

    section.append(refLbl, refSel.el);
    return section;
  }

  commit(pending, node) {
    node.referenceResource = (node.itemType === 'reference' && pending.draftRefRes) ? pending.draftRefRes : undefined;
  }
}

  initDraft(node) {
    return { draftRefRes: node.referenceResource || '' };
  }
}

SECTION_REGISTRY.push(new ReferenceSection());
