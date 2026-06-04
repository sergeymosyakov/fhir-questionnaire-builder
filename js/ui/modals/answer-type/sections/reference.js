import { AnswerTypeSection } from '../base-section.js';
import { ANSWER_TYPE_SECTIONS } from '../registry.js';
import { createCustomSelect } from '../../../custom-select.js';
import { FHIR_R4_TYPES } from '../data.js';

class ReferenceSection extends AnswerTypeSection {
  isVisible(type) { return type === 'reference'; }

  build(pending) {
    const section = document.createElement('div');
    section.className = 'at-modal-sub';

    // — Allowed resource type —
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

    // — Reference profile —
    const profLbl = document.createElement('div');
    profLbl.className        = 'at-modal-sub-lbl';
    profLbl.textContent      = 'Reference profiles (canonical URLs):';
    profLbl.dataset.tipTitle = 'questionnaire-referenceProfile';
    profLbl.dataset.tipBody  = 'Profile URLs that restrict valid resource types for reference items. One URL per line.';
    profLbl.dataset.tipFhir  = 'item.extension[questionnaire-referenceProfile].valueCanonical';
    profLbl.dataset.tipSpec  = 'R4';

    const profTa = document.createElement('textarea');
    profTa.rows            = 1;
    profTa.className       = 'style-modal-raw-ta';
    profTa.dataset.testid  = 'ref-profile-ta';
    profTa.value           = (pending.draftRefProfiles || []).join('\n');
    profTa.placeholder     = 'http://hl7.org/fhir/StructureDefinition/…';
    profTa.addEventListener('input', () => {
      pending.draftRefProfiles = profTa.value.split('\n').map(s => s.trim()).filter(Boolean);
    });

    section.append(profLbl, profTa);

    // — Reference filter —
    const filterLbl = document.createElement('div');
    filterLbl.className        = 'at-modal-sub-lbl';
    filterLbl.textContent      = 'Reference filter (FHIRPath):';
    filterLbl.dataset.tipTitle = 'questionnaire-referenceFilter';
    filterLbl.dataset.tipBody  = 'FHIRPath expression used to filter valid reference targets at runtime.';
    filterLbl.dataset.tipFhir  = 'item.extension[questionnaire-referenceFilter].valueString';
    filterLbl.dataset.tipSpec  = 'R4';

    const filterTa = document.createElement('textarea');
    filterTa.rows            = 1;
    filterTa.className       = 'style-modal-raw-ta';
    filterTa.dataset.testid  = 'ref-filter-ta';
    filterTa.value           = pending.draftRefFilter || '';
    filterTa.placeholder     = 'e.g. status = \'active\'';
    filterTa.addEventListener('input', () => { pending.draftRefFilter = filterTa.value; });

    section.append(filterLbl, filterTa);

    return section;
  }

  commit(pending, node) {
    node.referenceResource = (node.itemType === 'reference' && pending.draftRefRes) ? pending.draftRefRes : undefined;
    if (node.itemType === 'reference' && pending.draftRefProfiles?.length) {
      node._referenceProfiles = pending.draftRefProfiles;
    } else {
      delete node._referenceProfiles;
    }
    if (node.itemType === 'reference' && pending.draftRefFilter?.trim()) {
      node._referenceFilter = pending.draftRefFilter.trim();
    } else {
      delete node._referenceFilter;
    }
  }

  initPending(node) {
    return {
      draftRefRes: node.referenceResource || '',
      draftRefProfiles: node._referenceProfiles ? [...node._referenceProfiles] : [],
      draftRefFilter: node._referenceFilter || '',
    };
  }
}

ANSWER_TYPE_SECTIONS.push(new ReferenceSection());
