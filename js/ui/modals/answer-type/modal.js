// ── Answer Type edit modal ────────────────────────────────────────────────────
// Centered modal for editing item type, options, and answerValueSet.
import { MODAL_REGISTRY } from '../modal-registry.js';
import { Modal } from '../modal-base.js';
import { AppEvents } from '../../../events.js';
import { changeNodeType } from '../../../nodes/change-type.js';
import { createCustomSelect } from '../../custom-select.js';
import { ITEM_TYPES } from './data.js';
import { ANSWER_TYPE_SECTIONS } from './index.js';

class AnswerTypeModal extends Modal {
  getName() { return 'answerTypeModal'; }
  constructor() {
    super();
    this._pending = null;
    MODAL_REGISTRY.set('answerType', this);
  }

  open(node, typeLink, setActive, questDoc, answerStore) {
    this._questDoc    = questDoc;
    this._answerStore = answerStore;
    this._pending = Object.assign(
      { node, typeLink, setActive, draftType: node.itemType },
      ...ANSWER_TYPE_SECTIONS.map(s => s.initPending(node)),
    );
    this.setTitle('Answer Type', node.title || node.id || 'Item');
    this.body.innerHTML = '';
    this._renderBody();
    super.open();
  }

  _apply() {
    if (!this._pending) return;
    const node = changeNodeType(this._pending.node, this._pending.draftType, this._questDoc?.tree, this._answerStore);

    ANSWER_TYPE_SECTIONS.forEach(s => s.commit(this._pending, node, this._questDoc, this._answerStore));
    document.dispatchEvent(new CustomEvent(AppEvents.BUILDER_RERENDER));
    document.dispatchEvent(new CustomEvent(AppEvents.CALC_RECALC_REQUESTED));
    this._cancel();
  }

  _cancel() {
    this._pending = null;
    this.close();
  }

  _renderBody() {
    const container = this.body;
    const hint = document.createElement('div');
    hint.className   = 'panel-hint';
    hint.textContent = 'Sets the FHIR item type. For coded-answer types you can supply a plain options list or link to a contained[] ValueSet.';
    container.appendChild(hint);

    const typeRow = document.createElement('div');
    typeRow.className = 'at-modal-type-row';
    const typeLbl = document.createElement('label');
    typeLbl.className        = 'at-modal-lbl';
    typeLbl.textContent      = 'Type:';
    typeLbl.dataset.tipTitle = 'Item type';
    typeLbl.dataset.tipBody  = 'The FHIR data type for answers to this item. Determines which control is rendered in the preview.';
    typeLbl.dataset.tipFhir  = 'Questionnaire.item.type';
    typeLbl.dataset.tipSpec  = 'R4';

    const built = ANSWER_TYPE_SECTIONS.map(s => ({ s, el: s.build(this._pending, this._questDoc, this._answerStore) }));

    const fhirTarget = this._questDoc?.fhirTarget ?? 'R4';
    const filteredTypes = fhirTarget === 'R5'
      ? ITEM_TYPES.filter(t => t !== 'open-choice')
      : ITEM_TYPES;
    const typeSel = createCustomSelect({
      items:     filteredTypes.map(t => ({ value: t, label: t })),
      value:     this._pending.draftType,
      className: 'at-modal-type-sel sc-trigger--full',
      testid:    'type-select',
      onChange:  v => {
        this._pending.draftType = v;
        built.forEach(({ s, el }) => {
          el.style.display = (s.isVersionVisible() && s.isVisible(v)) ? '' : 'none';
          s.onTypeChange(v);
        });
      },
    });
    typeRow.append(typeLbl, typeSel.el);
    container.appendChild(typeRow);

    built.forEach(({ s, el }) => {
      el.style.display = (s.isVersionVisible() && s.isVisible(this._pending.draftType)) ? '' : 'none';
      container.appendChild(el);
    });
  }
}
new AnswerTypeModal();
