// ── Validation Modal UI ───────────────────────────────────────────────────────
// init(elements) — wire DOM nodes once at startup (no string IDs inside this module)
// show(title, issues, mode, { onExport?, onNavigate? }) — render and open the modal
//   mode: 'export' → "Fix first" + "Export anyway" (calls onExport)
//         'import' → "OK" only
//   onNavigate(nodeId) — called when user clicks the ↗ link next to an issue

let _el = null;

export function init(elements) {
  _el = elements;
  _el.closeBtn.addEventListener('click', _close);
  _el.backdrop.addEventListener('click', e => { if (e.target === _el.backdrop) _close(); });
}

export function show(title, issues, mode, { onExport, onNavigate } = {}) {
  _el.headerTitle.textContent = title;
  _renderBody(issues, onNavigate);
  _renderFooter(mode, onExport);
  _el.backdrop.style.display = 'flex';
}

function _close() {
  _el.backdrop.style.display = 'none';
}

function _renderBody(issues, onNavigate) {
  _el.body.innerHTML = '';

  const errors   = issues.filter(i => i.severity === 'error');
  const warnings = issues.filter(i => i.severity === 'warning');

  const summary = document.createElement('div');
  summary.className = 'validate-modal-summary';
  const parts = [];
  if (errors.length)   parts.push(`${errors.length} error${errors.length > 1 ? 's' : ''}`);
  if (warnings.length) parts.push(`${warnings.length} warning${warnings.length > 1 ? 's' : ''}`);
  summary.textContent = `Found ${parts.join(' and ')} in the questionnaire tree.`;
  _el.body.appendChild(summary);

  for (const issue of issues) {
    const row = document.createElement('div');
    row.className = 'validate-issue';

    const badge = document.createElement('span');
    badge.className = `validate-issue-badge validate-badge-${issue.severity}`;
    badge.textContent = issue.severity;
    row.appendChild(badge);

    const content = document.createElement('span');
    content.className = 'validate-issue-content';

    const idTag = document.createElement('span');
    idTag.className = 'validate-issue-id';
    idTag.textContent = issue.nodeId;
    content.appendChild(idTag);
    content.appendChild(document.createTextNode(issue.message));
    row.appendChild(content);

    // Navigate button — only when nodeId is a real linkId and onNavigate provided
    if (onNavigate && issue.nodeId && issue.nodeId !== '(empty)') {
      const navBtn = document.createElement('button');
      navBtn.type = 'button';
      navBtn.className = 'validate-nav-btn';
      navBtn.title = 'Go to node in builder';
      navBtn.textContent = '↗';
      navBtn.addEventListener('click', () => {
        _close();
        onNavigate(issue.nodeId);
      });
      row.appendChild(navBtn);
    }

    _el.body.appendChild(row);
  }
}

function _renderFooter(mode, onExport) {
  _el.footer.innerHTML = '';

  if (mode === 'export') {
    const fixBtn = document.createElement('button');
    fixBtn.type = 'button';
    fixBtn.className = 'btn-fhir';
    fixBtn.textContent = 'Fix first';
    fixBtn.addEventListener('click', _close);

    const exportBtn = document.createElement('button');
    exportBtn.type = 'button';
    exportBtn.className = 'btn-fhir btn-fhir-export';
    exportBtn.textContent = 'Export anyway';
    exportBtn.addEventListener('click', () => { _close(); onExport?.(); });

    _el.footer.appendChild(fixBtn);
    _el.footer.appendChild(exportBtn);
  } else {
    const okBtn = document.createElement('button');
    okBtn.type = 'button';
    okBtn.className = 'btn-fhir btn-fhir-export';
    okBtn.textContent = 'OK';
    okBtn.addEventListener('click', _close);
    _el.footer.appendChild(okBtn);
  }
}

