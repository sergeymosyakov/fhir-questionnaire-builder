// ── Show When (enableWhen) edit modal ─────────────────────────────────────────
// Centered modal for editing a node's enableWhen conditions and
// enableWhenExpression. Uses a draft pattern — changes are only committed on Apply.
import { MODAL_REGISTRY } from './modal-registry.js';
import { Modal } from './modal-base.js';
import { createCustomSelect } from '../custom-select.js';
import { buildVisPanel } from '../../builder/panels.js';

class ShowWhenModal extends Modal {
  constructor() {
    super();
    this._pending = null;
    MODAL_REGISTRY.set('showWhen', this);
  }

  open(node, visLink, setActive) {
    const draft = Object.assign({}, node, {
      enableWhen:           JSON.parse(JSON.stringify(node.enableWhen || [])),
      enableBehavior:       node.enableBehavior       || 'all',
      enableWhenExpression: node.enableWhenExpression || '',
      _disabledDisplay:     node._disabledDisplay     || 'protected',
    });
    this._pending = { node, visLink, setActive, draft };

    this.setTitle('Show When', node.title || node.id || 'Item');
    this.body.innerHTML = '';
    buildVisPanel(draft, this.body, visLink, () => {});

    const ddRow = document.createElement('div');
    ddRow.className = 'sw-disabled-display-row';
    const ddLbl = document.createElement('label');
    ddLbl.textContent = 'When not visible:';
    ddLbl.dataset.tipTitle = 'Disabled display';
    ddLbl.dataset.tipBody  = '"Protected" keeps the item grayed-out and read-only when its condition is not met. "Hidden" removes it from the form entirely.';
    ddLbl.dataset.tipFhir  = 'item.extension[questionnaire-disabledDisplay].valueCode';
    ddLbl.dataset.tipSpec  = 'SDC';
    const ddSel = createCustomSelect({
      items: [
        { value: 'protected', label: 'Show grayed (protected)' },
        { value: 'hidden',    label: 'Remove from view (hidden)' },
      ],
      value:    draft._disabledDisplay,
      testid:   'disabled-display-select',
      className: 'sc-trigger--sm',
      onChange:  v => { draft._disabledDisplay = v; },
    });
    ddRow.append(ddLbl, ddSel.el);
    this.body.appendChild(ddRow);

    super.open();
    Modal._svc.refreshExprIcons();
  }

  _apply() {
    if (!this._pending) return;
    const { node, draft, visLink, setActive } = this._pending;
    node.enableWhen           = draft.enableWhen;
    node.enableBehavior       = draft.enableBehavior;
    node.enableWhenExpression = draft.enableWhenExpression;
    if (draft._disabledDisplay && draft._disabledDisplay !== 'protected') {
      node._disabledDisplay = draft._disabledDisplay;
    } else {
      delete node._disabledDisplay;
    }
    setActive(visLink, node.enableWhen.length > 0 || !!node.enableWhenExpression);
    Modal._svc.triggerCalcRecalc();
    this._cancel();
  }

  _cancel() {
    this._pending = null;
    this.body.innerHTML = '';
    this.close();
  }
}
new ShowWhenModal();
