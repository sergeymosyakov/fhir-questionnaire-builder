// Entry point: wires toolbar buttons and orchestrates UI modules.
import * as storage from './storage/storage.js';
import { SupabaseAdapter } from './storage/supabase-adapter.js';
import { supabase } from './auth/supabase-client.js';
import { tree, values, rawFhir, effect, clearAllValues, questVariables, questContained, questMeta } from './state.js';
import { exportFHIR } from './fhir/export.js';
import { validateTree } from './fhir/validate.js';
import * as validateModal from './ui/modals/validate-modal.js';
import * as metadataModal from './ui/modals/metadata-modal.js';
import * as qrExportModal from './ui/modals/qr-export-modal.js';
import { createCustomSelect } from './ui/custom-select.js';
import * as progress from './ui/progress.js';
import * as search from './ui/search.js';
import * as tooltip from './ui/tooltip.js';
import * as autosave from './ui/autosave.js';
import { showPrompt } from './ui/toast.js';
import * as statusBadge from './ui/status-badge.js';
import { renderTree, renumberAll, addRootGroup } from './builder/index.js';
import { setRenumberGetter } from './builder/_shared.js';
import * as helpModal from './ui/modals/help-modal.js';
import { initPreview, collapseAllPreview, expandAllPreview } from './render-preview.js';
import { saveMenu, toolsMenu } from './ui/header-actions.js';
import './ui/modals/index.js';
import * as variablesPanel    from './ui/variables-panel.js';
import containedPanel        from './ui/panels/contained-panel.js';
import answerValueSetPanel   from './ui/panels/answer-valueset-panel.js';
import * as patientCtx        from './ui/patient-ctx.js';
import { FileNameDisplay } from './ui/file-name.js';
import { AppEvents } from './events.js';
import { clearConfirmModal } from './ui/modals/clear-confirm-modal.js';
import { AuthPanel } from './ui/auth-panel.js';
import { PanelResizer } from './ui/panel-resizer.js';
import { AutosaveToggle } from './ui/autosave-toggle.js';
import { UndoRedo } from './ui/undo-redo.js';
import { destroyTree } from './utils.js';

// Register storage adapter before any module that reads storage is initialised.
storage.register(new SupabaseAdapter(supabase));

// ── Inject state into UI panels ────────────────────────────────────────
containedPanel.configure({ questContained });
answerValueSetPanel.configure({ tree });
variablesPanel.configure({ questVariables });
patientCtx.configure({ tree, effect, questVariables });
AuthPanel.configure({ tree, effect });
AutosaveToggle.configure({ questMeta });
UndoRedo.configure({ effect, formTick: (await import('./render-bus.js'))._formTick });

// FileNameDisplay — mounts chip into preview section-title
const fileNameDisplay = new FileNameDisplay(document.querySelector('.right-panel .section-title'));
// AuthPanel — mounts sign-in / user chip into #authWrap, handles cloud ops
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
document.getElementById('collapseAllBtn').onclick  = () => document.dispatchEvent(new CustomEvent(AppEvents.BUILDER_COLLAPSE_ALL));
// View options moved to dropdown menu (see viewOptionsBtn section below)
document.getElementById('expandAllBtn').onclick    = () => document.dispatchEvent(new CustomEvent(AppEvents.BUILDER_EXPAND_ALL));

// Renumber format custom select (replaces native <select>)
const _renumberSel = createCustomSelect({
  items: [
    { value: 'numbers', label: '1 · 2 · 3' },
    { value: 'roman',   label: 'I · II · III' },
    { value: 'letters', label: 'A · B · C' },
  ],
  value: 'numbers',
  className: 'sc-trigger--sm',
  testid: 'renumber-format',
});
_renumberSel.el.dataset.tipTitle = 'Prefix format';
_renumberSel.el.dataset.tipBody  = 'Format used by Renumber: numeric (1, 1.1), Roman numerals (I, I.I), or letters (A, A.A). Does not affect linkId — only item.prefix.';
_renumberSel.el.dataset.tipFhir  = 'Questionnaire.item.prefix';
_renumberSel.el.dataset.tipSpec  = 'R4 · optional';
document.getElementById('renumberFormatWrap').appendChild(_renumberSel.el);
setRenumberGetter(() => _renumberSel.getValue() || 'numbers');

document.getElementById('renumberBtn').onclick = async () => {
  const btn = document.getElementById('renumberBtn');
  btn.disabled = true;
  progress.show('Renumbering…');
  const onProgress = e => progress.update(e.detail.done, e.detail.total);
  const cleanup = () => {
    progress.hide();
    btn.disabled = false;
    document.removeEventListener(AppEvents.RENUMBER_PROGRESS, onProgress);
    document.removeEventListener(AppEvents.RENUMBER_DONE, cleanup);
  };
  document.addEventListener(AppEvents.RENUMBER_PROGRESS, onProgress);
  document.addEventListener(AppEvents.RENUMBER_DONE, cleanup);
  try { await renumberAll(); } catch { cleanup(); }
};

