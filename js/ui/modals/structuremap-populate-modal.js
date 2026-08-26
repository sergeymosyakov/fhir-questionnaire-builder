// ── StructureMapPopulateModal ─────────────────────────────────────────────────
// Modal for selecting a source resource (e.g. Patient) before running the
// questionnaire's sdc-questionnaire-sourceStructureMap client-side.
// Has a live search autocomplete (same as reference field in preview).
import { Modal } from './modal-base.js';
import { AppEvents } from '../../events.js';
import { createRefSearchAutocomplete } from '../ref-search.js';
import { serverConfig, CONFIG_KEYS } from '../../fhir/server-config.js';

export class StructureMapPopulateModal extends Modal {
  constructor() {
    super({ applyLabel: 'Run StructureMap', cancelLabel: 'Cancel', maxWidth: '440px' });
    this.title.textContent = 'Fill via StructureMap';
    this._autocomplete = null;
    this._build();
  }

  getName() { return 'structureMapPopulate'; }

  _build() {
    this.body.innerHTML = '';

    const desc = document.createElement('p');
    desc.className = 'modal-field-hint sdc-pop-desc';
    desc.textContent = 'Search for a patient by name. The questionnaire\u2019s sourceStructureMap will be run in-browser against their record to pre-fill answers. No server-side $populate support required.';
    this.body.appendChild(desc);

    const searchRow = document.createElement('div');
    searchRow.className = 'sdc-pop-field';

    const lbl = document.createElement('label');
    lbl.textContent = 'Patient';
    lbl.className = 'sdc-pop-label';
    lbl.setAttribute('for', 'sm-pop-search');
    lbl.dataset.tipTitle = 'sdc-questionnaire-sourceStructureMap';
    lbl.dataset.tipBody  = 'The selected resource is fetched from the FHIR server and passed as the source input to the contained StructureMap.';
    lbl.dataset.tipFhir  = 'Questionnaire.extension[sdc-questionnaire-sourceStructureMap].valueCanonical';
    lbl.dataset.tipSpec  = 'SDC';

    this._searchInput = document.createElement('input');
    this._searchInput.type        = 'text';
    this._searchInput.id          = 'sm-pop-search';
    this._searchInput.className   = 'ext-url-input sdc-pop-input';
    this._searchInput.placeholder = 'Search by name or enter Patient/{id}\u2026';
    this._searchInput.dataset.testid = 'structuremap-populate-patient-ref-input';
    this._searchInput.autocomplete = 'off';

    this._selectedRef = '';

    this._autocomplete = createRefSearchAutocomplete(this._searchInput, {
      getResourceType: () => 'Patient',
      isEnabled: () => !!serverConfig.get(CONFIG_KEYS.FHIR_BASE),
      extraClassName: 'sdc-pop-drop',
      onSelect: (r) => {
        this._searchInput.value = r.display + ' (' + r.id + ')';
        this._selectedRef = 'Patient/' + r.id;
      },
    });

    this._searchInput.addEventListener('input', () => {
      const q = this._searchInput.value.trim();
      this._selectedRef = q.includes('/') ? q : '';
    });

    searchRow.append(lbl, this._searchInput);
    this.body.appendChild(searchRow);
  }

  open() {
    this._selectedRef = '';
    this._searchInput.value = '';
    this._autocomplete?.close();
    super.open();
    setTimeout(() => this._searchInput.focus(), 50);
  }

  _apply() {
    const ref = this._selectedRef || this._searchInput.value.trim();
    if (!ref) { this._searchInput.classList.add('sdc-pop-input--error'); return; }
    this._searchInput.classList.remove('sdc-pop-input--error');
    const patientRef = ref.includes('/') ? ref : 'Patient/' + ref;
    document.dispatchEvent(new CustomEvent(AppEvents.STRUCTUREMAP_POPULATE_REQUESTED, {
      detail: { patientRef },
    }));
    this.close();
  }

  _cancel() {
    this._autocomplete?.close();
    this.close();
  }
}

export const structureMapPopulateModal = new StructureMapPopulateModal();
