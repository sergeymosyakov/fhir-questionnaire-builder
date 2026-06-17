// Entry point: wires toolbar buttons and orchestrates UI modules.
import * as storage from './storage/storage.js';
import { SupabaseAdapter } from './storage/supabase-adapter.js';
import { supabase } from './auth/supabase-client.js';
import { questDoc, answerStore, calcFormOk, isMandatory, evalConstraints, CHECKABLE_TYPES } from './state.js';
import './fhir/import.js';
import './fhir/qr-export.js';
import './fhir/obs-export.js';
import { initValidators } from './fhir/validators/init.js';
import * as metadataModal from './ui/modals/metadata-modal.js';
import './ui/modals/obs-export-modal.js';
import * as progress from './ui/progress.js';
import * as search from './ui/search.js';
import { UndoRedo } from './ui/undo-redo.js';
import { mount as mountBuilder } from './builder/index.js';
import * as helpModal from './ui/modals/help-modal.js';
import { PreviewForm } from './preview-form.js';
import { prefs, mount as mountHeaderActions } from './ui/header-actions.js';
import './ui/modals/index.js';
import './ui/variables-panel.js';
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

// ── Patient profile widget ────────────────────────────────────────────────────
new PatientProfile().mount();
// variables-panel self-initializes on import via side-effect

// FHIR modules self-wire via APP_CONTEXT_READY — no configure() calls needed

// ── Manager singletons (DI from state) ─────────────────────────────────
export const qrAnswers   = new QRAnswersManager({ questDoc, answerStore });
export const questLoader = new QuestionnaireLoader({ questDoc, answerStore });

export const previewForm = new PreviewForm({
  questDoc, answerStore,
  calcFormOk, isMandatory, evalConstraints, CHECKABLE_TYPES,
});

// Mount header action menus — each class self-finds its mount point
mountHeaderActions();

// FileNameDisplay — self-finds [data-mount="file-name"]
new FileNameDisplay();
// AuthPanel — self-finds [data-mount="auth-panel"] + cloud elements by data-mount
new AuthPanel();

// Seed all subscribers with the initial empty questDoc+answerStore.
document.dispatchEvent(new CustomEvent(AppEvents.APP_CONTEXT_READY, {
  detail: { questDoc, answerStore },
}));

// ── Builder toolbar + tree container (self-finds by data-mount) ───────────────
// BuilderPanel.mount() also wires addRootGroup, renumber, collapse/expand buttons
mountBuilder();

// ── Global progress bar (self-finds progress-* elements) ─────────────────────

// ── FHIR version selector (self-finds [data-mount="fhir-version-select"]) ─────
new FhirVersionSelect(() => questDoc.fhirTarget).mount();

// ── Builder toolbar + tree container (self-finds by data-mount) ───────────────
mountBuilder();
progress.init();

// ── Tooltip init ──────────────────────────────────────────────────────────────
import('./ui/tooltip.js').then(tt => tt.init());

// ── Status badge (self-finds status-badge-* elements) ─────────────────────────
statusBadge.init();

document.querySelector('[data-mount="help-btn"]').addEventListener('click', () => helpModal.open());

// ── Search (self-finds search-* elements) ─────────────────────────────────────
search.init();

// ── Preview form (self-finds all elements by data-mount) ──────────────────────
previewForm.mount();

// ── Settings menu handlers ────────────────────────────────────────────────────
import('./ui/autosave.js').then(as => as.init());

// ── Metadata card (self-finds [data-mount="metadata-card"]) ───────────────────
new MetadataCard({
  questMeta: questDoc.meta,
  onEdit: () => metadataModal.open(),
});

// Reset flow is self-wired in QuestionnaireLoader constructor

// Close any open dropdowns when clicking outside
document.addEventListener('click', () => {
  document.dispatchEvent(new CustomEvent(AppEvents.CLOSE_DROPDOWNS));
});

// ── Panel resize drag (self-finds panel-resizer and left-panel) ───────────────
new PanelResizer({ storageKey: 'leftPanelWidth' }).init();

// ── Undo/Redo (self-finds undo-btn and redo-btn) ──────────────────────────────
new UndoRedo();

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