// Entry point: wires toolbar buttons and orchestrates UI modules.
import * as storage from './storage/storage.js';
import { LocalStorageAdapter } from './storage/local-storage.js';
import { SupabaseAdapter } from './storage/supabase-adapter.js';
import { supabase } from './auth/supabase-client.js';
import * as auth from './auth/auth.js';
import * as cloudModal from './ui/modals/cloud-modal.js';
import { tree, values, rawFhir, effect, clearAllValues, questVariables, questContained, questMeta } from './state.js';
import { buildFHIRObject, exportFHIR } from './fhir/export.js';
import { validateTree } from './fhir/validate.js';
import * as validateModal from './ui/modals/validate-modal.js';
import * as metadataModal from './ui/modals/metadata-modal.js';
import * as qrExportModal from './ui/modals/qr-export-modal.js';
import * as progress from './ui/progress.js';
import * as search from './ui/search.js';
import * as tooltip from './ui/tooltip.js';
import * as autosave from './ui/autosave.js';
import { showPrompt } from './ui/toast.js';
import * as statusBadge from './ui/status-badge.js';
import { renderTree, collapseAll, expandAll, renumberAll, addRootGroup } from './builder/index.js';
import { importFHIR } from './fhir/import.js';
import { _formTick } from './render-bus.js';
import * as history from './ui/history.js';
import * as helpModal from './ui/modals/help-modal.js';
import { navigateToPreview, initPreview } from './render-preview.js';
import './ui/modals/index.js';
import * as variablesPanel    from './ui/variables-panel.js';
import containedPanel        from './ui/panels/contained-panel.js';

// Register storage adapter before any module that reads storage is initialised.
storage.register(new SupabaseAdapter(supabase));
import answerValueSetPanel   from './ui/panels/answer-valueset-panel.js';
import * as patientCtx        from './ui/patient-ctx.js';
import { setFileName, navigateToNode } from './app-load.js';

// ── Inject state into UI panels ─────────────────────────────────────────
containedPanel.configure({ questContained });
answerValueSetPanel.configure({ tree });
variablesPanel.configure({ questVariables });
patientCtx.configure({ tree, effect, questVariables });

// Buttons
document.getElementById('clearFormBtn').onclick    = _clearForm;


document.getElementById('addRootGroupBtn').onclick = () => {
  addRootGroup();
  // If no file is loaded, show a default name so the × button makes sense
  if (!document.getElementById('loadedFileName').textContent) setFileName('New Questionnaire');
};
document.getElementById('collapseAllBtn').onclick  = collapseAll;
// View options moved to dropdown menu (see viewOptionsBtn section below)
document.getElementById('expandAllBtn').onclick    = expandAll;
document.getElementById('renumberBtn').onclick = async () => {
  const btn = document.getElementById('renumberBtn');
  btn.disabled = true;
  progress.show('Renumbering…');
  const onProgress = e => progress.update(e.detail.done, e.detail.total);
  const cleanup = () => {
    progress.hide();
    btn.disabled = false;
    document.removeEventListener('renumber-progress', onProgress);
    document.removeEventListener('renumber-done', cleanup);
  };
  document.addEventListener('renumber-progress', onProgress);
  document.addEventListener('renumber-done', cleanup);
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
tooltip.init();

statusBadge.init({
  btn:      document.getElementById('statusBadgeBtn'),
  dropdown: document.getElementById('statusDropdown'),
  wrap:     document.getElementById('statusBadgeWrap'),
}, navigateToPreview);

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
});

// ── Preview module init ──────────────────────────────────────────────────────
initPreview({
  lform:                 document.getElementById('lform'),
  fhirJsonView:          document.getElementById('fhirJsonView'),
  leftPanelBody:         document.querySelector('.left-panel-body'),
  viewOptionsWrap:       document.getElementById('viewOptionsWrap'),
  previewModeWrap:       document.getElementById('previewModeWrap'),
  previewCollapseAllBtn: document.getElementById('previewCollapseAllBtn'),
  previewExpandAllBtn:   document.getElementById('previewExpandAllBtn'),
  searchWrap:            document.getElementById('searchWrap'),
});