// ── Global progress bar init ──────────────────────────────────────────────
progress.init({
  wrap:    document.getElementById('progressWrap'),
  bar:     document.getElementById('progressBar'),
  label:   document.getElementById('progressLabel'),
  blocker: document.getElementById('uiBlocker'),
});

// ── Tooltip init ─────────────────────────────────────────────────────────
tooltip.init().then(() => _syncTooltipState(tooltip.isEnabled()));

statusBadge.init({
  btn:      document.getElementById('statusBadgeBtn'),
  dropdown: document.getElementById('statusDropdown'),
  wrap:     document.getElementById('statusBadgeWrap'),
}, (id) => {
  document.dispatchEvent(new CustomEvent(AppEvents.BUILDER_NAVIGATE, { detail: { id } }));
});

const _tooltipToggleBtn  = document.getElementById('tooltipToggleBtn');
const _tooltipsOffBadge  = document.getElementById('tooltipsOffBadge');
const _syncTooltipState = (enabled) => {
  _tooltipToggleBtn.classList.toggle('btn-fhir--active', enabled);
  _tooltipsOffBadge.style.display = enabled ? 'none' : '';
};
_syncTooltipState(tooltip.isEnabled());
_tooltipToggleBtn.addEventListener('click', () => {
  const next = !tooltip.isEnabled();
  tooltip.setEnabled(next);
  _syncTooltipState(next);
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
initPreview({
  lform:           document.getElementById('lform'),
  fhirJsonView:    document.getElementById('fhirJsonView'),
  leftPanelBody:   document.querySelector('.left-panel-body'),
  viewOptionsWrap: document.getElementById('viewOptionsWrap'),
  previewModeWrap: document.getElementById('previewModeWrap'),
  searchWrap:      document.getElementById('searchWrap'),
});

// Prompt for filename then export
function _promptExport(afterExport) {
  const suggested = fileNameDisplay.getName().trim() || 'questionnaire';
  showPrompt('Save as:', suggested + '.json', name => {
    if (name === null) return; // cancelled
    const trimmed = name.replace(/\.json$/i, '');
    exportFHIR(trimmed + '.json');
    fileNameDisplay.setName(trimmed);
    if (afterExport) afterExport();
  });
}

// ── Save/Export menu handlers ─────────────────────────────────────────────────
saveMenu.setHandlers({
  onExportFhir: () => {
    const issues = validateTree(tree, values);
    if (issues.length === 0) { _promptExport(); return; }
    validateModal.show('Export — Validation Report', issues, 'export', { onExport: () => _promptExport() });
  },
  onExportQr: () => {
    const suggested = fileNameDisplay.getName().trim() || 'questionnaire';
    qrExportModal.open(suggested + '-response.json');
  },
});

// ── Tools menu handlers ───────────────────────────────────────────────────────
toolsMenu.setHandlers({
  onValidate: () => {
    const issues = validateTree(tree, values);
    validateModal.show('Validate — Report', issues, 'import');
  },
  onExpand: () => expandAllPreview(),
  onCollapse: () => collapseAllPreview(),
});

// ── Validate button ──────────────────────────────────────────────────────────

// ── Properties button ────────────────────────────────────────────────────────
document.getElementById('propertiesBtn').onclick = () => metadataModal.open();

// Sync metadata card summary whenever questMeta changes
const _metaCardStatus       = document.getElementById('questMetaCardStatus');
const _metaCardExperimental = document.getElementById('questMetaCardExperimental');
effect(() => {
  _metaCardStatus.textContent    = questMeta.status || 'draft';
  _metaCardStatus.dataset.status = questMeta.status || 'draft';
  const exp = questMeta.experimental;
  if (exp === null || exp === undefined) {
    _metaCardExperimental.style.display = 'none';
  } else {
    _metaCardExperimental.style.display  = '';
    _metaCardExperimental.textContent    = exp ? '⚗ experimental' : '✓ production';
    _metaCardExperimental.dataset.exp    = String(exp);
  }
});


async function _clearForm() {
  if (tree.length > 0) {
    const choice = await clearConfirmModal.open();
    if (choice === 'cancel') return;
    if (choice === 'export') {
      const issues = validateTree(tree, values);
      if (issues.length === 0) {
        _promptExport(_doReset);
        return;
      } else {
        // Show modal; after export (or skip) we do NOT auto-clear — user decides
        validateModal.show('Export — Validation Report', issues, 'export', {
          onExport: () => { _promptExport(_doReset); },
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
  const umMenu = document.getElementById('userMenu');
  if (umMenu) umMenu.style.display = 'none';
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
