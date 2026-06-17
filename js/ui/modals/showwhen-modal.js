// ── Show When (enableWhen) edit modal ─────────────────────────────────────────
// Centered modal for editing a node's enableWhen conditions and
// enableWhenExpression. Uses a draft pattern — changes are only committed on Apply.
import { MODAL_REGISTRY } from './modal-registry.js';
import { ExprAwareModal } from './expr-aware-modal.js';
import { createCustomSelect } from '../custom-select.js';
import { buildVisPanel } from '../../builder/panels.js';
import { nodePickerModal } from './node-picker-modal.js';
import { AppEvents, EventState } from '../../events.js';

class ShowWhenModal extends ExprAwareModal {
  getName() { return 'showWhenModal'; }
  constructor() {
    super();
    this._pending = null;
    MODAL_REGISTRY.set('showWhen', this);

    this._copyToBtn = document.createElement('button');
    this._copyToBtn.type = 'button';
    this._copyToBtn.className = 'modal-btn modal-btn--copy-to';
    this._copyToBtn.textContent = 'Copy to\u2026';
    this._copyToBtn.dataset.testid = 'showwhen-copy-to-btn';
    this._copyToBtn.addEventListener('click', () => this._openCopyTo());
    this.footer.insertBefore(this._copyToBtn, this.footer.firstChild);
  }

  open(node, visLink, setActive) {
    this._fpCtx = null;
    const draft = Object.assign({}, node, {
      enableWhen:           JSON.parse(JSON.stringify(node.enableWhen || [])),
      enableBehavior:       node.enableBehavior       || 'all',
      enableWhenExpression: node.enableWhenExpression || '',
      _disabledDisplay:     node._disabledDisplay     || 'protected',
    });
    this._pending = { node, visLink, setActive, draft };

    this.setTitle('Show When', node.title || node.id || 'Item');
    this.body.innerHTML = '';
    buildVisPanel(draft, this.constructor._svc.questDoc.tree, this.body, visLink, () => {});

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
    document.dispatchEvent(new CustomEvent(AppEvents.CALC_RECALC_REQUESTED));
    this._cancel();
  }

  _buildPayload() {
    const { draft } = this._pending;
    return {
      enableWhen:           JSON.parse(JSON.stringify(draft.enableWhen)),
      enableBehavior:       draft.enableBehavior,
      enableWhenExpression: draft.enableWhenExpression || null,
      _disabledDisplay:     (draft._disabledDisplay && draft._disabledDisplay !== 'protected')
        ? draft._disabledDisplay
        : null,
    };
  }

  _openCopyTo() {
    if (!this._pending) return;
    const patch = this._buildPayload();
    const { node } = this._pending;
    // allowedType=null — enableWhen applies to both items and groups
    nodePickerModal.open(node.id, (ids) => {
      document.dispatchEvent(new CustomEvent(AppEvents.COPY_TO_NODES, {
        detail: { ids, patch, nodeType: null },
      }));
      document.dispatchEvent(new CustomEvent(AppEvents.CALC_RECALC_REQUESTED));
      document.dispatchEvent(new CustomEvent(AppEvents.BUILDER_RERENDER));
    }, null, EventState.get(AppEvents.APP_CONTEXT_READY)?.questDoc?.tree ?? []);
  }

  _cancel() {
    this._pending = null;
    this.body.innerHTML = '';
    this.close();
  }
}
new ShowWhenModal();
