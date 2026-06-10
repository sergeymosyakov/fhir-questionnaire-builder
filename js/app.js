// Entry point: wires toolbar buttons and orchestrates UI modules.
import * as storage from './storage/storage.js';
import { SupabaseAdapter } from './storage/supabase-adapter.js';
import { supabase } from './auth/supabase-client.js';
import { tree, values, rawFhir, questVariables, questContained, questMeta, getValue, setValue, calcFormOk, isMandatory, evalConstraints, CHECKABLE_TYPES, clearAllValues, resetQuestMeta, resetSeq } from './state.js';
import { buildFHIRObject, buildFHIRObjectVersioned, configure as configureExport } from './fhir/export.js';
import { configure as configureImport } from './fhir/import.js';
import { configure as configureQrExport } from './fhir/qr-export.js';
import { initValidators } from './fhir/validators/init.js';
import * as validateModal from './ui/modals/validate-modal.js';
import * as metadataModal from './ui/modals/metadata-modal.js';
import * as progress from './ui/progress.js';
import { RenumberControl } from './ui/renumber-control.js';
import * as search from './ui/search.js';
import { UndoRedo } from './ui/undo-redo.js';
import { renumberAll, addRootGroup, mount as mountBuilder, renderTree, renderTreeAsync } from './builder/index.js';
import { setRenumberGetter } from './builder/_shared.js';
import * as helpModal from './ui/modals/help-modal.js';
import { PreviewForm } from './preview-form.js';
import { saveMenu, settingsMenu, prefs, answersMenu, questionnairesMenu, mount as mountHeaderActions } from './ui/header-actions.js';
import './ui/modals/index.js';
import * as variablesPanel    from './ui/variables-panel.js';
import containedPanel        from './ui/panels/contained-panel.js';
import answerValueSetPanel   from './ui/panels/answer-valueset-panel.js';
import * as patientCtx        from './ui/patient-ctx.js';
import { FileNameDisplay } from './ui/file-name.js';
import { AppEvents } from './events.js';
import { FhirVersionSelect } from './ui/fhir-version-select.js';
import { clearConfirmModal } from './ui/modals/clear-confirm-modal.js';
import { AuthPanel } from './ui/auth-panel.js';
import { MetadataCard } from './ui/metadata-card.js';
import { PanelResizer } from './ui/panel-resizer.js';
import * as statusBadge from './ui/status-badge.js';
import { QRAnswersManager } from './fhir/qr-answers-manager.js';
import { QuestionnaireLoader } from './fhir/questionnaire-loader.js';
import { CopyPaste } from './ui/copy-paste.js';
import { BaseNode } from './nodes/base-node.js';

// Register storage adapter before any module that reads storage is initialised.
storage.register(new SupabaseAdapter(supabase));

// ── Inject state into UI panels ────────────────────────────────────────
containedPanel.configure({ questContained });
answerValueSetPanel.configure({ tree });
variablesPanel.configure({ questVariables, mountEl: document.getElementById('variablesCardMount') });
patientCtx.configure({ tree, questVariables });
patientCtx.mount(document.getElementById('patientPresetWrap'));
AuthPanel.configure({ tree });

// ── Inject state into FHIR modules ─────────────────────────────────────
configureExport({ tree, questMeta, rawFhir, questVariables, questContained });
configureImport({ tree, resetSeq, rawFhir, questVariables, questContained, questMeta, setValue, clearAllValues, renderTree });
configureQrExport({ values });

// ── Manager singletons (DI from state) ─────────────────────────────────
export const qrAnswers   = new QRAnswersManager({ values, tree, rawFhir, shouldValidate: () => prefs.get('validate') });
export const questLoader = new QuestionnaireLoader({ tree, values, questMeta, rawFhir,
  reinitForm:       (opts) => previewForm.reinitForm(opts),
  shouldValidate:   () => prefs.get('validate'),
  renderTree,
  renderTreeAsync,
  clearAllValues,
  resetQuestMeta,
  questVariables,
  questContained,
});

