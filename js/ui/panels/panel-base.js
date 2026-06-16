// ── Base collapsible resource card panel ──────────────────────────────────────
// Each subclass builds its own card DOM and self-inserts before .left-panel-body.
// Subclasses override configure(services) and refresh() + _renderChips().

const _SVG = `<svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M2 3.5 L5 6.5 L8 3.5"/></svg>`;

function _mk(tag, className) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  return el;
}

export class Panel {
  /**
   * @param {object} cfg
   * @param {string} cfg.mod       — CSS modifier suffix, e.g. 'contained' | 'avs'
   * @param {string} cfg.idPrefix  — base string for element IDs, e.g. 'containedCard' | 'answerValueSetCard'
   * @param {string} cfg.label     — visible card title text
   * @param {string} cfg.tipTitle  — tooltip title on the title span
   * @param {string} cfg.tipBody   — tooltip body on the title span
   * @param {string} cfg.tipFhir   — data-tip-fhir attribute value
   * @param {string} cfg.tipSpec   — data-tip-spec attribute value
   */
  constructor({ mod, idPrefix, label, tipTitle, tipBody, tipFhir, tipSpec }) {
    this._card = _mk('div', 'fhir-res-card');
    this._card.style.display = 'none';
    if (idPrefix) this._card.id = idPrefix;

    const header = _mk('div', 'fhir-res-card-header');

    this._toggle = _mk('button', 'fhir-res-card-toggle');
    this._toggle.type = 'button';
    if (idPrefix) this._toggle.id = idPrefix + 'Toggle';
    this._toggle.setAttribute('aria-expanded', 'true');
    this._toggle.dataset.tipTitle = 'Collapse / expand';
    this._toggle.dataset.tipBody  = `Toggle the ${label} card open or closed.`;
    this._toggle.innerHTML = _SVG;

    const titleEl = _mk('span', `fhir-res-card-title fhir-res-card-title--${mod}`);
    titleEl.dataset.tipTitle = tipTitle;
    titleEl.dataset.tipBody  = tipBody;
    titleEl.dataset.tipFhir  = tipFhir;
    titleEl.dataset.tipSpec  = tipSpec;
    titleEl.textContent = label;

    this._count = _mk('span', `fhir-res-card-count fhir-res-card-count--${mod}`);
    if (idPrefix) this._count.id = idPrefix + 'Count';

    header.append(this._toggle, titleEl, this._count);

    this._chipList = _mk('div', 'fhir-res-card-chips');
    if (idPrefix) this._chipList.id = idPrefix + 'Chips';

    this._card.append(header, this._chipList);

    // Self-insert before .left-panel-body (same parent as variables card)
    const anchor = document.querySelector('.left-panel-body');
    anchor.parentElement.insertBefore(this._card, anchor);

    this._collapsed = false;
    this._toggle.addEventListener('click', () => this._toggleCollapse());
    // Subclasses call refresh() themselves after updating their data
    // in their own QUESTIONNAIRE_LOADED/CLEARED listeners.
  }

  /** Override in subclass — store injected service refs then call refresh(). */
  configure(_services) {}

  /** Override in subclass — rebuild chip list from current data. */
  refresh() {}

  _toggleCollapse() {
    this._collapsed = !this._collapsed;
    this._toggle.setAttribute('aria-expanded', String(!this._collapsed));
    this._chipList.style.display = this._collapsed ? 'none' : '';
    this._toggle.classList.toggle('fhir-res-card-toggle--collapsed', this._collapsed);
  }

  _showCount(count) {
    this._card.style.display  = count > 0 ? '' : 'none';
    this._count.textContent   = count > 0 ? String(count) : '';
    this._count.style.display = count > 0 ? '' : 'none';
  }
}
