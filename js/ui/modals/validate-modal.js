// ── Validation Modal UI ───────────────────────────────────────────────────────
// show(title, mode, { questJson, tree, values, onExport? }) — open and run validators
//   mode: 'export' → "Fix first" + "Export anyway"
//         'import' → "OK" only
//
// Which validators run is controlled by Modal._svc:
//   shouldRunLocal    — () => boolean  (default true)  — run local validators
//   shouldRunExternal — () => boolean  (default false) — run server validators
//
// Each validator gets its own section with a loading spinner → results or error.
import { Modal } from './modal-base.js';
import { AppEvents } from '../../events.js';
import { validatorRegistry } from '../../fhir/validators/registry.js';

class ValidateModal extends Modal {
  getName() { return 'validateModal'; }
  constructor() {
    super({ cancelLabel: null, applyLabel: null });
    this._onExport = null;
  }

  /**
   * @param {string} title
   * @param {'export'|'import'} mode
   * @param {{ questJson?, tree?, values?, onExport? }} opts
   */
  show(title, mode, { questJson = null, tree = [], values = {}, onExport = null, extraIssues = [] } = {}) {
    this._onExport = onExport;
    this.title.textContent = title;
    this.body.innerHTML = '';
    this.footer.innerHTML = '';

    // Filter validators based on prefs: external validators only run if enabled
    const runExternal = Modal._svc.shouldRunExternal?.() ?? false;
    const validators = validatorRegistry.getAll()
      .filter(v => v.type !== 'external' || runExternal);

    if (validators.length === 0 && extraIssues.length === 0) {
      this._renderEmpty();
      this._renderFooter(mode, false);
      super.open();
      return;
    }

    // Create one section per validator — show spinner immediately, fill in results
    const sectionEls = validators.map(v => this._renderSection(v.name, v.type));

    // Render extraIssues (e.g. QR-specific warnings) as an inline section
    if (extraIssues.length > 0) {
      const extraSection = this._renderSection('Response check', 'local');
      const spinner = extraSection.querySelector('[data-role="spinner"]');
      if (spinner) spinner.remove();
      this._fillSection(extraSection, extraIssues, null);
    }

    this._renderFooter(mode, null /* unknown yet */);
    super.open();

    // Run all in parallel, update each section as it resolves
    let hasErrors = false;
    let hasIssues = false;
    let done = 0;
    validators.forEach((v, i) => {
      v.run(questJson, tree, values)
        .then(issues => {
          if (issues.length > 0) hasIssues = true;
          if (issues.some(i => i.severity === 'error')) hasErrors = true;
          this._fillSection(sectionEls[i], issues, null);
        })
        .catch(err => {
          this._fillSection(sectionEls[i], [], err);
        })
        .finally(() => {
          done++;
          if (done === validators.length) this._updateFooter(mode, hasErrors, hasIssues);
        });
    });
  }

  _cancel() { this.close(); }

  // ── Section helpers ─────────────────────────────────────────────────────────

  _renderSection(name, type) {
    const section = document.createElement('div');
    section.className = 'validate-section';

    const header = document.createElement('div');
    header.className = 'validate-section-header';

    const nameEl = document.createElement('span');
    nameEl.className = 'validate-section-name';
    nameEl.textContent = name;

    const badge = document.createElement('span');
    badge.className = `validate-section-type validate-section-type--${type}`;
    badge.textContent = type;

    const spinner = document.createElement('span');
    spinner.className = 'validate-spinner';
    spinner.dataset.role = 'spinner';

    header.append(nameEl, badge, spinner);
    section.appendChild(header);

    const body = document.createElement('div');
    body.className = 'validate-section-body';
    body.dataset.role = 'body';
    section.appendChild(body);

    this.body.appendChild(section);
    return section;
  }

  _fillSection(section, issues, error) {
    const spinner = section.querySelector('[data-role="spinner"]');
    const body    = section.querySelector('[data-role="body"]');
    if (spinner) spinner.remove();

    body.innerHTML = '';

    if (error) {
      const errEl = document.createElement('div');
      errEl.className = 'validate-ext-error';
      errEl.textContent = `⚠ ${error.message || error}`;
      body.appendChild(errEl);
      return;
    }

    if (issues.length === 0) {
      const ok = document.createElement('div');
      ok.className = 'validate-ok';
      ok.innerHTML = '<span class="validate-ok-icon">✅</span> No issues found.';
      body.appendChild(ok);
      return;
    }

    const errors   = issues.filter(i => i.severity === 'error');
    const warnings = issues.filter(i => i.severity === 'warning');
    const parts = [];
    if (errors.length)   parts.push(`${errors.length} error${errors.length > 1 ? 's' : ''}`);
    if (warnings.length) parts.push(`${warnings.length} warning${warnings.length > 1 ? 's' : ''}`);
    const summary = document.createElement('div');
    summary.className = 'validate-modal-summary';
    summary.textContent = `Found ${parts.join(' and ')}.`;
    body.appendChild(summary);

    for (const issue of issues) {
      body.appendChild(this._renderIssueRow(issue));
    }
  }

  _renderIssueRow(issue) {
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

    if (issue.nodeId && issue.nodeId !== '(empty)' && issue.nodeId !== '(external)') {
      const navBtn = document.createElement('button');
      navBtn.type = 'button';
      navBtn.className = 'validate-nav-btn';
      navBtn.dataset.tipTitle = 'Go to node in builder';
      navBtn.textContent = '↗';
      navBtn.addEventListener('click', () => {
        this.close();
        document.dispatchEvent(new CustomEvent(AppEvents.BUILDER_NAVIGATE_TO, { detail: { nodeId: issue.nodeId } }));
      });
      row.appendChild(navBtn);
    }

    return row;
  }

  _renderEmpty() {
    const ok = document.createElement('div');
    ok.className = 'validate-ok';
    ok.innerHTML = '<span class="validate-ok-icon">✅</span> No validators configured.';
    this.body.appendChild(ok);
  }

  // ── Footer ──────────────────────────────────────────────────────────────────

  _renderFooter(mode, hasErrors, hasIssues = hasErrors) {
    this.footer.innerHTML = '';
    this.footer.dataset.mode = mode;

    if (hasErrors === null) {
      // Still loading — show disabled placeholder
      const loading = document.createElement('span');
      loading.className = 'validate-footer-loading';
      loading.textContent = 'Validating…';
      this.footer.appendChild(loading);
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
      exportBtn.textContent = hasIssues ? 'Export anyway' : 'Export';
      exportBtn.addEventListener('click', () => { this.close(); this._onExport?.(); });

      this.footer.append(fixBtn, exportBtn);
    } else {
      const okBtn = document.createElement('button');
      okBtn.type = 'button';
      okBtn.className = 'btn-fhir btn-fhir-export';
      okBtn.textContent = hasErrors ? 'OK' : 'Great!';
      okBtn.addEventListener('click', () => this.close());
      this.footer.appendChild(okBtn);
    }
  }

  _updateFooter(mode, hasErrors, hasIssues = hasErrors) {
    if ((mode === 'validate' || mode === 'import') && !hasErrors) {
      // Append "— All good" to whatever title was passed
      this.title.textContent = this.title.textContent.replace(/\s*—.*$/, '') + ' — All good';
    }
    this._renderFooter(mode, hasErrors, hasIssues);
  }
}

const _modal = new ValidateModal();

/**
 * @param {string} title
 * @param {'export'|'import'} mode
 * @param {{ questJson?, tree?, values?, onExport? }} opts
 */
export const show = (title, mode, opts) => _modal.show(title, mode, opts);
