// ── Contained resource editor modal ──────────────────────────────────────────
// Raw-JSON editor to add or edit a single Questionnaire.contained[] resource.
// Stateless: open({ json, title, onCommit }) supplies everything; onCommit
// returns an error string (kept open) or null (closes).
import { Modal } from './modal-base.js';

class ContainedResourceModal extends Modal {
  getName() { return 'containedResourceModal'; }

  constructor() {
    super({ applyLabel: 'Apply', cancelLabel: 'Cancel', maxWidth: '640px' });
    this._onCommit = null;
    this._buildBody();
  }

  _buildBody() {
    const hint = document.createElement('p');
    hint.className = 'contained-modal-hint';
    hint.textContent = 'Paste a FHIR resource (e.g. a ValueSet or CodeSystem). Give it an "id" so items can reference it via #id.';

    this._ta = document.createElement('textarea');
    this._ta.className = 'contained-json-input';
    this._ta.dataset.testid = 'contained-json-input';
    this._ta.spellcheck = false;
    this._ta.rows = 3; // visual height comes from CSS; kept off the forbidden rows=2
    this._ta.placeholder = '{\n  "resourceType": "ValueSet",\n  "id": "vs-example",\n  "status": "active"\n}';

    this._err = document.createElement('div');
    this._err.className = 'contained-json-error';
    this._err.dataset.testid = 'contained-json-error';
    this._err.style.display = 'none';

    this.body.append(hint, this._ta, this._err);
  }

  open({ json = '', title = 'Add contained resource', onCommit } = {}) {
    this._onCommit = onCommit || null;
    this.setTitle(title);
    this._ta.value = json;
    this._hideError();
    super.open();
    this._ta.focus();
  }

  _apply() {
    const raw = this._ta.value.trim();
    if (!raw) return this._showError('Enter a FHIR resource JSON.');
    let obj;
    try { obj = JSON.parse(raw); } catch (e) { return this._showError('Invalid JSON: ' + e.message); }
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
      return this._showError('Must be a single FHIR resource object (not an array or primitive).');
    }
    if (typeof obj.resourceType !== 'string' || !obj.resourceType.trim()) {
      return this._showError('Resource must have a non-empty string "resourceType".');
    }
    const err = this._onCommit ? this._onCommit(obj) : null;
    if (err) return this._showError(err);
    this._onCommit = null;
    this.close();
  }

  _cancel() {
    this._onCommit = null;
    this.close();
  }

  _showError(msg) {
    this._err.textContent = msg;
    this._err.style.display = '';
  }

  _hideError() {
    this._err.textContent = '';
    this._err.style.display = 'none';
  }
}

export const containedResourceModal = new ContainedResourceModal();
