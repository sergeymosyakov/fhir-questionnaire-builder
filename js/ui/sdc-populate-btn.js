// ── SdcPopulateBtn ────────────────────────────────────────────────────────────
// Self-wiring button that triggers SDC $populate.
// Visible only when fhirBaseUrl is configured in serverConfig.
// Mounts to [data-mount="sdc-populate-btn"].
import { AppEvents, EventState } from '../events.js';
import { serverConfig, CONFIG_KEYS } from '../fhir/server-config.js';
import { sdcPopulateModal } from './modals/sdc-populate-modal.js';

export class SdcPopulateBtn {
  constructor() {
    this._btn  = document.querySelector('[data-mount="sdc-populate-btn"]');
    if (!this._btn) return;

    this._visible = false;
    this._btn.style.display = 'none';

    this._btn.addEventListener('click', () => this._onClick());

    // Show/hide based on fhirBaseUrl + questionnaire loaded
    document.addEventListener(AppEvents.QUESTIONNAIRE_LOADED,  () => this._sync());
    document.addEventListener(AppEvents.QUESTIONNAIRE_CLEARED, () => this._sync());
    document.addEventListener(AppEvents.QUESTIONNAIRE_NEW,     () => this._sync());
    document.addEventListener(AppEvents.APP_CONTEXT_READY,     () => this._sync());

    this._sync();
  }

  _sync() {
    const hasFhirBase    = !!(serverConfig.get(CONFIG_KEYS.FHIR_BASE));
    const hasQuestionnaire = !!(EventState.get(AppEvents.QUESTIONNAIRE_LOADED));
    const show = hasFhirBase && hasQuestionnaire;
    this._btn.style.display = show ? '' : 'none';
    this._visible = show;
  }

  _onClick() {
    // Pre-fill with 'Patient/' hint
    sdcPopulateModal.open('Patient/');
  }
}
