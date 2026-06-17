// ── Load from file — Format picker modal ─────────────────────────────────────
// Opens before the native file picker; user selects the source format first,
// then clicks "Choose file…" which opens the appropriate file input.
//
// data-testid: loadFormatModal, loadFormatModalTitle, loadFormatModalClose,
//              loadFormatModalBody, loadFormatModalCancel, loadFormatModalApply,
//              load-format-select, fhir-file-input, redcap-csv-input

import { Modal } from './modal-base.js';
import { createCustomSelect } from '../custom-select.js';
import { readFileAsJSON } from '../../utils.js';
import * as progress from '../progress.js';
import { showError } from '../toast.js';
import * as validateModal from './validate-modal.js';
import { parseCSV, validateCSV, toFHIR } from '../../fhir/converters/redcap/index.js';

const LS_KEY = 'fhirqb-load-format';

const FORMATS = [
  { val: 'fhir',   label: 'FHIR R4 JSON (.json)' },
  { val: 'redcap', label: 'REDCap CSV — Data Dictionary (.csv)' },
];

function _savedFormat() {
  try { return localStorage.getItem(LS_KEY) || 'fhir'; } catch { return 'fhir'; }
}
function _saveFormat(v) {
  try { localStorage.setItem(LS_KEY, v); } catch { /* ignore */ }
}

import { AppEvents } from '../../events.js';

class LoadFormatModal extends Modal {
  getName() { return 'loadFormatModal'; }

  constructor() {
    super({ applyLabel: 'Choose file\u2026', cancelLabel: 'Cancel', maxWidth: '400px' });
    this._onLoaded     = null;
    this._defaultOnLoaded = (data, fileName) => {
      document.dispatchEvent(new CustomEvent(AppEvents.QUESTIONNAIRE_LOAD_REQUESTED, {
        detail: { data, fileName },
      }));
    };
    this._format       = _savedFormat();

    // ── Body ──────────────────────────────────────────────────────────────────
    const row = document.createElement('div');
    row.className = 'lf-format-row';

    const lbl = document.createElement('label');
    lbl.className  = 'lf-format-label';
    lbl.textContent = 'Format';

    this._sel = createCustomSelect({
      items:    FORMATS.map(f => ({ value: f.val, label: f.label })),
      value:    this._format,
      testid:   'load-format-select',
      onChange: v => { this._format = v; _saveFormat(v); },
    });

    row.append(lbl, this._sel.el);
    this.body.appendChild(row);

    // ── Hidden file inputs ────────────────────────────────────────────────────
    this._jsonInput = this._makeInput('.json,application/json', 'fhir-file-input', this._onJson.bind(this));
    this._csvInput  = this._makeInput('.csv,text/csv',          'redcap-csv-input',  this._onCsv.bind(this));

    document.body.append(this._jsonInput, this._csvInput);
  }

  _makeInput(accept, testid, handler) {
    const inp = document.createElement('input');
    inp.type  = 'file';
    inp.accept = accept;
    inp.style.display = 'none';
    inp.dataset.testid = testid;
    inp.addEventListener('change', handler);
    return inp;
  }

  /** Open the modal. `onLoaded(fhirJson, fileName)` is called after successful parse. */
  open(onLoaded) {
    this._onLoaded = onLoaded;
    this._sel.setValue(_savedFormat());
    this._format = _savedFormat();
    this.setTitle('Load from file');
    super.open();
  }

  _apply() {
    if (this._format === 'redcap') {
      this._csvInput.value = '';
      this._csvInput.click();
    } else {
      this._jsonInput.value = '';
      this._jsonInput.click();
    }
  }

  _cancel() {
    this.close();
  }

  // ── File handlers ──────────────────────────────────────────────────────────

  async _onJson(e) {
    const fileName = e.target.files[0]?.name;
    if (!fileName) return;
    this.close();
    progress.show('Loading ' + fileName + '\u2026');
    readFileAsJSON(e)
      .then(({ data, fileName: fn }) => {
        progress.update(0, 1);
        const loader = this._onLoaded ?? this._defaultOnLoaded;
        loader?.(data, fn);
      })
      .catch(err => {
        progress.hide();
        if (err) showError('Parse error: ' + err.message);
      });
  }

  async _onCsv(e) {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    this.close();
    progress.show('Reading ' + file.name + '\u2026');
    try {
      const text = await file.text();
      progress.hide();
      const rows   = parseCSV(text);
      const issues = validateCSV(rows);
      if (issues.some(i => i.severity === 'error')) {
        validateModal.show('REDCap Import \u2014 Validation Issues', 'import', { extraIssues: issues });
        return;
      }
      if (issues.length > 0) {
        validateModal.show('REDCap Import \u2014 Warnings', 'import', { extraIssues: issues });
      }
      const fhirJson = toFHIR(rows, { title: file.name.replace(/\.csv$/i, '') });
      this._onLoaded?.(fhirJson, file.name);
    } catch (err) {
      progress.hide();
      showError('REDCap import failed: ' + err.message);
    }
  }
}

export const loadFormatModal = new LoadFormatModal();
