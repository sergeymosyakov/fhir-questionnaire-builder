// ── SdcPopulateModal ──────────────────────────────────────────────────────────
// Modal for selecting a Patient before triggering $populate.
// Has a live search autocomplete (same as reference field in preview).
import { Modal } from './modal-base.js';
import { AppEvents } from '../../events.js';
import { searchFhir } from '../../fhir/fhir-search.js';
import { serverConfig, CONFIG_KEYS } from '../../fhir/server-config.js';

export class SdcPopulateModal extends Modal {
  constructor() {
    super({ applyLabel: 'Fill from Server', cancelLabel: 'Cancel', maxWidth: '440px' });
    this.title.textContent = 'Fill from FHIR Server ($populate)';
    this._debounce = null;
    this._drop = null;
    this._build();
  }

  getName() { return 'sdcPopulate'; }

  _build() {
    this.body.innerHTML = '';

    const desc = document.createElement('p');
    desc.className = 'modal-field-hint';
    desc.style.marginBottom = '14px';
    desc.textContent = 'Search for a patient by name. The server will pre-fill the questionnaire with data from their record.';
    this.body.appendChild(desc);

    const searchRow = document.createElement('div');
    searchRow.style.cssText = 'position:relative;';

    const lbl = document.createElement('label');
    lbl.textContent = 'Patient';
    lbl.style.cssText = 'display:block;font-size:12px;font-weight:600;color:var(--c-text-2);margin-bottom:6px;letter-spacing:.04em;text-transform:uppercase;';
    lbl.setAttribute('for', 'sdc-pop-search');
    lbl.dataset.tipTitle = 'SDC $populate subject';
    lbl.dataset.tipBody  = 'Patient reference passed as the subject to the $populate operation.';
    lbl.dataset.tipFhir  = 'Parameters.parameter[subject].valueReference';
    lbl.dataset.tipSpec  = 'SDC';

    this._searchInput = document.createElement('input');
    this._searchInput.type        = 'text';
    this._searchInput.id          = 'sdc-pop-search';
    this._searchInput.className   = 'ext-url-input';
    this._searchInput.style.cssText = 'width:100%;height:32px;padding:0 10px;font-size:13px;box-sizing:border-box;';
    this._searchInput.placeholder = 'Search by name or enter Patient/{id}\u2026';
    this._searchInput.dataset.testid = 'sdc-populate-patient-ref-input';
    this._searchInput.autocomplete = 'off';

    this._selectedRef = '';

    this._drop = document.createElement('div');
    this._drop.className = 'ref-search-drop';
    this._drop.style.cssText = 'display:none;position:fixed;z-index:10001;';
    document.body.appendChild(this._drop);

    const positionDrop = () => {
      const r = this._searchInput.getBoundingClientRect();
      this._drop.style.top   = (r.bottom + 3) + 'px';
      this._drop.style.left  = r.left + 'px';
      this._drop.style.width = r.width + 'px';
    };

    const closeDrop = () => { this._drop.style.display = 'none'; };
    const openDrop  = () => { positionDrop(); this._drop.style.display = 'block'; };

    const showResults = (results, query) => {
      this._drop.innerHTML = '';
      if (!results.length) {
        const empty = document.createElement('div');
        empty.className = 'ref-search-empty';
        empty.textContent = query ? 'No results' : 'Type to search\u2026';
        this._drop.appendChild(empty);
      } else {
        results.forEach(r => {
          const item = document.createElement('button');
          item.type = 'button';
          item.className = 'ref-search-item';
          item.innerHTML = '<span class="ref-search-name">' + r.display + '</span><span class="ref-search-id">' + r.id + '</span>';
          item.addEventListener('mousedown', e => {
            e.preventDefault();
            this._searchInput.value = r.display + ' (' + r.id + ')';
            this._selectedRef = 'Patient/' + r.id;
            closeDrop();
          });
          this._drop.appendChild(item);
        });
      }
      openDrop();
    };

    this._searchInput.addEventListener('input', () => {
      const q = this._searchInput.value.trim();
      this._selectedRef = q.includes('/') ? q : '';
      clearTimeout(this._debounce);
      if (!q) { closeDrop(); return; }
      if (!serverConfig.get(CONFIG_KEYS.FHIR_BASE)) { closeDrop(); return; }
      const loading = document.createElement('div');
      loading.className = 'ref-search-empty';
      loading.textContent = 'Searching\u2026';
      this._drop.innerHTML = '';
      this._drop.appendChild(loading);
      openDrop();
      this._debounce = setTimeout(async () => {
        try {
          const results = await searchFhir('Patient', q);
          showResults(results, q);
        } catch (e) {
          const err = document.createElement('div');
          err.className = 'ref-search-empty ref-search-error';
          err.textContent = e.message;
          this._drop.innerHTML = '';
          this._drop.appendChild(err);
        }
      }, 350);
    });

    this._searchInput.addEventListener('blur', () => setTimeout(closeDrop, 150));
    searchRow.append(lbl, this._searchInput);
    this.body.appendChild(searchRow);
  }

  open() {
    this._selectedRef = '';
    this._searchInput.value = '';
    if (this._drop) { this._drop.style.display = 'none'; this._drop.innerHTML = ''; }
    super.open();
    setTimeout(() => this._searchInput.focus(), 50);
  }

  _apply() {
    const ref = this._selectedRef || this._searchInput.value.trim();
    if (!ref) { this._searchInput.style.borderColor = '#c62828'; return; }
    const patientRef = ref.includes('/') ? ref : 'Patient/' + ref;
    document.dispatchEvent(new CustomEvent(AppEvents.SDC_POPULATE_REQUESTED, {
      detail: { patientRef },
    }));
    this.close();
  }

  _cancel() {
    if (this._drop) this._drop.style.display = 'none';
    this.close();
  }
}

export const sdcPopulateModal = new SdcPopulateModal();
