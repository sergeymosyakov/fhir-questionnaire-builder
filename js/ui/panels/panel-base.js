// ── Base collapsible resource card panel ──────────────────────────────────────
// Shared DOM wiring, collapse/expand, count badge, and questionnaire event hooks.
// Subclasses override configure(services) and refresh() + _renderChips().
export class Panel {
  constructor(cardId, toggleId, chipListId, countId) {
    this._el = {
      card:     document.getElementById(cardId),
      toggle:   document.getElementById(toggleId),
      chipList: document.getElementById(chipListId),
      count:    document.getElementById(countId),
    };
    this._collapsed = false;
    this._el.toggle.addEventListener('click', () => this._toggleCollapse());
    document.addEventListener('questionnaire-loaded',  () => this.refresh());
    document.addEventListener('questionnaire-cleared', () => this.refresh());
  }

  /** Override in subclass — store injected service refs then call refresh(). */
  configure(_services) {}

  /** Override in subclass — rebuild chip list from current data. */
  refresh() {}

  _toggleCollapse() {
    this._collapsed = !this._collapsed;
    this._el.toggle.setAttribute('aria-expanded', String(!this._collapsed));
    this._el.chipList.style.display = this._collapsed ? 'none' : '';
    this._el.toggle.classList.toggle('fhir-res-card-toggle--collapsed', this._collapsed);
  }

  _showCount(count) {
    this._el.card.style.display  = count > 0 ? '' : 'none';
    this._el.count.textContent   = count > 0 ? String(count) : '';
    this._el.count.style.display = count > 0 ? '' : 'none';
  }
}
