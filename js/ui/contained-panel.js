// ── Contained Resources panel ─────────────────────────────────────────────────
// Collapsible read-only card showing Questionnaire.contained[] items.
// Each chip opens a read-only JSON viewer modal.
// init(elements, containedArray, showJsonFn) — wire DOM once at startup.
// refresh() — re-render chips and update card visibility.

let _el        = null;
let _contained = null;
let _collapsed = false;

export function init(elements, containedArray) {
  _el        = elements;
  _contained = containedArray;
  _el.toggle.addEventListener('click', _toggleCollapse);
  document.addEventListener('questionnaire-loaded', refresh);
  document.addEventListener('questionnaire-cleared', refresh);
  refresh();
}

export function refresh() {
  const count = _contained.length;
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
  for (const resource of _contained) {
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
