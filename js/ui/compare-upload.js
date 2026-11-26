// Form Check page: pick the saved reference file and the current Questionnaire (file, drop or paste); hands both texts over as COMPARE_SOURCES_PROVIDED.
// data-testid registry: compare-upload, compare-reference-file, compare-reference-drop, compare-reference-text, compare-current-file, compare-current-drop, compare-current-text, compare-run-btn, compare-generated, compare-error, compare-progress, compare-status
import { AppEvents } from '../events.js';
import { el } from './el.js';

// One side of the comparison: a drop zone that keeps a chosen file's text in memory, and a field to paste into.
class SourceInput {
  constructor(name, title, hint) {
    this.file = el('input', 'check-upload-file', null, `compare-${name}-file`);
    this.file.type = 'file';
    this.file.accept = '.json,application/json,application/fhir+json';
    this.chosen = el('span', 'check-upload-hint');
    this.drop = el('label', 'check-upload-drop', null, `compare-${name}-drop`);
    this.drop.append(el('strong', null, title), el('span', 'check-upload-hint', hint), this.chosen, this.file);
    this.text = el('textarea', 'check-upload-text', null, `compare-${name}-text`);
    this.text.rows = 3;
    this.text.placeholder = '…or paste the JSON here';
    this.el = el('div', 'compare-source');
    this.el.append(this.drop, this.text);
    this._loaded = null;
    this.file.addEventListener('change', () => this._read(this.file.files[0]));
    for (const type of ['dragover', 'dragleave', 'drop']) {
      this.drop.addEventListener(type, (e) => {
        e.preventDefault();
        this.drop.classList.toggle('check-upload-drop--over', type === 'dragover');
        if (type === 'drop') this._read(e.dataTransfer?.files?.[0]);
      });
    }
    this.text.addEventListener('input', () => { this._loaded = null; this.chosen.textContent = ''; }); // typing replaces a chosen file
  }

  async _read(file) {
    if (!file) return;
    try {
      this._loaded = await file.text();
      this.text.value = '';
      this.chosen.textContent = `${file.name} (${Math.max(1, Math.round(file.size / 1024))} KB)`;
    } catch { this._loaded = null; this.chosen.textContent = 'The file could not be read.'; }
    this.file.value = ''; // choosing the same file again must fire change
  }

  value() { return this._loaded ?? this.text.value; }

  clear() {
    this._loaded = null;
    this.text.value = '';
    this.file.value = '';
    this.chosen.textContent = '';
  }

  setBusy(busy) {
    this.file.disabled = this.text.disabled = busy;
    this.drop.classList.toggle('check-upload-drop--busy', busy);
  }
}

export class CompareUpload {
  constructor() {
    this.mount = document.querySelector('[data-mount="compare-upload"]');
    if (!this.mount) return;
    this.box = el('section', 'check-upload', null, 'compare-upload');
    this.box.hidden = true; // shown once "Compare with a saved reference" is chosen
    this.intro = el('p', 'check-upload-hint', 'Did an edit change what the form calculates? Give the questionnaire as it is now and the reference file saved earlier (“Save reference file”): the same answers are run through both and every calculation is compared.');
    this.current = new SourceInput('current', 'Compare this questionnaire', 'the Questionnaire .json as it is now');
    this.reference = new SourceInput('reference', 'with this saved reference', 'the .bundle.json saved from a check');
    this.sides = el('div', 'compare-sides');
    this.sides.append(this.current.el, this.reference.el); // what is compared first, then what it is compared with
    this.generated = el('input', null, null, 'compare-generated');
    this.generated.type = 'checkbox';
    this.more = el('label', 'check-upload-option');
    this.more.append(this.generated, ' Also try the answer sets the check generates for the form (catches a moved threshold that the saved answers do not reach)');
    this.run = el('button', 'qdoc-btn', 'Compare', 'compare-run-btn');
    this.run.type = 'button';
    this.status = el('p', 'check-upload-status', null, 'compare-status');
    this.bar = el('progress', 'check-upload-progress', null, 'compare-progress');
    this.status.hidden = this.bar.hidden = true;
    this.error = el('p', 'check-upload-error', null, 'compare-error');
    this.error.setAttribute('role', 'alert');
    this.error.hidden = true;
    this.box.append(this.intro, this.sides, this.more, this.run, this.status, this.bar, this.error);
    this.mount.append(this.box);
    this._wire();
  }

  _wire() {
    this.run.addEventListener('click', () => this._submit());
    document.addEventListener(AppEvents.COMPARE_PROGRESS, (e) => {
      const { done, total } = e.detail;
      this.bar.max = total;
      this.bar.value = done;
      this.status.textContent = `Comparing answer sets… ${done} of ${total}`;
    });
    document.addEventListener(AppEvents.COMPARE_FAILED, (e) => this._showError(e.detail?.message ?? 'The comparison could not run.'));
    document.addEventListener(AppEvents.CHECK_RESET, () => this._clear());
    document.addEventListener(AppEvents.CHECK_MODE_CHANGED, (e) => { this.selected = e.detail.mode; this.box.hidden = this.selected !== 'compare'; });
    document.addEventListener(AppEvents.CHECK_REPORT_SHOWN, (e) => { this.selected = null; this.box.hidden = true; if (e.detail.mode === 'compare') this._setBusy(false); }); // only once the report is really on the page
  }

  _clear() {
    this.selected = null;
    this.reference.clear();
    this.current.clear();
    this.generated.checked = false;
    this.error.hidden = true;
    this._setBusy(false);
    this.box.hidden = true;
  }

  _submit() {
    if (this._busy) return;
    const [current, reference] = [this.current.value(), this.reference.value()];
    if (!current.trim() || !reference.trim()) { this._showError('Give both the questionnaire as it is now and the saved reference file.'); return; }
    this.error.hidden = true;
    this._setBusy(true);
    document.dispatchEvent(new CustomEvent(AppEvents.COMPARE_SOURCES_PROVIDED, { detail: { reference, current, tryGenerated: this.generated.checked } }));
  }

  _setBusy(busy) {
    this._busy = busy;
    this.run.disabled = busy;
    this.run.textContent = busy ? 'Comparing…' : 'Compare';
    this.generated.disabled = busy;
    this.reference.setBusy(busy);
    this.current.setBusy(busy);
    this.status.hidden = this.bar.hidden = !busy;
    if (busy) { this.status.textContent = 'Reading the files…'; this.bar.removeAttribute('value'); }
  }

  _showError(message) {
    this._setBusy(false);
    this.error.textContent = message;
    this.error.hidden = false;
    this.box.hidden = this.selected !== 'compare'; // not under another tab
  }
}
