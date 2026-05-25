// ── Answer ValueSet panel ─────────────────────────────────────────────────────
// Collapsible read-only card showing all answerValueSet URLs referenced by items.
// Each chip opens a read-only JSON viewer with the URL and which items use it.
// init(elements, treeRef, showJsonFn) — wire DOM once at startup.
// refresh() — walk tree, collect unique URLs, re-render chips.

let _el       = null;
let _tree     = null;
let _collapsed = false;

export function init(elements, treeRef) {
  _el       = elements;
  _tree     = treeRef;
  _el.toggle.addEventListener('click', _toggleCollapse);
  document.addEventListener('questionnaire-loaded', refresh);
  document.addEventListener('questionnaire-cleared', refresh);
  refresh();
}

export function refresh() {
  const urlMap = _collectUrls(_tree);
  const count  = urlMap.size;
  _el.card.style.display  = count > 0 ? '' : 'none';
  _el.count.textContent   = count > 0 ? String(count) : '';
  _el.count.style.display = count > 0 ? '' : 'none';
  _renderChips(urlMap);
}

// ── Internal ──────────────────────────────────────────────────────────────────

function _collectUrls(nodes, map = new Map()) {
  for (const node of nodes) {
    if (node._answerValueSet) {
      if (!map.has(node._answerValueSet)) map.set(node._answerValueSet, []);
      map.get(node._answerValueSet).push(node.id);
    }
    if (node.children) _collectUrls(node.children, map);
  }
  return map;
}

function _toggleCollapse() {
  _collapsed = !_collapsed;
  _el.toggle.setAttribute('aria-expanded', String(!_collapsed));
  _el.chipList.style.display = _collapsed ? 'none' : '';
  _el.toggle.classList.toggle('fhir-res-card-toggle--collapsed', _collapsed);
}

function _renderChips(urlMap) {
  _el.chipList.innerHTML = '';
  for (const [url, items] of urlMap) {
    // Label: last meaningful path segment
    const label = url.split('/').filter(Boolean).pop() || url;

    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'fhir-res-chip fhir-res-chip--avs';
    chip.textContent = label;
    chip.title = url;
    chip.addEventListener('click', () =>
      document.dispatchEvent(new CustomEvent('show-json', { detail: { title: label, data: { answerValueSet: url, usedByItems: items } } }))
    );
    _el.chipList.appendChild(chip);
  }
}
