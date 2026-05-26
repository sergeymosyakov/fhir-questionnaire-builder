// Initializes all modal and side-panel UI components.
// Imported as a side effect from app.js.
import * as showWhenModal from './ui/modals/showwhen-modal.js';
import * as constraintModal from './ui/modals/constraint-modal.js';
import * as expressionModal from './ui/modals/expression-modal.js';
import * as codesModal from './ui/modals/codes-modal.js';
import * as validateModal from './ui/modals/validate-modal.js';
import * as initialModal from './ui/modals/initial-modal.js';
import * as repeatableModal from './ui/modals/repeatable-modal.js';
import * as statesModal from './ui/modals/states-modal.js';
import * as noteModal from './ui/modals/note-modal.js';
import * as answerTypeModal from './ui/modals/answer-type/modal.js';
import * as metadataModal from './ui/modals/metadata-modal.js';
import * as appearanceModal from './ui/modals/appearance-modal.js';
import * as qrExportModal from './ui/modals/qr-export-modal.js';
import * as libraryModal from './ui/modals/library-modal.js';
import * as jsonViewer from './ui/modals/json-viewer.js';
import * as variablesPanel from './ui/variables-panel.js';
import * as containedPanel from './ui/contained-panel.js';
import * as answerValueSetPanel from './ui/answer-valueset-panel.js';
import * as patientCtx from './ui/patient-ctx.js';
import { questVariables, questContained, tree } from './state.js';
import { reinitForm } from './render-preview.js';

// ── Show When modal ───────────────────────────────────────────────────────────
showWhenModal.init({
  modal:     document.getElementById('showWhenModal'),
  title:     document.getElementById('showWhenModalTitle'),
  body:      document.getElementById('showWhenModalBody'),
  closeBtn:  document.getElementById('showWhenModalClose'),
  cancelBtn: document.getElementById('showWhenModalCancel'),
  applyBtn:  document.getElementById('showWhenModalApply'),
});

// ── Constraint modal ──────────────────────────────────────────────────────────
constraintModal.init({
  modal:     document.getElementById('constraintModal'),
  title:     document.getElementById('constraintModalTitle'),
  body:      document.getElementById('constraintModalBody'),
  closeBtn:  document.getElementById('constraintModalClose'),
  cancelBtn: document.getElementById('constraintModalCancel'),
  applyBtn:  document.getElementById('constraintModalApply'),
});

// ── Codes modal ───────────────────────────────────────────────────────────────
codesModal.init({
  modal:     document.getElementById('codesModal'),
  title:     document.getElementById('codesModalTitle'),
  body:      document.getElementById('codesModalBody'),
  closeBtn:  document.getElementById('codesModalClose'),
  cancelBtn: document.getElementById('codesModalCancel'),
  applyBtn:  document.getElementById('codesModalApply'),
});

// ── Expression modal ──────────────────────────────────────────────────────────
expressionModal.init({
  modal:     document.getElementById('expressionModal'),
  title:     document.getElementById('exprModalTitle'),
  body:      document.getElementById('exprModalBody'),
  closeBtn:  document.getElementById('exprModalClose'),
  cancelBtn: document.getElementById('exprModalCancel'),
  applyBtn:  document.getElementById('exprModalApply'),
});

// ── Validate modal ────────────────────────────────────────────────────────────
validateModal.init({
  modal:    document.getElementById('validateModal'),
  title:    document.getElementById('validateModalTitle'),
  body:     document.getElementById('validateModalBody'),
  footer:   document.getElementById('validateModalFooter'),
  closeBtn: document.getElementById('validateModalClose'),
});

// ── Default Value modal ───────────────────────────────────────────────────────
initialModal.init({
  modal:     document.getElementById('initialModal'),
  title:     document.getElementById('initialModalTitle'),
  body:      document.getElementById('initialModalBody'),
  closeBtn:  document.getElementById('initialModalClose'),
  cancelBtn: document.getElementById('initialModalCancel'),
  applyBtn:  document.getElementById('initialModalApply'),
});

// ── Repeatable modal ──────────────────────────────────────────────────────────
repeatableModal.init({
  modal:     document.getElementById('repeatableModal'),
  title:     document.getElementById('repeatableModalTitle'),
  body:      document.getElementById('repeatableModalBody'),
  closeBtn:  document.getElementById('repeatableModalClose'),
  cancelBtn: document.getElementById('repeatableModalCancel'),
  applyBtn:  document.getElementById('repeatableModalApply'),
});

// ── States modal (Required / Read-only / Hidden) ──────────────────────────────
statesModal.init({
  modal:     document.getElementById('statesModal'),
  title:     document.getElementById('statesModalTitle'),
  body:      document.getElementById('statesModalBody'),
  closeBtn:  document.getElementById('statesModalClose'),
  cancelBtn: document.getElementById('statesModalCancel'),
  applyBtn:  document.getElementById('statesModalApply'),
});

