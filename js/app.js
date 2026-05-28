// Entry point: wires toolbar buttons and orchestrates UI modules.
import * as storage from './storage/storage.js';
import { SupabaseAdapter } from './storage/supabase-adapter.js';
import { supabase } from './auth/supabase-client.js';
import { tree, values, rawFhir, effect, clearAllValues, questVariables, questContained, questMeta, getValue, setValue, calcFormOk, isMandatory, evalConstraints, CHECKABLE_TYPES } from './state.js';
import { validateTree } from './fhir/validate.js';
import * as validateModal from './ui/modals/validate-modal.js';
import * as metadataModal from './ui/modals/metadata-modal.js';
import * as progress from './ui/progress.js';
import { RenumberControl } from './ui/renumber-control.js';
import * as search from './ui/search.js';
import { TooltipToggle } from './ui/tooltip-toggle.js';
import * as autosave from './ui/autosave.js';
import * as statusBadge from './ui/status-badge.js';
import { renderTree, renumberAll, addRootGroup, mount as mountBuilder } from './builder/index.js';
import { setRenumberGetter } from './builder/_shared.js';
import * as helpModal from './ui/modals/help-modal.js';
import { PreviewForm } from './preview-form.js';
import { saveMenu, toolsMenu, answersMenu, questionnairesMenu, mount as mountHeaderActions } from './ui/header-actions.js';
import './ui/modals/index.js';
import * as variablesPanel    from './ui/variables-panel.js';
import containedPanel        from './ui/panels/contained-panel.js';
import answerValueSetPanel   from './ui/panels/answer-valueset-panel.js';
import * as patientCtx        from './ui/patient-ctx.js';
import { FileNameDisplay } from './ui/file-name.js';
import { AppEvents } from './events.js';
import { clearConfirmModal } from './ui/modals/clear-confirm-modal.js';
import { AuthPanel } from './ui/auth-panel.js';
import { MetadataCard } from './ui/metadata-card.js';
import { PanelResizer } from './ui/panel-resizer.js';
import { AutosaveToggle } from './ui/autosave-toggle.js';
import { UndoRedo } from './ui/undo-redo.js';
import { destroyTree } from './utils.js';
import { _formTick, _bulkUpdate } from './render-bus.js';
import { QRAnswersManager } from './fhir/qr-answers-manager.js';
import { QuestionnaireLoader } from './fhir/questionnaire-loader.js';

// Register storage adapter before any module that reads storage is initialised.
storage.register(new SupabaseAdapter(supabase));

// ── Inject state into UI panels ────────────────────────────────────────
containedPanel.configure({ questContained });
answerValueSetPanel.configure({ tree });
variablesPanel.configure({ questVariables, mountEl: document.getElementById('variablesCardMount') });
patientCtx.configure({ tree, effect, questVariables });
patientCtx.mount(document.getElementById('patientPresetWrap'));
AuthPanel.configure({ tree, effect });
AutosaveToggle.configure({ questMeta });
UndoRedo.configure({ effect, formTick: _formTick });

// ── Manager singletons (DI from state) ─────────────────────────────────
export const qrAnswers   = new QRAnswersManager({ values, tree, rawFhir, formTick: _formTick });
export const questLoader = new QuestionnaireLoader({ tree, values, questMeta,
  reinitForm: (opts) => previewForm.reinitForm(opts),
});

export const previewForm = new PreviewForm({
  effect, tree, values, getValue, setValue, rawFhir, questVariables,
  formTick: _formTick, bulkUpdate: _bulkUpdate,
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
document.addEventListener(AppEvents.QUESTIONNAIRE_CLEAR_REQUESTED, _clearForm);
// questionnaire-reset is dispatched by AuthPanel (sign-out with unsaved work)
document.addEventListener(AppEvents.QUESTIONNAIRE_RESET, _doReset);

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

// ── Tooltip toggle ───────────────────────────────────────────────────────
new TooltipToggle(
  document.getElementById('tooltipToggleBtn'),
  document.getElementById('tooltipsOffBadge'),
);

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

// ── Tools menu handlers ───────────────────────────────────────────────────────
toolsMenu.setHandlers({
  onValidate: () => {
    const issues = validateTree(tree, values);
    validateModal.show('Validate — Report', issues, 'import');
  },
  onExpand: () => previewForm.expandAll(),
  onCollapse: () => previewForm.collapseAll(),
});

// ── Metadata card (status + experimental badge) ──────────────────────────────
new MetadataCard({
  effect, questMeta,
  mountEl: document.getElementById('questMetaCardMount'),
  onEdit: () => metadataModal.open(),
});


async function _clearForm() {
  if (tree.length > 0) {
    const choice = await clearConfirmModal.open();
    if (choice === 'cancel') return;
    if (choice === 'export') {
      const issues = validateTree(tree, values);
      if (issues.length === 0) {
        saveMenu.promptExport(_doReset);
        return;
      } else {
        // Show modal; after export (or skip) we do NOT auto-clear — user decides
        validateModal.show('Export \u2014 Validation Report', issues, 'export', {
          onExport: () => { saveMenu.promptExport(_doReset); },
        });
        return;
      }
    }
  }
  _doReset();
}

function _doReset() {
  // Destroy listeners on old nodes and clear tree
  destroyTree(tree);
  // Clear plain values store
  clearAllValues();
  // Clear rawFhir
  rawFhir.value = null;
  // Reset questionnaire-level metadata
  questMeta.id = ''; questMeta.url = ''; questMeta.version = '';
  questMeta.title = ''; questMeta.status = 'draft';
  questMeta.publisher = ''; questMeta.description = ''; questMeta.name = '';
  questMeta.date = ''; questMeta.subjectType = [];
  questMeta.purpose = ''; questMeta.copyright = '';
  questMeta.approvalDate = ''; questMeta.lastReviewDate = '';
  questMeta.effectivePeriodStart = ''; questMeta.effectivePeriodEnd = '';
  questMeta.experimental = null; questMeta.language = ''; questMeta.derivedFrom = [];
  questMeta.replaces = [];
  questMeta._rawIdentifier = [];
  questMeta._rawText = null;
  questMeta._rawContact = null; questMeta._rawUseContext = null; questMeta._rawJurisdiction = null;
  questMeta._rawCode = null;
  questMeta._metaVersionId = ''; questMeta._metaSource = '';
  questMeta._metaLastUpdated = ''; questMeta._rawMetaProfile = [];
  questMeta._rawMetaTag = []; questMeta._rawMetaSecurity = [];
  questMeta._rawQuestExtensions = [];
  // Clear questionnaire-level variables
  questVariables.splice(0);
  questContained.splice(0);
  // Re-render empty builder
  renderTree();
  autosave.clearDraft();
  document.dispatchEvent(new CustomEvent(AppEvents.QUESTIONNAIRE_CLEARED));
}

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

new AutosaveToggle(document.getElementById('autosaveToggleBtn'));

new UndoRedo(
  document.getElementById('undoBtn'),
  document.getElementById('redoBtn'),
);
