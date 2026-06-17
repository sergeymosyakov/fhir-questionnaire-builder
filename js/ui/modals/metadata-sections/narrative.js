import { Section } from '../section.js';
import { META_SECTIONS } from './registry.js';

class NarrativeSection extends Section {
  build(_pending, questMeta) {
    const frag = document.createDocumentFragment();

    const narrativeRow = document.createElement('div');
    narrativeRow.className = 'meta-modal-row';
    const narrativeLbl = document.createElement('label');
    narrativeLbl.className        = 'meta-modal-lbl';
    narrativeLbl.textContent      = 'Narrative:';
    narrativeLbl.dataset.tipTitle = 'Questionnaire.text';
    narrativeLbl.dataset.tipBody  = 'FHIR Narrative (Questionnaire.text). ' +
      (questMeta._rawText
        ? 'Preserved from the imported file and written back unchanged on export.'
        : 'Not present in the imported file \u2014 auto-generated from title, status, and items on export (status: "generated").');
    narrativeLbl.dataset.tipFhir  = 'Questionnaire.text';
    narrativeLbl.dataset.tipSpec  = 'R4';
    const narrativeVal = document.createElement('span');
    narrativeVal.className        = 'meta-modal-readonly';
    narrativeVal.dataset.testid   = 'meta-narrative-status';
    narrativeVal.textContent      = questMeta._rawText
      ? 'preserved \u00b7 status: ' + questMeta._rawText.status
      : 'generated on export \u00b7 status: generated';
    narrativeRow.append(narrativeLbl, narrativeVal);
    frag.appendChild(narrativeRow);

    if (questMeta._rawText) {
      const narrativeDivRow = document.createElement('div');
      narrativeDivRow.className = 'meta-modal-row';
      const narrativeDivSpacer = document.createElement('div');
      narrativeDivSpacer.className = 'meta-modal-lbl';
      const narrativeDivPre = document.createElement('pre');
      narrativeDivPre.className   = 'meta-modal-narrative';
      narrativeDivPre.textContent = questMeta._rawText.div;
      narrativeDivRow.append(narrativeDivSpacer, narrativeDivPre);
      frag.appendChild(narrativeDivRow);
    }

    return frag;
  }
}

META_SECTIONS.push(new NarrativeSection());
