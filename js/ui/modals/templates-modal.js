// ── Templates modal ───────────────────────────────────────────────────────────
// Search the template library, pick one, hand its catalog entry to the opener.
import { MODAL_REGISTRY } from './modal-registry.js';
import { Modal } from './modal-base.js';
import { loadTemplateLibrary, groupByCategory } from '../../fhir/templates.js';

class TemplatesModal extends Modal {
  getName() { return 'templatesModal'; }

  constructor() {
    super({ applyLabel: 'Insert', cancelLabel: 'Cancel', maxWidth: '560px', bodyClass: 'tpl-body' });
    MODAL_REGISTRY.set('templates', this);
  }

  open(onSelect) {
    this._onSelect = onSelect;
    this._selected = null;
    this._query = '';
    this._category = 'all';
    this.setTitle('Insert template');
    this.applyBtn.disabled = true;
    this.body.textContent = 'Loading…';
    super.open();
    loadTemplateLibrary()
      .then(entries => { this._entries = entries; this._render(); })
      .catch(err => {
        this.body.textContent = 'Could not load templates: ' + err.message;
        this.body.dataset.error = 'true';
      });
  }

  _cancel() { this._onSelect = null; this.close(); }

  _apply() {
    const cb = this._onSelect;
    const entry = this._selected;
    this._onSelect = null;
    this.close();
    if (cb && entry) cb(entry);
  }

  _render() {
    this.body.innerHTML = '';
    const search = document.createElement('input');
    search.type = 'search';
    search.className = 'eg-search';
    search.placeholder = 'Search templates…';
    search.dataset.testid = 'tpl-search';
    search.addEventListener('input', () => { this._query = search.value; this._renderRows(); });
    this._chips = document.createElement('div');
    this._chips.className = 'tpl-cats';
    this._chips.dataset.testid = 'tpl-cats';
    this._list = document.createElement('div');
    this._list.className = 'eg-list';
    this._list.dataset.testid = 'tpl-list';
    this._detail = document.createElement('div');
    this._detail.className = 'tpl-detail';
    this._detail.dataset.testid = 'tpl-detail';
    this._detail.hidden = true;
    this.body.append(search, this._chips, this._list, this._detail);
    this._renderChips();
    this._renderRows();
  }

  _renderChips() {
    this._chips.innerHTML = '';
    const options = [{ id: 'all', label: 'All' }, ...groupByCategory(this._entries).map(g => g.category)];
    for (const opt of options) {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'tpl-cat';
      chip.dataset.testid = 'tpl-cat-' + opt.id;
      chip.dataset.cat = opt.id;
      chip.textContent = opt.label;
      chip.addEventListener('click', () => { this._category = opt.id; this._syncChips(); this._renderRows(); });
      this._chips.appendChild(chip);
    }
    this._syncChips();
  }

  // Updates the existing chips in place so keyboard focus survives a filter change.
  _syncChips() {
    for (const chip of this._chips.children) {
      const active = chip.dataset.cat === this._category;
      chip.classList.toggle('tpl-cat--active', active);
      chip.setAttribute('aria-pressed', String(active));
    }
  }

  _matches() {
    const q = this._query.trim().toLowerCase();
    return groupByCategory(this._entries)
      .filter(g => this._category === 'all' || g.category.id === this._category)
      .map(g => ({
        category: g.category,
        entries: g.entries.filter(e => !q || [e.name, e.description, ...(e.keywords ?? [])].some(s => s.toLowerCase().includes(q))),
      }))
      .filter(g => g.entries.length);
  }

  _renderRows() {
    this._list.innerHTML = '';
    const groups = this._matches();
    this._dropHiddenSelection(groups);
    if (!groups.length) {
      const empty = document.createElement('div');
      empty.className = 'eg-note';
      empty.dataset.testid = 'tpl-empty';
      empty.textContent = 'No templates match your search.';
      this._list.appendChild(empty);
      return;
    }
    for (const { category, entries } of groups) {
      if (this._category === 'all' && groups.length > 1) {
        const title = document.createElement('div');
        title.className = 'tpl-group-title';
        title.dataset.testid = 'tpl-group-' + category.id;
        title.textContent = category.label;
        this._list.appendChild(title);
      }
      for (const entry of entries) this._list.appendChild(this._row(entry));
    }
  }

  // A selection that a filter or search has hidden must not stay insertable.
  _dropHiddenSelection(groups) {
    if (!this._selected || groups.some(g => g.entries.includes(this._selected))) return;
    this._selected = null;
    this.applyBtn.disabled = true;
    this._detail.hidden = true;
  }

  _row(entry) {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'eg-row' + (entry === this._selected ? ' tpl-row--selected' : '');
    row.dataset.testid = 'tpl-row-' + entry.id;
    const name = document.createElement('div');
    name.className = 'eg-row-name';
    name.textContent = entry.name;
    const desc = document.createElement('div');
    desc.className = 'eg-row-desc';
    desc.textContent = entry.description;
    row.append(name, desc);
    row.addEventListener('click', () => this._select(entry));
    return row;
  }

  _select(entry) {
    this._selected = entry;
    this.applyBtn.disabled = false;
    this._renderRows();
    this._renderDetail(entry);
  }

  _renderDetail(entry) {
    this._detail.hidden = false;
    this._detail.innerHTML = '';
    const line = (label, text, href) => {
      const p = document.createElement('p');
      const b = document.createElement('strong');
      b.textContent = label + ': ';
      p.appendChild(b);
      p.appendChild(document.createTextNode(text));
      if (href && /^https?:\/\//.test(href)) {
        const a = document.createElement('a');
        a.href = href;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.textContent = 'Open';
        p.append(' (', a, ')');
      }
      this._detail.appendChild(p);
    };
    line('Source', entry.source, entry.sourceUrl);
    line('License', entry.license, entry.licenseUrl);
  }
}

export const templatesModal = typeof document !== 'undefined' ? new TemplatesModal() : null;