export const previewForm = new PreviewForm({
  tree, values, getValue, setValue, rawFhir, questVariables,
  calcFormOk, isMandatory, evalConstraints, CHECKABLE_TYPES,
});

// Mount header action menus into toolbar
mountHeaderActions(document.getElementById('headerActions'));

// Inject manager singletons into menus (breaks circular app.js ← menu → app.js)
answersMenu.configure({ qrAnswers });
questionnairesMenu.configure({ questLoader });

// FileNameDisplay — mounts chip into preview section-title
const fileNameDisplay = new FileNameDisplay(document.querySelector('.right-panel .section-title'));
// Wire cloud elements from menus into AuthPanel (cross-component, no getElementById)
AuthPanel.configureCloudEls({
  saveBtn:  saveMenu.cloudSaveBtn,
  saveSep:  saveMenu.cloudSaveSep,
  loadItem: questionnairesMenu.cloudItem,
  loadSep:  questionnairesMenu.cloudSep,
  questLoader,
});
// AuthPanel — mounts sign-in / user chip into authWrap, handles cloud ops
new AuthPanel(document.getElementById('authWrap'));

// questionnaire-clear-requested is dispatched by the × button in FileNameDisplay
document.addEventListener(AppEvents.QUESTIONNAIRE_CLEAR_REQUESTED, () => questLoader.confirmAndReset());
// questionnaire-reset is dispatched by AuthPanel (sign-out with unsaved work)
document.addEventListener(AppEvents.QUESTIONNAIRE_RESET, () => questLoader.reset());

// Buttons
document.getElementById('addRootGroupBtn').onclick = () => {
  addRootGroup();
  // If no file is loaded yet, signal that a new questionnaire was started
  if (!fileNameDisplay.getName()) document.dispatchEvent(new CustomEvent(AppEvents.QUESTIONNAIRE_NEW));
};

// ── Builder toolbar + tree container ──────────────────────────────────────────
mountBuilder({
  collapseAllBtn: document.getElementById('collapseAllBtn'),
  expandAllBtn:   document.getElementById('expandAllBtn'),
  treeContainer:  document.getElementById('treeContainer'),
});

// Mount FHIR version selector
new FhirVersionSelect(
  document.getElementById('fhirVersionSelectMount'),
  () => questMeta.fhirTarget,
).mount();

new RenumberControl(
  document.getElementById('renumberFormatWrap'),
  document.getElementById('renumberBtn'),
  { renumberAll, setRenumberGetter },
);

// ── Global progress bar init ──────────────────────────────────────────────
progress.init({
  wrap:    document.getElementById('progressWrap'),
  bar:     document.getElementById('progressBar'),
  label:   document.getElementById('progressLabel'),
  blocker: document.getElementById('uiBlocker'),
});

// ── Tooltip init (for tooltipsOffBadge and settingsMenu sync) ───────────────
const _tooltipsOffBadge = document.getElementById('tooltipsOffBadge');
import('./ui/tooltip.js').then(tt => {
  tt.init().then(() => {
    _tooltipsOffBadge.style.display = tt.isEnabled() ? 'none' : '';
  });
});

statusBadge.init({
  btn:      document.getElementById('statusBadgeBtn'),
  dropdown: document.getElementById('statusDropdown'),
  wrap:     document.getElementById('statusBadgeWrap'),
}, (id) => {
  document.dispatchEvent(new CustomEvent(AppEvents.BUILDER_NAVIGATE, { detail: { id } }));
});

document.getElementById('helpBtn').addEventListener('click', () => helpModal.open());

// ── Search init ───────────────────────────────────────────────────────────
search.init({
  input:       document.getElementById('searchInput'),
  prevBtn:     document.getElementById('searchPrevBtn'),
  nextBtn:     document.getElementById('searchNextBtn'),
  counter:     document.getElementById('searchCounter'),
  lform:       document.getElementById('lform'),
  fhirJsonView: document.getElementById('fhirJsonView'),
  searchWrap:  document.getElementById('searchWrap'),
});

