// ── Answer Type edit modal ────────────────────────────────────────────────────
// Centered modal for editing item type, options, and answerValueSet.
import { MODAL_REGISTRY } from '../modal-registry.js';
import { Modal } from '../modal-base.js';
import { createItemNode } from '../../../nodes/index.js';
import { createCustomSelect } from '../../custom-select.js';
import { ITEM_TYPES } from './data.js';
import { ANSWER_TYPE_SECTIONS } from './index.js';
import { AppEvents } from '../../../events.js';

// Replace a node in the tree array (recursive, in-place splice).
function _replaceInTree(treeArr, nodeId, newNode) {
  for (let i = 0; i < treeArr.length; i++) {
    if (treeArr[i].id === nodeId) { treeArr.splice(i, 1, newNode); return true; }
    if (treeArr[i].children && _replaceInTree(treeArr[i].children, nodeId, newNode)) return true;
  }
  return false;
}

class AnswerTypeModal extends Modal {
  getName() { return 'answerTypeModal'; }
  constructor() {
    super();
    this._pending = null;
    MODAL_REGISTRY.set('answerType', this);
  }

  open(node, typeLink, setActive) {
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
    let node = this._pending.node;

    if (node.itemType !== this._pending.draftType) {
      const id = node.id;
      Modal._svc.deleteValue(id);
      const n = Modal._svc.values[id + '$$n'] || 0;
      for (let i = 1; i <= n; i++) Modal._svc.deleteValue(id + '$$' + i);
      delete Modal._svc.values[id + '$$n'];
    }

    const newNode = createItemNode(this._pending.draftType, { id: node.id });
    Object.assign(newNode, node, { itemType: this._pending.draftType });
    _replaceInTree(Modal._svc.tree, node.id, newNode);
    node = newNode;

    if (!node.supportsRepeat() && node.repeats) {
      node.repeats = false;
      delete node._minOccurs;
      delete node._maxOccurs;
    }

    ANSWER_TYPE_SECTIONS.forEach(s => s.commit(this._pending, node));
    document.dispatchEvent(new CustomEvent(AppEvents.BUILDER_RERENDER));
    Modal._svc.triggerCalcRecalc();
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

    const built = ANSWER_TYPE_SECTIONS.map(s => ({ s, el: s.build(this._pending) }));

    const typeSel = createCustomSelect({
      items:     ITEM_TYPES.map(t => ({ value: t, label: t })),
      value:     this._pending.draftType,
      className: 'at-modal-type-sel sc-trigger--full',
      testid:    'type-select',
      onChange:  v => {
        this._pending.draftType = v;
        built.forEach(({ s, el }) => {
          el.style.display = s.isVisible(v) ? '' : 'none';
          s.onTypeChange(v);
        });
      },
    });
    typeRow.append(typeLbl, typeSel.el);
    container.appendChild(typeRow);

    built.forEach(({ s, el }) => {
      el.style.display = s.isVisible(this._pending.draftType) ? '' : 'none';
      container.appendChild(el);
    });
  }
}
new AnswerTypeModal();
