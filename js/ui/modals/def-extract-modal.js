// ── Definition Extract Modal ──────────────────────────────────────────────────
// Shows the result of definition-based extraction: list of extracted resources
// + Download Bundle button.
import { Modal }        from './modal-base.js';
import { AppEvents }    from '../../events.js';
import { downloadJSON } from '../../fhir/download.js';
import { buildFHIRObject } from '../../fhir/export.js';
import { buildQR }         from '../../fhir/qr-builder.js';
import { definitionExtract } from '../../fhir/sdc-definition-extract.js';
import { EventState }   from '../../events.js';
import { showWarn as _showWarn } from '../toast.js';

export class DefExtractModal extends Modal {
  constructor() {
    super({ applyLabel: 'Download Bundle', cancelLabel: 'Close', maxWidth: '540px' });
    this.title.textContent = 'Definition-based Extraction';
    this._result = null;
  }

  getName() { return 'defExtract'; }

  /** Run extraction and open the modal. */
  run() {
    const ctx = EventState.get(AppEvents.APP_CONTEXT_READY);
    if (!ctx?.questDoc || !ctx?.answerStore) return;

    const questJson = buildFHIRObject();
    const qr = buildQR(questJson, ctx.answerStore.data);
    this._result = definitionExtract(questJson, qr);

    this._renderBody();
    super.open();
  }

  _renderBody() {
    this.body.innerHTML = '';
    const { bundle, count, warnings } = this._result;

    // Warnings
    if (warnings.length) {
      const warn = document.createElement('div');
      warn.className = 'modal-field-hint';
      warn.style.cssText = 'color:var(--c-amber);margin-bottom:12px;font-size:12px;';
      warn.textContent = warnings.join(' ');
      this.body.appendChild(warn);
    }

    if (!bundle || count === 0) {
      this.applyBtn?.setAttribute('disabled', '');
      return;
    }

    this.applyBtn?.removeAttribute('disabled');

    // Summary
    const summary = document.createElement('p');
    summary.style.cssText = 'font-size:13px;margin-bottom:12px;';
    summary.textContent = `Extracted ${count} resource${count !== 1 ? 's' : ''} from current answers.`;
    this.body.appendChild(summary);

    // Resource list
    const list = document.createElement('div');
    list.style.cssText = 'display:flex;flex-direction:column;gap:6px;max-height:280px;overflow-y:auto;';

    for (const entry of bundle.entry) {
      const r = entry.resource;
      const card = document.createElement('div');
      card.style.cssText =
        'padding:8px 12px;border:1px solid var(--c-border);border-radius:6px;' +
        'background:var(--c-bg);font-size:12px;';

      const title = document.createElement('span');
      title.style.cssText = 'font-weight:700;color:var(--c-primary);margin-right:8px;';
      title.textContent = r.resourceType;

      const id = document.createElement('span');
      id.style.cssText = 'font-family:monospace;color:var(--c-text-2);font-size:11px;';
      id.textContent = r.id;

      // Show top-level field summary
      const fields = Object.keys(r)
        .filter(k => !['resourceType','id','meta'].includes(k))
        .slice(0, 4)
        .join(', ');
      const fieldSummary = document.createElement('div');
      fieldSummary.style.cssText = 'color:var(--c-text-2);margin-top:3px;font-size:11px;';
      fieldSummary.textContent = fields ? `Fields: ${fields}` : '(no data fields)';

      card.append(title, id, fieldSummary);
      list.appendChild(card);
    }

    this.body.appendChild(list);
  }

  _apply() {
    if (!this._result?.bundle) return;
    const fileName = 'extracted-resources.json';
    downloadJSON(this._result.bundle, fileName);
    this.close();
  }

  _cancel() { this.close(); }
}

export const defExtractModal = new DefExtractModal();

// Self-wire to AppEvents
if (typeof document !== 'undefined') {
  document.addEventListener(AppEvents.DEF_EXTRACT_REQUESTED, () => defExtractModal.run());
}