// ── Design Note modal ─────────────────────────────────────────────────────────
noteModal.init({
  modal:     document.getElementById('designNoteModal'),
  title:     document.getElementById('designNoteModalTitle'),
  body:      document.getElementById('designNoteModalBody'),
  closeBtn:  document.getElementById('designNoteModalClose'),
  cancelBtn: document.getElementById('designNoteModalCancel'),
  applyBtn:  document.getElementById('designNoteModalApply'),
});

// ── Answer Type modal ─────────────────────────────────────────────────────────
answerTypeModal.init({
  modal:     document.getElementById('answerTypeModal'),
  title:     document.getElementById('answerTypeModalTitle'),
  body:      document.getElementById('answerTypeModalBody'),
  closeBtn:  document.getElementById('answerTypeModalClose'),
  cancelBtn: document.getElementById('answerTypeModalCancel'),
  applyBtn:  document.getElementById('answerTypeModalApply'),
});

// ── Metadata (Properties) modal ───────────────────────────────────────────────
metadataModal.init({
  modal:     document.getElementById('metadataModal'),
  title:     document.getElementById('metadataModalTitle'),
  body:      document.getElementById('metadataModalBody'),
  closeBtn:  document.getElementById('metadataModalClose'),
  cancelBtn: document.getElementById('metadataModalCancel'),
  applyBtn:  document.getElementById('metadataModalApply'),
});

// ── Appearance modal ──────────────────────────────────────────────────────────
appearanceModal.init({
  modal:     document.getElementById('appearanceModal'),
  title:     document.getElementById('appearanceModalTitle'),
  body:      document.getElementById('appearanceModalBody'),
  closeBtn:  document.getElementById('appearanceModalClose'),
  cancelBtn: document.getElementById('appearanceModalCancel'),
  applyBtn:  document.getElementById('appearanceModalApply'),
});

// ── Variables panel ───────────────────────────────────────────────────────────
variablesPanel.init({
  card:      document.getElementById('variablesCard'),
  toggle:    document.getElementById('variablesCardToggle'),
  chipList:  document.getElementById('variablesCardChips'),
  count:     document.getElementById('variablesCardCount'),
  editBtn:   document.getElementById('variablesEditBtn'),
  reinitBtn: document.getElementById('variablesReinitBtn'),
  modal:     document.getElementById('variablesModal'),
  modalBody: document.getElementById('variablesModalBody'),
  closeBtn:  document.getElementById('variablesModalClose'),
  applyBtn:  document.getElementById('variablesModalApply'),
  cancelBtn: document.getElementById('variablesModalCancel'),
}, questVariables);

// ── QR Export modal ───────────────────────────────────────────────────────────
qrExportModal.init({
  modal:     document.getElementById('qrExportModal'),
  title:     document.getElementById('qrExportModalTitle'),
  body:      document.getElementById('qrExportModalBody'),
  closeBtn:  document.getElementById('qrExportModalClose'),
  cancelBtn: document.getElementById('qrExportModalCancel'),
  applyBtn:  document.getElementById('qrExportModalApply'),
});

// ── Library modal ─────────────────────────────────────────────────────────────
libraryModal.init({
  modal:    document.getElementById('libraryModal'),
  closeBtn: document.getElementById('libraryModalClose'),
  cancelBtn: document.getElementById('libraryModalCloseBtn'),
  body:     document.getElementById('libraryModalBody'),
});

// ── JSON Viewer modal ─────────────────────────────────────────────────────────
jsonViewer.init({
  modal:     document.getElementById('fhirJsonModal'),
  title:     document.getElementById('fhirJsonModalTitle'),
  pre:       document.getElementById('fhirJsonModalPre'),
  closeBtn:  document.getElementById('fhirJsonModalClose'),
  cancelBtn: document.getElementById('fhirJsonModalCloseBtn'),
});

// ── Contained resources panel ─────────────────────────────────────────────────
containedPanel.init({
  card:     document.getElementById('containedCard'),
  toggle:   document.getElementById('containedCardToggle'),
  chipList: document.getElementById('containedCardChips'),
  count:    document.getElementById('containedCardCount'),
}, questContained);

// ── Answer ValueSet panel ─────────────────────────────────────────────────────
answerValueSetPanel.init({
  card:     document.getElementById('answerValueSetCard'),
  toggle:   document.getElementById('answerValueSetCardToggle'),
  chipList: document.getElementById('answerValueSetCardChips'),
  count:    document.getElementById('answerValueSetCardCount'),
}, tree);

// ── Patient context popup ─────────────────────────────────────────────────────
patientCtx.init({
  presetBtn:  document.getElementById('patientPresetBtn'),
  presetMenu: document.getElementById('patientPresetMenu'),
  modal:      document.getElementById('patientCtxModal'),
  closeBtn:   document.getElementById('patientCtxClose'),
  applyBtn:   document.getElementById('patientCtxApply'),
  body:       document.getElementById('patientCtxBody'),
}, questVariables);

// Refresh variables panel chips when patient context changes
document.addEventListener('patient-ctx-applied', () => variablesPanel.refresh());
// Re-evaluate FHIRPath when variables or patient context change
document.addEventListener('reinit-form', reinitForm);
// Open JSON viewer via event bus
document.addEventListener('show-json', e => jsonViewer.show(e.detail.title, e.detail.data));
