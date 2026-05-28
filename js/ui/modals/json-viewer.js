// ── Shared read-only FHIR JSON viewer modal ───────────────────────────────────
// Shows any JSON object as formatted, scrollable, read-only text.
// Listens for the 'show-json' custom event from anywhere in the app.
import { Modal } from './modal-base.js';
import { AppEvents } from '../../events.js';

class JsonViewerModal extends Modal {
  getName() { return 'fhirJsonModal'; }
  constructor() {
    super({ cancelLabel: 'Close', applyLabel: null, bodyClass: 'fhir-json-modal-body' });
    this.pre = document.createElement('pre');
    this.pre.className = 'fhir-json-pre';
    this.pre.dataset.testid = 'fhirJsonModalPre';
    this.body.appendChild(this.pre);
    // alias: tests use fhirJsonModalCloseBtn for the footer Close button
    if (this.cancelBtn) this.cancelBtn.dataset.testid = 'fhirJsonModalCloseBtn';
    document.addEventListener(AppEvents.SHOW_JSON, e => this.show(e.detail.title, e.detail.data));
  }

  show(title, data) {
    this.title.textContent = title;
    this.pre.textContent = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
    super.open();
  }

  _cancel() { this.close(); }
}
new JsonViewerModal();
