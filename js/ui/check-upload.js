// Form Check page: pick a file, drop one or paste JSON; hands the text over as CHECK_SOURCE_PROVIDED.
// data-testid registry: check-upload, check-upload-file, check-upload-drop, check-upload-text, check-upload-run-btn, check-upload-error, check-upload-progress, check-upload-status
import { AppEvents } from '../events.js';
import { el } from './el.js';

export class CheckUpload {
  constructor() {
    this.mount = document.querySelector('[data-mount="check-upload"]');
    if (!this.mount) return;
    this.box = el('section', 'check-upload', null, 'check-upload');
    this.box.hidden = true; // shown once "Check a questionnaire" is chosen
    this.drop = el('label', 'check-upload-drop', null, 'check-upload-drop');
    this.drop.append(el('span', 'check-upload-icon', '\u2B06'), el('strong', null, 'Drop a Questionnaire .json file here'), el('span', 'check-upload-hint', 'or click to choose one'));
    this.file = el('input', 'check-upload-file', null, 'check-upload-file');
    this.file.type = 'file';
    this.file.accept = '.json,application/json,application/fhir+json';
    this.drop.append(this.file);
    this.text = el('textarea', 'check-upload-text', null, 'check-upload-text');
    this.text.rows = 3;
    this.text.placeholder = '…or paste the Questionnaire JSON here';
    this.run = el('button', 'qdoc-btn', 'Check', 'check-upload-run-btn');
    this.run.type = 'button';
    this.status = el('p', 'check-upload-status', null, 'check-upload-status');
    this.bar = el('progress', 'check-upload-progress', null, 'check-upload-progress');
    this.status.hidden = this.bar.hidden = true;
    this.error = el('p', 'check-upload-error', null, 'check-upload-error');
    this.error.setAttribute('role', 'alert');
    this.error.hidden = true;
    this.box.append(this.drop, this.text, this.run, this.status, this.bar, this.error);
    this.mount.append(this.box);
    this._wire();
  }

  _wire() {
    this.file.addEventListener('change', () => this._readFile(this.file.files[0]));
    for (const type of ['dragover', 'dragleave', 'drop']) {
      this.drop.addEventListener(type, (e) => {
        e.preventDefault();
        this.drop.classList.toggle('check-upload-drop--over', type === 'dragover');
        if (type === 'drop') this._readFile(e.dataTransfer?.files?.[0]);
      });
    }
    this.run.addEventListener('click', () => this._submit(this.text.value));
    document.addEventListener(AppEvents.CHECK_PROGRESS, (e) => {
      const { done, total } = e.detail;
      this.bar.max = total;
      this.bar.value = done;
      this.status.textContent = `Trying answer combinations… ${done} of ${total}`;
    });
    document.addEventListener(AppEvents.CHECK_FAILED, (e) => this._showError(e.detail?.message ?? 'The check could not run.'));
    document.addEventListener(AppEvents.CHECK_RESET, () => this._clear());
    document.addEventListener(AppEvents.CHECK_MODE_CHANGED, (e) => { this.selected = e.detail.mode; this.box.hidden = this.selected !== 'check'; });
    document.addEventListener(AppEvents.CHECK_REPORT_SHOWN, (e) => { this.selected = null; this.box.hidden = true; if (e.detail.mode === 'check') this._setBusy(false); }); // only once the report is really on the page
  }

  _clear() {
    this.selected = null;
    this.text.value = '';
    this.file.value = '';
    this.error.hidden = true;
    this._setBusy(false);
    this.box.hidden = true;
  }

  async _readFile(file) {
    if (!file) return;
    if (this._busy) return;
    try { this._submit(await file.text()); } catch { this._showError('The file could not be read.'); }
    this.file.value = ''; // choosing the same file again must fire change
  }

  _submit(text) {
    if (this._busy) return;
    if (!text.trim()) { this._showError('Choose a file or paste the Questionnaire JSON first.'); return; }
    this.error.hidden = true;
    this._setBusy(true);
    document.dispatchEvent(new CustomEvent(AppEvents.CHECK_SOURCE_PROVIDED, { detail: { text } }));
  }

  _setBusy(busy) {
    this._busy = busy;
    this.run.disabled = this.file.disabled = this.text.disabled = busy;
    this.drop.classList.toggle('check-upload-drop--busy', busy);
    this.run.textContent = busy ? 'Checking…' : 'Check';
    this.status.hidden = this.bar.hidden = !busy;
    if (busy) { this.status.textContent = 'Reading the questionnaire…'; this.bar.removeAttribute('value'); }
  }

  _showError(message) {
    this._setBusy(false);
    this.error.textContent = message;
    this.error.hidden = false;
    this.box.hidden = this.selected !== 'check'; // not under another tab
  }
}