// Prompt for filename then export
function _promptExport(afterExport) {
  const suggested = document.getElementById('loadedFileName')?.textContent.trim() || 'questionnaire';
  showPrompt('Save as:', suggested + '.json', name => {
    if (name === null) return; // cancelled
    const trimmed = name.replace(/\.json$/i, '');
    exportFHIR(trimmed + '.json');
    setFileName(trimmed);
    if (afterExport) afterExport();
  });
}

// ── Validate button ──────────────────────────────────────────────────────────
document.getElementById('validateBtn').onclick = () => {
  const issues = validateTree(tree, values);
  validateModal.show('Validate \u2014 Report', issues, 'import', { onNavigate: navigateToNode });
};

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

// ── Keyboard shortcuts ────────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
    const searchWrap = document.getElementById('searchWrap');
    const searchInput = document.getElementById('searchInput');
    if (searchWrap && searchInput && searchWrap.style.display !== 'none') {
      e.preventDefault();
      searchInput.focus();
      searchInput.select();
    }
  }
});

// ── Export dropdown ──────────────────────────────────────────────────────────
const exportMenu = document.getElementById('exportMenu');
document.getElementById('exportBtn').onclick = e => {
  e.stopPropagation();
  document.getElementById('loadMenu').style.display = 'none';
  document.getElementById('answersMenu').style.display = 'none';
  exportMenu.style.display = exportMenu.style.display === 'none' ? 'block' : 'none';
};
document.getElementById('exportFhirItem').onclick = () => {
  exportMenu.style.display = 'none';
  const issues = validateTree(tree, values);
  if (issues.length === 0) { _promptExport(); return; }
  validateModal.show('Export \u2014 Validation Report', issues, 'export', { onExport: () => _promptExport(), onNavigate: navigateToNode });
};
document.getElementById('exportQrItem').onclick = () => {
  exportMenu.style.display = 'none';
  const suggested = document.getElementById('loadedFileName')?.textContent.trim() || 'questionnaire';
  qrExportModal.open(suggested + '-response.json');
};


async function _clearForm() {
  if (tree.length > 0) {
    const choice = await _askBeforeClear();
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
          onNavigate: navigateToNode,
        });
        return;
      }
    }
  }
  _doReset();
}

function _doReset() {
  // Clear reactive tree
  tree.splice(0, tree.length);
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
  setFileName('');
  autosave.clearDraft();
  document.dispatchEvent(new CustomEvent('questionnaire-cleared'));
}

// Returns promise resolving to 'export' | 'clear' | 'cancel'
function _askBeforeClear() {
  return new Promise(resolve => {
    const backdrop = document.createElement('div');
    backdrop.className = 'clear-confirm-backdrop';

    const box = document.createElement('div');
    box.className = 'clear-confirm-box';
    box.innerHTML =
      '<div class="clear-confirm-title">Clear questionnaire?</div>' +
      '<div class="clear-confirm-msg">You have unsaved changes. Do you want to export before clearing?</div>' +
      '<div class="clear-confirm-btns">' +
        '<button class="btn-fhir btn-fhir-export" id="_ccExport" data-testid="clear-confirm-export-btn">⬇ Export first</button>' +
        '<button class="btn-fhir" id="_ccClear" data-testid="clear-confirm-clear-btn">Clear anyway</button>' +
        '<button class="btn-fhir" id="_ccCancel" data-testid="clear-confirm-cancel-btn">Cancel</button>' +
      '</div>';

    backdrop.appendChild(box);
    document.body.appendChild(backdrop);

    const esc = e => { if (e.key === 'Escape') close('cancel'); };
    document.addEventListener('keydown', esc);
    const close = (result) => { document.removeEventListener('keydown', esc); backdrop.remove(); resolve(result); };
    box.querySelector('#_ccExport').onclick  = () => close('export');
    box.querySelector('#_ccClear').onclick   = () => close('clear');
    box.querySelector('#_ccCancel').onclick  = () => close('cancel');
    backdrop.addEventListener('click', e => { if (e.target === backdrop) close('cancel'); });
  });
}

