// ── Validation Modal UI ───────────────────────────────────────────────────────
// show(title, issues, mode, { onExport?, onNavigate? }) — render and open
//   mode: 'export' → "Fix first" + "Export anyway"
//         'import' → "OK" only
import { Modal } from './modal-base.js';

class ValidateModal extends Modal {
  getName() { return 'validateModal'; }
  constructor() {
    super({ cancelLabel: null, applyLabel: null });
  }

  show(title, issues, mode, { onExport, onNavigate } = {}) {
    this.title.textContent = issues.length === 0 ? 'Validate \u2014 All good' : title;
    this._renderBody(issues, onNavigate);
    this._renderFooter(mode, onExport, issues.length === 0);
    super.open();
  }

  _cancel() { this.close(); }

  _renderBody(issues, onNavigate) {
    this.body.innerHTML = '';

    if (issues.length === 0) {
      const ok = document.createElement('div');
      ok.className = 'validate-ok';
      ok.innerHTML = '<span class="validate-ok-icon">\u2705</span> No errors or warnings found. The questionnaire looks valid.';
      this.body.appendChild(ok);
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
    this.body.appendChild(summary);

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

      if (onNavigate && issue.nodeId && issue.nodeId !== '(empty)') {
        const navBtn = document.createElement('button');
        navBtn.type = 'button';
        navBtn.className = 'validate-nav-btn';
        navBtn.dataset.tipTitle = 'Go to node in builder';
        navBtn.textContent = '\u2197';
        navBtn.addEventListener('click', () => {
          this.close();
          onNavigate(issue.nodeId);
        });
        row.appendChild(navBtn);
      }

      this.body.appendChild(row);
    }
  }

  _renderFooter(mode, onExport, allGood = false) {
    this.footer.innerHTML = '';

    if (allGood) {
      const okBtn = document.createElement('button');
      okBtn.type = 'button';
      okBtn.className = 'btn-fhir btn-fhir-export';
      okBtn.textContent = 'Great!';
      okBtn.addEventListener('click', () => this.close());
      this.footer.appendChild(okBtn);
      return;
    }

    if (mode === 'export') {
      const fixBtn = document.createElement('button');
      fixBtn.type = 'button';
      fixBtn.className = 'btn-fhir';
      fixBtn.textContent = 'Fix first';
      fixBtn.addEventListener('click', () => this.close());

      const exportBtn = document.createElement('button');
      exportBtn.type = 'button';
      exportBtn.className = 'btn-fhir btn-fhir-export';
      exportBtn.textContent = 'Export anyway';
      exportBtn.addEventListener('click', () => { this.close(); onExport?.(); });

      this.footer.append(fixBtn, exportBtn);
    } else {
      const okBtn = document.createElement('button');
      okBtn.type = 'button';
      okBtn.className = 'btn-fhir btn-fhir-export';
      okBtn.textContent = 'OK';
      okBtn.addEventListener('click', () => this.close());
      this.footer.appendChild(okBtn);
    }
  }
}

const _modal = new ValidateModal();
export const show = (title, issues, mode, opts) => _modal.show(title, issues, mode, opts);
