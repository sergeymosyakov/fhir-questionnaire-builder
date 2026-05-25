// ── Validation Modal UI ───────────────────────────────────────────────────────
// init(elements) — wire DOM nodes once at startup (no string IDs inside this module)
// show(title, issues, mode, { onExport?, onNavigate? }) — render and open the modal
//   mode: 'export' → "Fix first" + "Export anyway" (calls onExport)
//         'import' → "OK" only
//   onNavigate(nodeId) — called when user clicks the ↗ link next to an issue

import { initModal, openModal, closeModal } from './modal-base.js';

let _el = null;

export function init(elements) {
  _el = elements;
  initModal(elements, { onCancel: _close });
}

export function show(title, issues, mode, { onExport, onNavigate } = {}) {
  _el.title.textContent = issues.length === 0 ? 'Validate — All good' : title;
  _renderBody(issues, onNavigate);
  _renderFooter(mode, onExport, issues.length === 0);
  openModal(_el.modal);
}

function _close() {
  closeModal(_el.modal);
}

function _renderBody(issues, onNavigate) {
  _el.body.innerHTML = '';

  if (issues.length === 0) {
    const ok = document.createElement('div');
    ok.className = 'validate-ok';
    ok.innerHTML = '<span class="validate-ok-icon">✅</span> No errors or warnings found. The questionnaire looks valid.';
    _el.body.appendChild(ok);
    return;
  }

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
      navBtn.dataset.tipTitle = 'Go to node in builder';
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

function _renderFooter(mode, onExport, allGood = false) {
  _el.footer.innerHTML = '';

  if (allGood) {
    const okBtn = document.createElement('button');
    okBtn.type = 'button';
    okBtn.className = 'btn-fhir btn-fhir-export';
    okBtn.textContent = 'Great!';
    okBtn.addEventListener('click', _close);
    _el.footer.appendChild(okBtn);
    return;
  }

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

