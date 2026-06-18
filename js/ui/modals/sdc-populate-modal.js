// ── SdcPopulateModal ──────────────────────────────────────────────────────────
// Modal for entering a Patient reference before triggering $populate.
// Pre-fills from the last known patient reference if available.
import { Modal } from './modal-base.js';
import { AppEvents } from '../../events.js';

export class SdcPopulateModal extends Modal {
  constructor() {
    super({ applyLabel: 'Fill from Server', cancelLabel: 'Cancel', maxWidth: '420px' });
    this.title.textContent = 'Fill from FHIR Server ($populate)';
    this._build();
  }

  getName() { return 'sdcPopulate'; }

  _build() {
    this.body.innerHTML = '';

    const desc = document.createElement('p');
    desc.className = 'modal-field-hint';
    desc.style.marginBottom = '12px';
    desc.textContent = 'Enter a Patient reference. The server will pre-fill the form with data from the patient record.';
    this.body.appendChild(desc);

    const row = document.createElement('div');
    row.className = 'modal-field-row';

    const lbl = document.createElement('label');
    lbl.textContent = 'Patient reference';
    lbl.className = 'modal-field-label';
    lbl.setAttribute('for', 'sdc-populate-patient-ref');
    lbl.dataset.tipTitle = 'SDC $populate subject';
    lbl.dataset.tipBody  = 'FHIR reference string pointing to the Patient resource to use as the subject for pre-population.';
    lbl.dataset.tipFhir  = 'Parameters.parameter[subject].valueReference';
    lbl.dataset.tipSpec  = 'SDC';

    this._input = document.createElement('input');
    this._input.type        = 'text';
    this._input.id          = 'sdc-populate-patient-ref';
    this._input.className   = 'modal-input';
    this._input.placeholder = 'Patient/123';
    this._input.dataset.testid = 'sdc-populate-patient-ref-input';
    this._input.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); this._apply(); }
    });

    row.appendChild(lbl);
    row.appendChild(this._input);
    this.body.appendChild(row);
  }

  /**
   * Open the modal, optionally pre-filling the patient reference.
   * @param {string} [defaultRef] - pre-fill value (e.g. 'Patient/123')
   */
  open(defaultRef = '') {
    this._build();
    this._input.value = defaultRef;
    super.open();
    setTimeout(() => this._input.focus(), 50);
  }

  _apply() {
    const ref = this._input.value.trim();
    if (!ref) {
      this._input.style.borderColor = 'var(--c-danger, #c62828)';
      return;
    }
    // Normalise: if user types just an ID, prefix with Patient/
    const patientRef = ref.includes('/') ? ref : `Patient/${ref}`;
    document.dispatchEvent(new CustomEvent(AppEvents.SDC_POPULATE_REQUESTED, {
      detail: { patientRef },
    }));
    this.close();
  }

  _cancel() { this.close(); }
}

export const sdcPopulateModal = new SdcPopulateModal();
