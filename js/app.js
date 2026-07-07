// Entry point — composition root. All modules self-wire via events + EventState.
import * as storage from './storage/storage.js';
import { SupabaseAdapter } from './storage/supabase-adapter.js';
import { supabase } from './auth/supabase-client.js';
import { questDoc } from './fhir/quest-document.js';
import { answerStore } from './answer-store.js';
import { serverConfig, LocalStorageConfigProvider } from './fhir/server-config.js';
import './fhir/server-config-cloud.js';
import './fhir/import.js';
import './fhir/qr-export.js';
import './fhir/obs-export.js';
import { initValidators } from './fhir/validators/init.js';
import './ui/modals/obs-export-modal.js';
import { UndoRedo } from './ui/undo-redo.js';
import './builder/index.js';
import { PreviewForm } from './preview-form.js';
import './ui/header-actions.js';
import './ui/left-header-actions.js';
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
import { PanelResizer } from './ui/panel-resizer.js';
import { SimpleMode } from './ui/simple-mode.js';
import { QRAnswersManager } from './fhir/qr-answers-manager.js';
import { QuestionnaireLoader } from './fhir/questionnaire-loader.js';
// Register storage adapter before any module that reads storage is initialised.
storage.register(new SupabaseAdapter(supabase));

// ── Server config — register providers (low to high priority) ────────────────
serverConfig.register(new LocalStorageConfigProvider());   // user overrides
serverConfig.load('./config.json');                         // base defaults (async, non-blocking)

// ── Patient profile widget ────────────────────────────────────────────────────
new PatientProfile();

// ── Self-wiring singletons — each subscribes to APP_CONTEXT_READY ─────────
new QRAnswersManager();
new QuestionnaireLoader();
new PreviewForm();

// header-actions and builder self-mount on import

// FileNameDisplay — self-finds [data-mount="file-name"]
new FileNameDisplay();
// AuthPanel — self-finds [data-mount="auth-panel"] + cloud elements by data-mount
new AuthPanel();

// Seed all subscribers with the initial empty questDoc+answerStore.
document.dispatchEvent(new CustomEvent(AppEvents.APP_CONTEXT_READY, {
  detail: { questDoc, answerStore },
}));

// Builder, header menus, fhir-version: self-mount on import
// (builder mount runs after APP_CONTEXT_READY via EventState)

// ── FHIR version selector (self-finds and self-mounts) ──────────────────
new FhirVersionSelect();

// progress, statusBadge, search, tooltip: self-init on import
import('./ui/tooltip.js').then(tt => tt.init());


// ── Settings menu handlers ────────────────────────────────────────────────────
import('./ui/autosave.js').then(as => as.init());

// ── Panel resize drag (self-finds panel-resizer and left-panel) ───────────────
new PanelResizer({ storageKey: 'leftPanelWidth' });

// ── Undo/Redo (self-finds undo-btn and redo-btn) ──────────────────────────────
new UndoRedo();

// ── Simple / Advanced builder view mode (self-finds left-panel) ───────────────
new SimpleMode();

// Validators: read config.json and prefs from localStorage directly
initValidators();