// ── Preview module init ──────────────────────────────────────────────────────
previewForm.mount({
  lform:           document.getElementById('lform'),
  fhirJsonView:    document.getElementById('fhirJsonView'),
  leftPanelBody:   document.querySelector('.left-panel-body'),
  viewOptionsWrap: document.getElementById('viewOptionsWrap'),
  previewModeWrap: document.getElementById('previewModeWrap'),
  searchWrap:      document.getElementById('searchWrap'),
});

// ── Save/Export menu ──────────────────────────────────────────────────────────
saveMenu.configure({ fileNameDisplay, tree, values });

// ── Settings menu handlers ────────────────────────────────────────────────────
// Tips and Autosave initial states resolve asynchronously from storage —
// we update the menu rows once each module finishes its init() call.
Promise.all([
  import('./ui/tooltip.js').then(async tt => { await tt.init(); return tt; }),
  import('./ui/autosave.js').then(async as => {
    await as.init({
      buildFn:   buildFHIRObject,
      questMeta: questMeta,
      onSaved:   date => {
        const label = date
          ? 'Autosave \u00b7 ' + String(date.getHours()).padStart(2, '0') + ':' + String(date.getMinutes()).padStart(2, '0')
          : 'Autosave';
        settingsMenu.setAutosaveLabel(label);
      },
    });
    return as;
  }),
]).then(([tt, as]) => {
  settingsMenu.setHandlers({
    initialTips:      tt.isEnabled(),
    initialAutosave:  as.isEnabled(),
    onTipsToggle:     (enabled) => {
      tt.setEnabled(enabled);
      const badge = document.getElementById('tooltipsOffBadge');
      if (badge) badge.style.display = enabled ? 'none' : '';
    },
    onAutosaveToggle: (enabled) => as.setEnabled(enabled),
    onValidate: () => {
      validateModal.show('Validate \u2014 Report', 'validate', { questJson: buildFHIRObjectVersioned(questMeta.fhirTarget), tree, values });
    },
    onExpand:   () => previewForm.expandAll(),
    onCollapse: () => previewForm.collapseAll(),
  });
});

// ── Metadata card (status + experimental badge) ──────────────────────────────
new MetadataCard({
  questMeta,
  mountEl: document.getElementById('questMetaCardMount'),
  onEdit: () => metadataModal.open(),
});


// ── Configure reset flow (DI: UI callbacks for confirm → export → reset) ─────
questLoader.configureResetFlow({
  confirmOpen:        () => clearConfirmModal.open(),
  promptExport:       (onDone) => saveMenu.promptExport(onDone),
  showValidateExport: (onExport) => {
    validateModal.show('Export — Validation Report', 'export', { questJson: buildFHIRObjectVersioned(questMeta.fhirTarget), tree, values, onExport });
  },
  clearDraft: () => import('./ui/autosave.js').then(m => m.clearDraft()),
});

// Close any open dropdowns when clicking outside
document.addEventListener('click', () => {
  document.dispatchEvent(new CustomEvent(AppEvents.CLOSE_DROPDOWNS));
});

// ── Panel resize drag ─────────────────────────────────────────────────────────
new PanelResizer({
  resizer:    document.getElementById('panelResizer'),
  panel:      document.querySelector('.left-panel'),
  storageKey: 'leftPanelWidth',
}).init();

new UndoRedo(
  document.getElementById('undoBtn'),
  document.getElementById('redoBtn'),
);

// ── Copy / Paste ──────────────────────────────────────────────────────────────
// Instantiated after builder/index.js so BaseNode._svc already exists.
// Services are patched into BaseNode._svc here to avoid a circular import chain.
CopyPaste.configure({ tree, questContained });
const _copyPaste = new CopyPaste();
BaseNode.configure({
  copyNode:   (id) => _copyPaste.copy(id),
  pasteAfter:  (id) => _copyPaste.paste(id),
  pasteBefore: (id) => _copyPaste.pasteBefore(id),
  hasPaste:   () => _copyPaste.hasPending(),
});

// Initialise validators from config.json (async — runs in background)
// Pass initial enabled state from persisted prefs so validators start correctly
initValidators({ localEnabled: prefs.get('validate'), externalEnabled: prefs.get('validateExternal') });