// Returns promise resolving to 'ok' | 'cancel'
function _askConfirm(title, msg, okLabel = 'OK', cancelLabel = 'Cancel') {
  return new Promise(resolve => {
    const backdrop = document.createElement('div');
    backdrop.className = 'clear-confirm-backdrop';

    const box = document.createElement('div');
    box.className = 'clear-confirm-box';
    box.innerHTML =
      `<div class="clear-confirm-title">${title}</div>` +
      `<div class="clear-confirm-msg">${msg}</div>` +
      '<div class="clear-confirm-btns">' +
        `<button class="btn-fhir" id="_acOk">${okLabel}</button>` +
        `<button class="btn-fhir" id="_acCancel">${cancelLabel}</button>` +
      '</div>';

    backdrop.appendChild(box);
    document.body.appendChild(backdrop);

    const esc = e => { if (e.key === 'Escape') close('cancel'); };
    document.addEventListener('keydown', esc);
    const close = r => { document.removeEventListener('keydown', esc); backdrop.remove(); resolve(r); };
    box.querySelector('#_acOk').onclick     = () => close('ok');
    box.querySelector('#_acCancel').onclick = () => close('cancel');
    backdrop.addEventListener('click', e => { if (e.target === backdrop) close('cancel'); });
  });
}

// Close any open ⊕ Add dropdown when clicking outside
document.addEventListener('click', () => {
  document.querySelectorAll('.action-add-menu').forEach(m => { m.style.display = 'none'; });
  document.getElementById('loadMenu').style.display    = 'none';
  document.getElementById('exportMenu').style.display  = 'none';
  document.getElementById('answersMenu').style.display = 'none';
  const ppMenu = document.getElementById('patientPresetMenu');
  if (ppMenu) ppMenu.style.display = 'none';
  const umMenu = document.getElementById('userMenu');
  if (umMenu) umMenu.style.display = 'none';
  const pmMenu = document.getElementById('previewModeMenu');
  if (pmMenu) pmMenu.style.display = 'none';
  const voMenu = document.getElementById('viewOptionsMenu');
  if (voMenu) voMenu.style.display = 'none';
});

// ── Preview mode dropdown ─────────────────────────────────────────────────────
{
  const _modeMenu = document.getElementById('previewModeMenu');
  const _modeBtn  = document.getElementById('previewModeBtn');
  const _modeLabels = {
    preview: '\uD83D\uDC41\uFE0F Preview \u25BE',
    patient: '\uD83D\uDC64 Patient \u25BE',
    json:    '{} FHIR JSON \u25BE',
  };
  function _applyPreviewMode(mode) {
    document.dispatchEvent(new CustomEvent('preview-mode-change', { detail: { mode } }));
    _modeBtn.textContent = _modeLabels[mode];
    document.querySelectorAll('#previewModeMenu .load-menu-item').forEach(item => {
      item.classList.toggle('load-menu-item--checked', item.dataset.mode === mode);
    });
  }
  _modeBtn.addEventListener('click', e => {
    e.stopPropagation();
    document.getElementById('loadMenu').style.display    = 'none';
    document.getElementById('answersMenu').style.display = 'none';
    document.getElementById('exportMenu').style.display  = 'none';
    _modeMenu.style.display = _modeMenu.style.display === 'none' ? 'block' : 'none';
  });
  document.querySelectorAll('#previewModeMenu .load-menu-item').forEach(item => {
    item.addEventListener('click', () => {
      _modeMenu.style.display = 'none';
      _applyPreviewMode(item.dataset.mode);
    });
  });
  // Set initial active state
  _applyPreviewMode('preview');
}

// ── View Options dropdown (id, prefix, badges, hidden) ───────────────────────
{
  const _voMenu = document.getElementById('viewOptionsMenu');
  const _voBtn  = document.getElementById('viewOptionsBtn');
  const _checkboxes = [
    { id: 'viewOptionLinkId', key: 'showLinkId' },
    { id: 'viewOptionPrefix', key: 'showPrefix' },
    { id: 'viewOptionBadges', key: 'showBadges' },
    { id: 'viewOptionHidden', key: 'showHiddenItems' },
  ];

  _voBtn.addEventListener('click', e => {
    e.stopPropagation();
    document.getElementById('loadMenu').style.display    = 'none';
    document.getElementById('answersMenu').style.display = 'none';
    document.getElementById('exportMenu').style.display  = 'none';
    document.getElementById('previewModeMenu').style.display = 'none';
    _voMenu.style.display = _voMenu.style.display === 'none' ? 'block' : 'none';
  });

  // Prevent menu from closing when clicking inside it
  _voMenu.addEventListener('click', e => {
    e.stopPropagation();
  });

  _checkboxes.forEach(({ id, key }) => {
    const checkbox = document.getElementById(id);
    checkbox.addEventListener('change', () => {
      document.dispatchEvent(new CustomEvent('view-pref-change', { detail: { key, value: checkbox.checked } }));
    });
  });
}

