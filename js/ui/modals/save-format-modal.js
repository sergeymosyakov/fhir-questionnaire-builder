import { Modal } from './modal-base.js';
// ── Save / Export format picker modal ────────────────────────────────────────
// Opened from Save menu → "Questionnaire…". User picks the export format
// (FHIR R4/R4B/R5 JSON, REDCap CSV, …) and clicks Export.
// Format list is driven entirely by formatRegistry — no hardcoded list.
//
// data-testid: saveFormatModal, saveFormatModalTitle, saveFormatModalClose,
//              saveFormatModalBody, saveFormatModalCancel, saveFormatModalApply,
//              save-format-select

import { createCustomSelect } from '../custom-select.js';
import { buildFHIRObject } from '../../fhir/export.js';
import { downloadJSON } from '../../fhir/download.js';
import { formatRegistry } from '../../fhir/format-registry.js';
import * as validateModal from './validate-modal.js';
import { showPrompt } from '../toast.js';
import { AppEvents } from '../../events.js';

const LS_KEY = 'fhirqb-save-format';

function _savedFormat() {
  try {
    const v = localStorage.getItem(LS_KEY);
    // Migrate old 'fhir' key → current FHIR target version
    if (!v || v === 'fhir') return null;
    return v;
  } catch { return null; }
}
function _saveFormat(v) {
  try { localStorage.setItem(LS_KEY, v); } catch { /* ignore */ }
}

class SaveFormatModal extends Modal {
  getName() { return 'saveFormatModal'; }

  constructor() {
    super({ applyLabel: 'Export', cancelLabel: 'Cancel', maxWidth: '400px' });
    this._deps   = null;
    this._format = 'R4'; // resolved from LS / getFhirTarget on open()

    const row = document.createElement('div');
    row.className = 'lf-format-row';

    const lbl = document.createElement('label');
    lbl.className   = 'lf-format-label';
    lbl.textContent = 'Format';

    this._sel = createCustomSelect({
      items:    formatRegistry.getAll().map(f => ({ value: f.id, label: f.label })),
      value:    this._format,
      testid:   'save-format-select',
      onChange: v => { this._format = v; _saveFormat(v); },
    });

    row.append(lbl, this._sel.el);
    this.body.appendChild(row);
  }

  /** @param {{ fileName, tree, values }} deps */
  open(deps) {
    this._deps   = deps;
    // Resolve saved format; migrate old 'fhir' key to current FHIR target
    this._format = _savedFormat() ?? (deps?.fhirTarget ?? 'R4');
    // Ensure the stored id actually exists in the registry (guard after delete)
    if (!formatRegistry.get(this._format)) {
      this._format = deps?.fhirTarget ?? 'R4';
    }
    this._sel.setValue(this._format);
    this.setTitle('Export Questionnaire');
    super.open();
  }

  _apply() {
    this.close();
    const fmt = formatRegistry.get(this._format);
    if (fmt) this._exportWithFormat(fmt);
  }

  _cancel() { this.close(); }

  // ── Generic export handler ─────────────────────────────────────────────────
  // Works for any registered format: FHIR JSON variants and CSV formats alike.

  _exportWithFormat(fmt) {
    const { fileName, tree, values } = this._deps;
    const baseQ     = buildFHIRObject();
    const suggested = (fileName || '').trim() || 'questionnaire';

    fmt.onBeforeReport?.();

    validateModal.show(
      fmt.reportTitle ?? 'Export \u2014 Validation Report',
      'export',
      {
        questJson: baseQ,
        tree,
        values,
        validatorFilter: fmt.validatorFilter ?? null,
        onExport: () => {
          fmt.onAfterExport?.();
          const content = fmt.build(baseQ);
          showPrompt('Save as:', suggested + '.' + fmt.ext, name => {
            if (name === null) return;
            const trimmed = name.replace(new RegExp(`\\.${fmt.ext}$`, 'i'), '');
            if (fmt.ext === 'json') {
              downloadJSON(content, trimmed + '.json');
            } else {
              const blob = new Blob([content], { type: fmt.mimeType });
              const url  = URL.createObjectURL(blob);
              const a    = document.createElement('a');
              a.href = url;
              a.download = trimmed + '.' + fmt.ext;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
            }
              document.dispatchEvent(new CustomEvent('file-name:changed', { detail: { name: trimmed } }));
          });
        },
      }
    );

    // If the format has cleanup hooks, ensure they run even if the user
    // dismisses the validate modal without exporting.
    if (fmt.onCancel) {
      const cleanup = () => fmt.onCancel();
      document.addEventListener(AppEvents.QUESTIONNAIRE_LOADED,  cleanup, { once: true });
      document.addEventListener(AppEvents.QUESTIONNAIRE_CLEARED, cleanup, { once: true });
    }
  }
}

export const saveFormatModal = new SaveFormatModal();
