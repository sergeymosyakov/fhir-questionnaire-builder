// ── Generic modal section base class + shared UI helpers ─────────────────────
// Any modal that composes its body from self-registering sections should have
// its section classes extend Section (directly or via a modal-specific subclass
// such as AnswerTypeSection or ItemSection).
//
// Minimum contract:  build(pending) → HTMLElement | DocumentFragment
// Modal-specific subclasses add lifecycle methods as needed.
//
// applyTip / makeCollapsible are exported here so ALL section directories can
// import from one place instead of duplicating or cross-importing helpers.

export class Section {
  /** @type {string[] | null} Allowed FHIR version ids; null = all versions. */
  fhirVersions = null;

  /**
   * Inject shared services used by version-gated sections.
   * Called once by builder/index.js after Modal.configure().
   * @param {{ getFhirTarget: () => string }} svc
   */
  static _svc = {};
  static configure(svc) { Object.assign(Section._svc, svc); }

  /**
   * Returns true if the section should be shown for the current FHIR version.
   * Override isVisible() in subclasses — call super.isVersionVisible() first.
   */
  isVersionVisible() {
    if (!this.fhirVersions) return true;
    const target = Section._svc.getFhirTarget?.() ?? 'R4';
    return this.fhirVersions.includes(target);
  }

  /** Build and return the DOM element (or fragment) for this section.
   *  @param {object} _pending — the modal's shared draft/data object
   *  @returns {HTMLElement | DocumentFragment} */
  build(_pending) { return document.createElement('div'); }
}

// ── Shared tip helper ─────────────────────────────────────────────────────────

/** Apply data-tip-* attributes to an element from a tip descriptor object. */
export function applyTip(el, tip) {
  if (!tip) return;
  el.dataset.tipTitle = tip.title;
  if (tip.body) el.dataset.tipBody = tip.body;
  if (tip.fhir) el.dataset.tipFhir = tip.fhir;
  if (tip.spec) el.dataset.tipSpec  = tip.spec;
}

// ── Generic collapsible section shell ────────────────────────────────────────
/**
 * Build a collapsible section element usable by any modal that uses the
 * meta-modal-advanced / meta-modal-adv-toggle / meta-modal-adv-body CSS classes.
 *
 * @param {string}   opts.testid        data-testid on the toggle button
 * @param {object}   [opts.tip]         { title, body, fhir, spec }
 * @param {string}   opts.label         visible text (e.g. 'Derived From')
 * @param {Function} [opts.countFn]     () => number — drives badge; omit for none
 * @param {boolean}  [opts.initialOpen] default false
 * @param {Function}  opts.buildBody    ({ el, setLabel, expand }) => void
 * @param {boolean}  [opts.liveUpdate]  add input/click listeners to refresh badge
 * @returns {HTMLElement}
 */
export function makeCollapsible({
  testid, tip, label, countFn, initialOpen = false, buildBody, liveUpdate = false,
}) {
  const section = document.createElement('div');
  section.className = 'meta-modal-advanced';

  const toggle = document.createElement('button');
  toggle.type           = 'button';
  toggle.className      = 'meta-modal-adv-toggle';
  toggle.dataset.testid = testid;
  applyTip(toggle, tip);

  let open = initialOpen;

  const body = document.createElement('div');
  body.className     = 'meta-modal-adv-body';
  body.style.display = open ? '' : 'none';

  const setLabel = () => {
    const count = countFn ? countFn() : 0;
    const badge = count ? ` (${count})` : '';
    toggle.textContent = (open ? '\u25BC' : '\u25BA') + ' ' + label + badge;
  };

  const expand = () => { open = true; body.style.display = ''; };

  buildBody({ el: body, setLabel, expand });
  setLabel();

  toggle.addEventListener('click', () => {
    open = !open;
    body.style.display = open ? '' : 'none';
    setLabel();
  });

  if (liveUpdate) {
    body.addEventListener('input', () => setLabel());
    body.addEventListener('click', () => setTimeout(setLabel, 0));
  }

  section.append(toggle, body);
  return section;
}