// ── Panel resize drag ─────────────────────────────────────────────────────────
{
  const resizer   = document.getElementById('panelResizer');
  const leftPanel = document.querySelector('.left-panel');
  const STORAGE_KEY = 'leftPanelWidth';
  const MIN = 200, MAX = () => window.innerWidth * 0.7;

  // Restore saved width
  let saved;
  try { saved = await storage.getItem(STORAGE_KEY); } catch { /* private mode / quota */ }
  if (saved) leftPanel.style.width = saved + 'px';

  let startX, startW;
  resizer.addEventListener('mousedown', e => {
    e.preventDefault();
    startX = e.clientX;
    startW = leftPanel.getBoundingClientRect().width;
    resizer.classList.add('resizing');

    // Overlay captures all pointer events and prevents text selection during drag
    const overlay = document.createElement('div');
    overlay.id = 'resize-overlay';
    overlay.className = 'resize-overlay';
    document.body.appendChild(overlay);

    const onMove = e => {
      const w = Math.min(MAX(), Math.max(MIN, startW + e.clientX - startX));
      leftPanel.style.width = w + 'px';
    };
    const onUp = () => {
      resizer.classList.remove('resizing');
      overlay.remove();
      try { storage.setItem(STORAGE_KEY, parseInt(leftPanel.style.width)); } catch { /* ignore */ }
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}

// Start empty — use Example button or Load FHIR JSON to load data
const _autosaveToggleBtn = document.getElementById('autosaveToggleBtn');
const _syncAutosaveState = (enabled, lastSaveDate) => {
  _autosaveToggleBtn.classList.toggle('btn-fhir--active', enabled);
  if (enabled) {
    const label = lastSaveDate
      ? 'autosave · ' + String(lastSaveDate.getHours()).padStart(2,'0') + ':' + String(lastSaveDate.getMinutes()).padStart(2,'0')
      : 'autosave';
    _autosaveToggleBtn.textContent = label;
  } else {
    _autosaveToggleBtn.textContent = 'autosave off';
  }
};
_autosaveToggleBtn.addEventListener('click', () => {
  const next = !autosave.isEnabled();
  autosave.setEnabled(next);
  _syncAutosaveState(next, null);
});
autosave.init({ buildFn: buildFHIRObject, questMeta, onSaved: (date) => {
  _syncAutosaveState(autosave.isEnabled(), date);
} });
// Sync button after init() has read the persisted enabled state from storage
_syncAutosaveState(autosave.isEnabled(), null);

// ── Undo / Redo ───────────────────────────────────────────────────────────────
const _undoBtn = document.getElementById('undoBtn');
const _redoBtn = document.getElementById('redoBtn');

function _syncUndoRedo() {
  _undoBtn.disabled = !history.canUndo();
  _redoBtn.disabled = !history.canRedo();
}

history.init({
  buildFn:  buildFHIRObject,
  importFn: importFHIR,
  renderFn: renderTree,
  formTick: _formTick,
  effect,
  onChange: _syncUndoRedo,
});

_undoBtn.addEventListener('click', () => { history.undo(); _syncUndoRedo(); });
_redoBtn.addEventListener('click', () => { history.redo(); _syncUndoRedo(); });

document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'z') {
    e.preventDefault(); history.undo(); _syncUndoRedo();
  } else if (
    ((e.ctrlKey || e.metaKey) && e.key === 'y') ||
    ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z')
  ) {
    e.preventDefault(); history.redo(); _syncUndoRedo();
  }
});

