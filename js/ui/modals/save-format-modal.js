// ── Save / Export format picker modal ────────────────────────────────────────
// Opened from Save menu → "Questionnaire…". User picks the export format
// (FHIR R4 JSON or REDCap CSV) and clicks Export.
//
// data-testid: saveFormatModal, saveFormatModalTitle, saveFormatModalClose,
//              saveFormatModalBody, saveFormatModalCancel, saveFormatModalApply,
//              save-format-select

import { Modal } from './modal-base.js';
import { createCustomSelect } from '../custom-select.js';
import { exportFHIR, buildFHIRObject } from '../../fhir/export.js';
import * as validateModal from './validate-modal.js';
import { showPrompt } from '../toast.js';
import { AppEvents } from '../../events.js';
import { fromFHIR, redcapCompatValidator } from '../../fhir/converters/redcap/index.js';

const LS_KEY = 'fhirqb-save-format';

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

class SaveFormatModal extends Modal {
  getName() { return 'saveFormatModal'; }

  constructor() {
    super({ applyLabel: 'Export', cancelLabel: 'Cancel', maxWidth: '400px' });
    this._deps   = null;
    this._format = _savedFormat();

    const row = document.createElement('div');
    row.className = 'lf-format-row';

    const lbl = document.createElement('label');
    lbl.className   = 'lf-format-label';
    lbl.textContent = 'Format';

    this._sel = createCustomSelect({
      items:    FORMATS.map(f => ({ value: f.val, label: f.label })),
      value:    this._format,
      testid:   'save-format-select',
      onChange: v => { this._format = v; _saveFormat(v); },
    });

    row.append(lbl, this._sel.el);
    this.body.appendChild(row);
  }

  /** @param {{ fileNameDisplay, tree, values }} deps */
  open(deps) {
    this._deps   = deps;
    this._format = _savedFormat();
    this._sel.setValue(this._format);
    this.setTitle('Export Questionnaire');
    super.open();
  }

  _apply() {
    this.close();
    if (this._format === 'redcap') {
      this._exportRedcap();
    } else {
      this._exportFhir();
    }
  }

  _cancel() { this.close(); }

  // ── Export handlers ────────────────────────────────────────────────────────

  _exportFhir() {
    const { fileNameDisplay, tree, values } = this._deps;
    validateModal.show('Export — Validation Report', 'export', {
      questJson: buildFHIRObject(),
      tree,
      values,
      onExport: () => {
        const suggested = fileNameDisplay.getName().trim() || 'questionnaire';
        showPrompt('Save as:', suggested + '.json', name => {
          if (name === null) return;
          const trimmed = name.replace(/\.json$/i, '');
          exportFHIR(trimmed + '.json');
          fileNameDisplay.setName(trimmed);
        });
      },
    });
  }

  _exportRedcap() {
    const { fileNameDisplay, tree, values } = this._deps;
    const questJson = buildFHIRObject();
    const suggested = fileNameDisplay?.getName().trim() || 'questionnaire';
    redcapCompatValidator.enabled = true;
    validateModal.show('REDCap Export \u2014 Compatibility Report', 'export', {
      questJson,
      tree,
      values,
      onExport: () => {
        redcapCompatValidator.enabled = false;
        const csv  = fromFHIR(questJson);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = suggested + '.csv';
        a.click();
        URL.revokeObjectURL(url);
      },
    });
    // Ensure validator disabled if modal dismissed without exporting
    const cleanup = () => { redcapCompatValidator.enabled = false; };
    document.addEventListener(AppEvents.QUESTIONNAIRE_LOADED,  cleanup, { once: true });
    document.addEventListener(AppEvents.QUESTIONNAIRE_CLEARED, cleanup, { once: true });
  }
}

export const saveFormatModal = new SaveFormatModal();
