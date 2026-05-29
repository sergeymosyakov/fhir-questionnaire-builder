// ── Preferred Terminology Server modal ────────────────────────────────────────
// Per-item configuration for sdc-questionnaire-preferredTerminologyServer.
// Stores a URL hint for the terminology server to use when expanding ValueSets
// for this specific item. Falls back to the Questionnaire-level setting.
import { MODAL_REGISTRY } from './modal-registry.js';
import { Modal } from './modal-base.js';
import { terminologyService } from '../../fhir/terminology-service.js';
import { AppEvents } from '../../events.js';

const PREF_TERM_URL = 'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-preferredTerminologyServer';

class TerminologyModal extends Modal {
  getName() { return 'terminologyModal'; }
  constructor() {
    super();
    this._pending = null;
    MODAL_REGISTRY.set('terminology', this);
  }

  open(node, link, setActive) {
    this._pending = { node, link, setActive, draftUrl: node._preferredTermServer || '' };
    this.setTitle('Terminology Server', node.title || node.id || 'Item');
    this.body.innerHTML = '';
    this._renderBody();
    super.open();
    this.body.querySelector('input')?.focus();
  }

  _apply() {
    if (!this._pending) return;
    const { node, link, setActive } = this._pending;
    const v = this._pending.draftUrl.trim();
    if (v) node._preferredTermServer = v;
    else   delete node._preferredTermServer;
    setActive(link, !!node._preferredTermServer);
    document.dispatchEvent(new CustomEvent(AppEvents.RESPONSE_CHANGED));
    node._dispatchRerender();
    this._cancel();
  }

  _cancel() {
    this._pending = null;
    this.close();
  }

  _renderBody() {
    const hint = document.createElement('div');
    hint.className = 'panel-hint';
    hint.textContent = 'Per-item preferred terminology server for ValueSet expansion. ' +
      'Overrides the Questionnaire-level default. Leave blank to use the questionnaire default.';
    this.body.appendChild(hint);

    const row = document.createElement('div');
    row.className = 'meta-modal-row';

    const lbl = document.createElement('label');
    lbl.className = 'meta-modal-lbl';
    lbl.textContent = 'Server URL:';
    lbl.dataset.tipTitle = 'sdc-questionnaire-preferredTerminologyServer';
    lbl.dataset.tipBody  = 'URL of the preferred FHIR terminology server for ValueSet expansion on this item. ' +
      'Takes precedence over Questionnaire.extension[preferredTerminologyServer].';
    lbl.dataset.tipFhir  = 'item.extension[sdc-questionnaire-preferredTerminologyServer].valueUrl';
    lbl.dataset.tipSpec  = 'SDC';

    const inp = document.createElement('input');
    inp.type      = 'url';
    inp.className = 'meta-modal-inp';
    inp.value       = this._pending.draftUrl;
    inp.placeholder = 'https://tx.fhir.org/r4';
    inp.dataset.testid = 'terminology-server-url-input';
    inp.oninput = () => { this._pending.draftUrl = inp.value; };

    row.append(lbl, inp);
    this.body.appendChild(row);

    // ── Test button + status ──────────────────────────────────────────────────
    const testRow = document.createElement('div');
    testRow.className = 'meta-modal-row';
    const testSpacer = document.createElement('div');
    testSpacer.className = 'meta-modal-lbl';

    const testWrap = document.createElement('div');
    testWrap.className = 'term-test-wrap';

    const testBtn = document.createElement('button');
    testBtn.type      = 'button';
    testBtn.className = 'modal-btn modal-btn--secondary';
    testBtn.textContent = 'Test connection';
    testBtn.dataset.testid = 'terminology-test-btn';

    const statusEl = document.createElement('span');
    statusEl.className = 'term-test-status';
    statusEl.dataset.testid = 'terminology-test-status';

    testBtn.addEventListener('click', async () => {
      const url = this._pending.draftUrl.trim();
      statusEl.className   = 'term-test-status term-test-status--loading';
      statusEl.textContent = 'Connecting…';
      testBtn.disabled = true;
      const result = await terminologyService.testServer(url, {
        onRetry: () => { statusEl.textContent = 'Retrying…'; },
      });
      testBtn.disabled = false;
      if (result.ok) {
        statusEl.className   = 'term-test-status term-test-status--ok';
        statusEl.textContent = '\u2713 ' + result.message;
      } else {
        statusEl.className   = 'term-test-status term-test-status--err';
        statusEl.textContent = '\u2717 ' + result.message;
      }
    });

    testWrap.append(testBtn, statusEl);
    testRow.append(testSpacer, testWrap);
    this.body.appendChild(testRow);

    const extRow = document.createElement('div');
    extRow.className = 'panel-hint';
    extRow.style.marginTop = '6px';
    extRow.textContent = `Extension URL: ${PREF_TERM_URL}`;
    this.body.appendChild(extRow);
  }
}
new TerminologyModal();