// ── Auth + Cloud ──────────────────────────────────────────────────────────────
{
  const _signInBtn    = document.getElementById('signInBtn');
  const _userChip     = document.getElementById('userChip');
  const _userMenuBtn  = document.getElementById('userMenuBtn');
  const _userMenu     = document.getElementById('userMenu');
  const _userAvatar   = document.getElementById('userAvatar');
  const _userName     = document.getElementById('userName');
  const _signOutBtn   = document.getElementById('signOutBtn');
  const _cloudSaveBtn  = document.getElementById('cloudSaveBtn');
  const _cloudSaveSep  = document.getElementById('cloudSaveSep');
  const _loadCloudItem = document.getElementById('loadCloudItem');
  const _loadCloudSep  = document.getElementById('loadCloudSep');

  // Track the cloud row id of the currently open questionnaire (for updates)
  let _currentCloudId = null;

  function _setAuthUI(user) {
    if (user) {
      _signInBtn.style.display  = 'none';
      _userChip.style.display   = 'inline-flex';
      _userAvatar.src           = user.user_metadata?.avatar_url || '';
      _userName.textContent     = user.user_metadata?.user_name || user.email || '';
      _loadCloudItem.style.display = '';
      _loadCloudSep.style.display  = '';
    } else {
      _signInBtn.style.display  = '';
      _userChip.style.display   = 'none';
      _loadCloudItem.style.display = 'none';
      _loadCloudSep.style.display  = 'none';
      _cloudSaveBtn.style.display = 'none';
      _cloudSaveSep.style.display = 'none';
      _currentCloudId = null;
    }
  }

  // Sync cloud save item visibility with login + tree state
  effect(() => {
    const loggedIn = _userChip.style.display !== 'none';
    const hasNodes = tree.length > 0;
    const show = loggedIn && hasNodes ? '' : 'none';
    _cloudSaveBtn.style.display = show;
    _cloudSaveSep.style.display = show;
  });

  // Reset cloud id when questionnaire is cleared
  document.addEventListener('questionnaire-cleared', () => { _currentCloudId = null; });

  _signInBtn.addEventListener('click', async () => {
    try { await auth.signInWithGitHub(); }
    catch (err) { import('./ui/toast.js').then(m => m.showError('Sign in failed: ' + err.message)); }
  });

  _userMenuBtn.addEventListener('click', e => {
    e.stopPropagation();
    if (_userMenu.style.display === 'none') {
      const r = _userMenuBtn.getBoundingClientRect();
      _userMenu.style.top      = (r.bottom + 4) + 'px';
      _userMenu.style.right    = (window.innerWidth - r.right) + 'px';
      _userMenu.style.minWidth = r.width + 'px';
      _userMenu.style.display  = 'block';
    } else {
      _userMenu.style.display = 'none';
    }
  });

  _signOutBtn.addEventListener('click', async () => {
    _userMenu.style.display = 'none';
    if (tree.length > 0) {
      const answer = await _askConfirm(
        'Sign out?',
        'Your unsaved work will be lost. Sign out anyway?',
        'Sign out', 'Cancel'
      );
      if (answer !== 'ok') return;
      _doReset();
    }
    try { await auth.signOut(); }
    catch (err) { import('./ui/toast.js').then(m => m.showError('Sign out failed: ' + err.message)); }
  });

  _cloudSaveBtn.addEventListener('click', async () => {
    document.getElementById('exportMenu').style.display = 'none';
    _cloudSaveBtn.classList.add('load-menu-item--loading');
    try {
      const fhirJson = buildFHIRObject();
      let row;
      if (_currentCloudId) {
        row = await storage.cloudUpdate(_currentCloudId, fhirJson);
      } else {
        row = await storage.cloudSave(fhirJson);
        _currentCloudId = row.id;
      }
      import('./ui/toast.js').then(m => m.showInfo('Saved to cloud'));
    } catch (err) {
      import('./ui/toast.js').then(m => m.showError('Cloud save failed: ' + err.message));
    } finally {
      _cloudSaveBtn.classList.remove('load-menu-item--loading');
    }
  });

  _loadCloudItem.addEventListener('click', async () => {
    document.getElementById('loadMenu').style.display = 'none';
    const { importAndValidate } = await import('./app-load.js');
    cloudModal.open(async id => {
      try {
        progress.show('Loading from cloud\u2026');
        const fhirJson = await storage.cloudLoad(id);
        _currentCloudId = id;
        await importAndValidate(fhirJson, fhirJson.title || 'Cloud questionnaire');
      } catch (err) {
        progress.hide();
        import('./ui/toast.js').then(m => m.showError('Cloud load failed: ' + err.message));
      }
    });
  });

  // Subscribe to auth state — fires immediately with current session
  auth.onAuthChange((event, user) => {
    _setAuthUI(user);
  });
}