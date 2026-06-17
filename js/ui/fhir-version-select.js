// ── FHIR Version Select widget ────────────────────────────────────────────────
// Renders a compact custom-select for the active FHIR target version.
// Reads available versions from versionRegistry, dispatches FHIR_VERSION_CHANGED
// when the user picks a different version.
//
// Usage:
//   const sel = new FhirVersionSelect(mountEl, getFhirTarget);
//   sel.mount();
//   sel.setValue('R5');  // programmatic update (no event dispatch)

import { versionRegistry } from '../fhir/version-registry.js';
import { createCustomSelect } from './custom-select.js';
import { AppEvents, EventState } from '../events.js';

export class FhirVersionSelect {
  /** @type {HTMLElement} */
  _mount;
  /** @type {() => string} */
  _getFhirTarget;
  /** @type {{ getValue: ()=>string, setValue: (v:string)=>void, setOptions: (items:object[])=>void } | null} */
  _sel = null;
  /** @type {HTMLElement | null} */
  _el = null;

  /**
   * @param {HTMLElement} mountEl - container to append the widget into
   * @param {() => string} getFhirTarget - returns current fhirTarget from questMeta
   */
  constructor() {
    this._mount = document.querySelector('[data-mount="fhir-version-select"]');
    this._sel = null;
    this._el = null;
  }

  mount() {
    const items = versionRegistry.getAll().map(v => ({ value: v.id, label: v.selectorLabel ?? v.label }));
    const wrap = document.createElement('span');
    wrap.className = 'fhir-version-select-wrap';
    wrap.dataset.testid = 'fhir-version-select-wrap';

    const fhirTarget = () => EventState.get(AppEvents.APP_CONTEXT_READY)?.questDoc?.meta?.fhirTarget ?? 'R4';
    const sel = createCustomSelect({
      items,
      value:     fhirTarget(),
      className: 'fhir-version-sel sc-trigger--sm',
      testid:    'fhir-version-select',
      onChange:  v => {
        document.dispatchEvent(new CustomEvent(AppEvents.FHIR_VERSION_CHANGED, {
          detail: { versionId: v, fromVersionId: fhirTarget(), source: 'user' },
        }));
      },
    });

    wrap.appendChild(sel.el);
    this._mount.appendChild(wrap);
    this._sel = sel;
    this._el  = wrap;

    // Listen for external version changes (e.g. from questionnaire-loader.js)
    document.addEventListener(AppEvents.FHIR_VERSION_CHANGED, e => {
      if (e.detail?.versionId && this._sel) {
        this._sel.setValue(e.detail.versionId);
      }
    });
  }

  /** Programmatically set selected version without dispatching an event. */
  setValue(versionId) {
    this._sel?.setValue(versionId);
  }
}
