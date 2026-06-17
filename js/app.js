// Entry point: wires toolbar buttons and orchestrates UI modules.
import * as storage from './storage/storage.js';
import { SupabaseAdapter } from './storage/supabase-adapter.js';
import { supabase } from './auth/supabase-client.js';
import { questDoc, answerStore, calcFormOk, isMandatory, evalConstraints, CHECKABLE_TYPES } from './state.js';
import { configure as configureImport } from './fhir/import.js';
import './fhir/qr-export.js';
import './fhir/obs-export.js';
import { initValidators } from './fhir/validators/init.js';
import * as metadataModal from './ui/modals/metadata-modal.js';
import './ui/modals/obs-export-modal.js';
import * as progress from './ui/progress.js';
import { RenumberControl } from './ui/renumber-control.js';
import * as search from './ui/search.js';
import { UndoRedo } from './ui/undo-redo.js';
import { renumberAll, addRootGroup, mount as mountBuilder, renderTree, renderTreeAsync } from './builder/index.js';
import * as helpModal from './ui/modals/help-modal.js';
import { PreviewForm } from './preview-form.js';
import { saveMenu, prefs, questionnairesMenu, mount as mountHeaderActions } from './ui/header-actions.js';
import './ui/modals/index.js';
import * as variablesPanel    from './ui/variables-panel.js';
import _containedPanel        from './ui/panels/contained-panel.js';
import _answerValueSetPanel   from './ui/panels/answer-valueset-panel.js';
import { PatientProfile } from './ui/patient-panel.js';
import { FileNameDisplay } from './ui/file-name.js';
import { AppEvents } from './events.js';
import { FhirVersionSelect } from './ui/fhir-version-select.js';
// clear-confirm-modal and load-confirm-modal are imported via ui/modals/index.js
import { AuthPanel } from './ui/auth-panel.js';
import { MetadataCard } from './ui/metadata-card.js';
import { PanelResizer } from './ui/panel-resizer.js';
import * as statusBadge from './ui/status-badge.js';
import { QRAnswersManager } from './fhir/qr-answers-manager.js';
import { QuestionnaireLoader } from './fhir/questionnaire-loader.js';
import { CopyPaste } from './ui/copy-paste.js';
// Instantiated after builder/index.js so BaseNode event listeners are active.
// Register storage adapter before any module that reads storage is initialised.
storage.register(new SupabaseAdapter(supabase));

// ── Patient profile widget ──────────────────────────────────────────────
const patientProfile = new PatientProfile();
patientProfile.mount(document.getElementById('patientPresetWrap'));
variablesPanel.configure({ mountEl: document.getElementById('variablesCardMount') });

// FHIR modules self-wire via APP_CONTEXT_READY — no configure() calls needed
// import.js still needs renderTree injected (not available via APP_CONTEXT_READY)
configureImport({ renderTree });

// ── Manager singletons (DI from state) ─────────────────────────────────
export const qrAnswers   = new QRAnswersManager({ questDoc, answerStore, shouldValidate: () => prefs.get('validate') });
export const questLoader = new QuestionnaireLoader({ questDoc, answerStore,
  reinitForm:       (opts) => previewForm.reinitForm(opts),
  shouldValidate:   () => prefs.get('validate'),
  renderTree,
  renderTreeAsync,
});

export const previewForm = new PreviewForm({
  questDoc, answerStore,
  calcFormOk, isMandatory, evalConstraints, CHECKABLE_TYPES,
});

// Mount header action menus into toolbar
mountHeaderActions(document.getElementById('headerActions'));

// questionnairesMenu dispatches QUESTIONNAIRE_LOAD_REQUESTED — no configure() needed

// FileNameDisplay — mounts chip into preview section-title; self-contained
new FileNameDisplay(document.querySelector('.right-panel .section-title'));
// Wire cloud elements from menus into AuthPanel (cross-component, no getElementById)
AuthPanel.configureCloudEls({
  saveBtn:  saveMenu.cloudSaveBtn,
  saveSep:  saveMenu.cloudSaveSep,
  loadItem: questionnairesMenu.cloudItem,
  loadSep:  questionnairesMenu.cloudSep,
});
// AuthPanel — mounts sign-in / user chip into authWrap, handles cloud ops
new AuthPanel(document.getElementById('authWrap'));

// questionnaire-clear-requested, questionnaire-reset, questionnaire-load-requested
// are all handled by QuestionnaireLoader which self-wires in its constructor.

// Seed all subscribers with the initial empty questDoc+answerStore.
// Uses APP_CONTEXT_READY (not QUESTIONNAIRE_LOADED) so it does NOT
// trigger UI visibility changes (card show/hide, toolbar, etc.).
document.dispatchEvent(new CustomEvent(AppEvents.APP_CONTEXT_READY, {
  detail: { questDoc, answerStore },
}));

// Buttons
document.getElementById('addRootGroupBtn').onclick = () => addRootGroup();
// QUESTIONNAIRE_NEW is dispatched by BuilderPanel.addRootGroup() when tree was empty

// ── Builder toolbar + tree container ──────────────────────────────────────────
mountBuilder({
  collapseAllBtn: document.getElementById('collapseAllBtn'),
  expandAllBtn:   document.getElementById('expandAllBtn'),
  treeContainer:  document.getElementById('treeContainer'),
});

// Mount FHIR version selector
new FhirVersionSelect(
  document.getElementById('fhirVersionSelectMount'),
  () => questDoc.fhirTarget,
).mount();

new RenumberControl(
  document.getElementById('renumberFormatWrap'),
  document.getElementById('renumberBtn'),
  { renumberAll },
);

// ── Global progress bar init ──────────────────────────────────────────────
progress.init({
  wrap:    document.getElementById('progressWrap'),
  bar:     document.getElementById('progressBar'),
  label:   document.getElementById('progressLabel'),
  blocker: document.getElementById('uiBlocker'),
});

// ── Tooltip init ────────────────────────────────────────────────────────────
// tooltip.js updates #tooltipsOffBadge and dispatches TIPS_INIT_DONE itself
import('./ui/tooltip.js').then(tt => tt.init());

statusBadge.init({
  btn:      document.getElementById('statusBadgeBtn'),
  dropdown: document.getElementById('statusDropdown'),
  wrap:     document.getElementById('statusBadgeWrap'),
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
// FILE_NAME_CHANGED event wires FileNameDisplay → save-menu

// ── Settings menu handlers ────────────────────────────────────────────────────
// tooltip.js → TIPS_INIT_DONE/TIPS_TOGGLED  → settings-menu (self-wired)
// autosave.js → AUTOSAVE_INIT_DONE/AUTOSAVE_SAVED/AUTOSAVE_TOGGLED → settings-menu (self-wired)
import('./ui/autosave.js').then(as => as.init());

// ── Metadata card (status + experimental badge) ──────────────────────────────
new MetadataCard({
  questMeta: questDoc.meta,
  mountEl: document.getElementById('questMetaCardMount'),
  onEdit: () => metadataModal.open(),
});


// Reset flow is self-wired in QuestionnaireLoader constructor

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
// Instantiated after builder/index.js so BaseNode event listeners are active.
new CopyPaste();

// Initialise validators from config.json (async — runs in background)
// Pass initial enabled state from persisted prefs so validators start correctly
initValidators({
  localEnabled: prefs.get('validate'),
  externalEnabled: prefs.get('validateExternal'),
  getFhirTarget: () => questDoc.fhirTarget,
});