// ── Templates modal ───────────────────────────────────────────────────────────
// Search the template library, pick one, hand its catalog entry to the opener.
import { MODAL_REGISTRY } from './modal-registry.js';
import { Modal } from './modal-base.js';
import { loadTemplateLibrary } from '../../fhir/templates.js';

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
    this._list = document.createElement('div');
    this._list.className = 'eg-list';
    this._list.dataset.testid = 'tpl-list';
    this._detail = document.createElement('div');
    this._detail.className = 'tpl-detail';
    this._detail.dataset.testid = 'tpl-detail';
    this._detail.hidden = true;
    this.body.append(search, this._list, this._detail);
    this._renderRows();
  }

  _matches() {
    const q = this._query.trim().toLowerCase();
    if (!q) return this._entries;
    return this._entries.filter(e =>
      [e.name, e.description, ...(e.keywords ?? [])].some(s => s.toLowerCase().includes(q)));
  }

  _renderRows() {
    this._list.innerHTML = '';
    const matches = this._matches();
    if (!matches.length) {
      const empty = document.createElement('div');
      empty.className = 'eg-note';
      empty.dataset.testid = 'tpl-empty';
      empty.textContent = 'No templates match your search.';
      this._list.appendChild(empty);
      return;
    }
    for (const entry of matches) {
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
      this._list.appendChild(row);
    }
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
