import { RepeatableSection } from './base-section.js';
import { REPEATABLE_SECTIONS } from './registry.js';
import { getValue, setValue, deleteValue } from '../../../state.js';

class RepeatSection extends RepeatableSection {
  initPending(node) {
    return {
      draftRepeats: !!node.repeats,
      draftMin:     node._minOccurs !== undefined ? String(node._minOccurs) : '',
      draftMax:     node._maxOccurs !== undefined ? String(node._maxOccurs) : '',
    };
  }

  build(pending) {
    const frag = document.createDocumentFragment();

    // ── Hint ────────────────────────────────────────────────────────────────
    const hint = document.createElement('div');
    hint.className   = 'panel-hint';
    hint.textContent = 'Allow multiple answers for this item. Use cardinality to enforce minimum and maximum answer counts.';
    frag.appendChild(hint);

    const section = document.createElement('div');
    section.className = 'panel-sub-section';
    frag.appendChild(section);

    // ── Repeatable toggle ────────────────────────────────────────────────────
    const toggleRow = document.createElement('div');
    toggleRow.className = 'repeat-modal-toggle-row';

    const cb = document.createElement('input');
    cb.type             = 'checkbox';
    cb.id               = '_rmToggle';
    cb.className        = 'repeat-modal-cb';
    cb.checked          = pending.draftRepeats;
    cb.dataset.testid   = 'repeat-modal-toggle';

    const cbLabel = document.createElement('label');
    cbLabel.htmlFor          = '_rmToggle';
    cbLabel.className        = 'repeat-modal-cb-label';
    cbLabel.textContent      = 'Repeatable (item.repeats)';
    cbLabel.dataset.tipTitle = 'item.repeats';
    cbLabel.dataset.tipBody  = 'When true, the user can provide multiple answers for this item. All answers are collected into item.answer[] in the exported QuestionnaireResponse.';
    cbLabel.dataset.tipFhir  = 'Questionnaire.item.repeats';
    cbLabel.dataset.tipSpec  = 'R4';

    toggleRow.appendChild(cb);
    toggleRow.appendChild(cbLabel);
    section.appendChild(toggleRow);

    // ── Cardinality card (shown only when repeats = true) ────────────────────
    const card = document.createElement('div');
    card.className     = 'repeat-modal-card';
    card.style.display = pending.draftRepeats ? '' : 'none';

    const cardTitle = document.createElement('div');
    cardTitle.className        = 'repeat-modal-card-title';
    cardTitle.textContent      = 'Cardinality';
    cardTitle.dataset.tipTitle = 'Cardinality constraints';
    cardTitle.dataset.tipBody  = 'Enforces minimum and maximum answer counts. Exported as SDC extensions questionnaire-minOccurs and questionnaire-maxOccurs.';
    cardTitle.dataset.tipFhir  = 'item.extension[questionnaire-minOccurs / questionnaire-maxOccurs]';
    cardTitle.dataset.tipSpec  = 'SDC';
    card.appendChild(cardTitle);

    const grid = document.createElement('div');
    grid.className = 'repeat-modal-grid';

    // Min row
    const minLbl = document.createElement('label');
    minLbl.textContent      = 'Min answers:';
    minLbl.className        = 'repeat-modal-lbl';
    minLbl.dataset.tipTitle = 'Minimum answers';
    minLbl.dataset.tipBody  = 'Minimum number of answers required. 0 or empty means the item is optional.';
    minLbl.dataset.tipFhir  = 'item.extension[questionnaire-minOccurs].valueInteger';
    minLbl.dataset.tipSpec  = 'SDC';

    const minInp = document.createElement('input');
    minInp.type           = 'number';
    minInp.min            = '0';
    minInp.step           = '1';
    minInp.className      = 'panel-inp-sm';
    minInp.dataset.testid = 'repeat-modal-min';
    minInp.placeholder    = '0 = optional';
    minInp.value          = pending.draftMin;
    minInp.oninput = () => { pending.draftMin = minInp.value; };

    const minHint = document.createElement('span');
    minHint.className   = 'repeat-modal-hint';
    minHint.textContent = 'questionnaire-minOccurs';

    // Max row
    const maxLbl = document.createElement('label');
    maxLbl.textContent      = 'Max answers:';
    maxLbl.className        = 'repeat-modal-lbl';
    maxLbl.dataset.tipTitle = 'Maximum answers';
    maxLbl.dataset.tipBody  = 'Maximum number of answers allowed. Empty means unlimited.';
    maxLbl.dataset.tipFhir  = 'item.extension[questionnaire-maxOccurs].valueInteger';
    maxLbl.dataset.tipSpec  = 'SDC';

    const maxInp = document.createElement('input');
    maxInp.type           = 'number';
    maxInp.min            = '1';
    maxInp.step           = '1';
    maxInp.className      = 'panel-inp-sm';
    maxInp.dataset.testid = 'repeat-modal-max';
    maxInp.placeholder    = 'empty = \u221e';
    maxInp.value          = pending.draftMax;
    maxInp.oninput = () => { pending.draftMax = maxInp.value; };

    const maxHint = document.createElement('span');
    maxHint.className   = 'repeat-modal-hint';
    maxHint.textContent = 'questionnaire-maxOccurs';

    grid.appendChild(minLbl); grid.appendChild(minInp); grid.appendChild(minHint);
    grid.appendChild(maxLbl); grid.appendChild(maxInp); grid.appendChild(maxHint);
    card.appendChild(grid);
    section.appendChild(card);

    cb.onchange = () => {
      pending.draftRepeats  = cb.checked;
      card.style.display    = cb.checked ? '' : 'none';
    };

    return frag;
  }

  commit(pending, node) {
    node.repeats = pending.draftRepeats;

    if (pending.draftRepeats) {
      const min = pending.draftMin !== '' ? parseInt(pending.draftMin, 10) : undefined;
      const max = pending.draftMax !== '' ? parseInt(pending.draftMax, 10) : undefined;

      if (min !== undefined && !isNaN(min)) node._minOccurs = min; else delete node._minOccurs;

      if (max !== undefined && !isNaN(max)) {
        node._maxOccurs = max;
        // Trim extra rows that now exceed maxOccurs
        const id       = node.id;
        const currentN = getValue(id + '$$n') || 0;
        if (currentN + 1 > max) {
          const keepN = max - 1;
          for (let i = keepN + 1; i <= currentN; i++) deleteValue(id + '$$' + i);
          if (keepN <= 0) deleteValue(id + '$$n'); else setValue(id + '$$n', keepN);
        }
      } else {
        delete node._maxOccurs;
      }
    } else {
      delete node._minOccurs;
      delete node._maxOccurs;
    }
  }
}

REPEATABLE_SECTIONS.push(new RepeatSection());
