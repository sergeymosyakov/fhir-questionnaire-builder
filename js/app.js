// Entry point: wires toolbar buttons and orchestrates UI modules.
import * as storage from './storage/storage.js';
import { SupabaseAdapter } from './storage/supabase-adapter.js';
import { supabase } from './auth/supabase-client.js';
import { questDoc } from './fhir/quest-document.js';
import { answerStore } from './answer-store.js';
import './fhir/import.js';
import './fhir/qr-export.js';
import './fhir/obs-export.js';
import { initValidators } from './fhir/validators/init.js';
import './ui/modals/obs-export-modal.js';
import { UndoRedo } from './ui/undo-redo.js';
import { mount as mountBuilder } from './builder/index.js';
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
import { QRAnswersManager } from './fhir/qr-answers-manager.js';
import { QuestionnaireLoader } from './fhir/questionnaire-loader.js';
import { CopyPaste } from './ui/copy-paste.js';
// Instantiated after builder/index.js so BaseNode event listeners are active.
// Register storage adapter before any module that reads storage is initialised.
storage.register(new SupabaseAdapter(supabase));

// ── Patient profile widget ────────────────────────────────────────────────────
new PatientProfile();
// variables-panel self-initializes on import via side-effect

// FHIR modules self-wire via APP_CONTEXT_READY — no configure() calls needed

// ── Manager singletons (DI from state) ─────────────────────────────────
export const qrAnswers   = new QRAnswersManager({ questDoc, answerStore });
export const questLoader = new QuestionnaireLoader({ questDoc, answerStore });

export const previewForm = new PreviewForm({ questDoc, answerStore });

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

// ── FHIR version selector (self-finds and self-mounts) ──────────────────
new FhirVersionSelect();

// progress, statusBadge, search, tooltip: self-init on import
import('./ui/tooltip.js').then(tt => tt.init());


// ── Settings menu handlers ────────────────────────────────────────────────────
import('./ui/autosave.js').then(as => as.init());

// ── Metadata card (self-finds [data-mount="metadata-card"]) ───────────────────
new MetadataCard();

// Reset flow is self-wired in QuestionnaireLoader constructor
// CLOSE_DROPDOWNS on outside click is self-wired in DropdownMenu static {}

// ── Panel resize drag (self-finds panel-resizer and left-panel) ───────────────
new PanelResizer({ storageKey: 'leftPanelWidth' });

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
});