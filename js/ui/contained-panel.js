// ── Contained Resources panel ─────────────────────────────────────────────────
// Collapsible read-only card showing Questionnaire.contained[] items.
// Each chip opens a read-only JSON viewer modal.
// configure({questContained}) — call once at startup; then refresh() on events.

let _questContained = null;
export function configure({ questContained }) {
  _questContained = questContained;
  refresh();
}

let _collapsed = false;

const _el = {
  card:     document.getElementById('containedCard'),
  toggle:   document.getElementById('containedCardToggle'),
  chipList: document.getElementById('containedCardChips'),
  count:    document.getElementById('containedCardCount'),
};

_el.toggle.addEventListener('click', _toggleCollapse);
document.addEventListener('questionnaire-loaded', refresh);
document.addEventListener('questionnaire-cleared', refresh);

export function refresh() {
  if (!_questContained) return;
  const count = _questContained.length;
  _el.card.style.display = count > 0 ? '' : 'none';
  _el.count.textContent  = count > 0 ? String(count) : '';
  _el.count.style.display = count > 0 ? '' : 'none';
  _renderChips();
}

function _toggleCollapse() {
  _collapsed = !_collapsed;
  _el.toggle.setAttribute('aria-expanded', String(!_collapsed));
  _el.chipList.style.display = _collapsed ? 'none' : '';
  _el.toggle.classList.toggle('fhir-res-card-toggle--collapsed', _collapsed);
}

function _renderChips() {
  _el.chipList.innerHTML = '';
  for (const resource of _questContained) {
    const rType = resource.resourceType || 'Resource';
    const rId   = resource.id           || '';
    const label = rId ? `${rType}/${rId}` : rType;

    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'fhir-res-chip fhir-res-chip--contained';
    chip.textContent = label;
    chip.dataset.tipTitle = 'View JSON';
    chip.addEventListener('click', () => {
      document.dispatchEvent(new CustomEvent('show-json', { detail: { title: label, data: resource } }));
    });
    _el.chipList.appendChild(chip);
  }
}
