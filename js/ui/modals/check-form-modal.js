// Settings ▾ → Check my form…: tries generated answers on every calculation and lists results no answers can produce.
// data-testid registry: checkFormModal (backdrop), check-form-summary, check-form-row (data-status), check-form-nav-btn, check-form-report-btn, check-form-progress
import { Modal } from './modal-base.js';
import { AppEvents, EventState } from '../../events.js';
import { buildFHIRObject } from '../../fhir/export.js';
import { checkForm } from '../../fhir/check/reachability.js';
import { showWarn } from '../toast.js';
import { buildReport } from '../../fhir/check/report.js';
import { storeReportPlain, storeReportPacked } from '../../fhir/check/report-storage.js';

const LABEL = {
  unreachable: 'Some results can never appear',
  'no-result': 'Never produces a result',
  skipped: 'Not checked',
  ok: 'All results reachable',
};
const PROBLEMS = new Set(['unreachable', 'no-result', 'never-shown']);

class CheckFormModal extends Modal {
  constructor() {
    super({ cancelLabel: 'Close', applyLabel: null, maxWidth: '720px' });
    this.setTitle('Check my form');
  }

  getName() { return 'checkFormModal'; }

  async open() {
    const run = (this._run = {}); // a repeated request re-runs on the current form; the older run's result is dropped
    const shown = this.backdrop.style.display !== 'none';
    this.body.innerHTML = '';
    const note = this._note('Trying answer combinations…', 'check-form-summary');
    const bar = document.createElement('progress');
    bar.className = 'check-form-progress';
    bar.dataset.testid = 'check-form-progress';
    this.body.appendChild(bar);
    if (!shown) super.open();
    try {
      const questDoc = EventState.get(AppEvents.APP_CONTEXT_READY).questDoc;
      const base = buildFHIRObject();
      const result = await checkForm({ tree: questDoc.tree, base, fp: window.fhirpath, variables: questDoc.variables,
        onProgress: (done, total) => {
          if (this._run !== run) return;
          bar.max = total;
          bar.value = done;
          note.textContent = `Trying answer combinations… ${done} of ${total}`;
        },
      });
      if (this._run === run) {
        this._render(result);
        this._report = null;
        try { this._report = buildReport({ tree: questDoc.tree, result, title: questDoc.meta?.title, questionnaire: base }); } catch { /* the window still shows the verdicts */ }
      }
    } catch (e) {
      if (this._run === run) { this.body.innerHTML = ''; this._note(`The check could not run: ${e.message}`, 'check-form-summary'); }
    }
  }

  close() { this._run = null; super.close(); }

  _note(text, testid) {
    const p = document.createElement('p');
    p.className = 'check-form-note';
    p.dataset.testid = testid;
    p.textContent = text;
    this.body.appendChild(p);
    return p;
  }

  _render({ scenarios, truncated, calcs, unshown = [] }) {
    this._truncated = truncated;
    this.body.innerHTML = '';
    if (!calcs.length && !unshown.length) { this._note('This form has no calculated values to check and no Show When rule that could never be met.', 'check-form-summary'); return; }
    const items = [...calcs, ...unshown.map((u) => ({ ...u, status: 'never-shown' }))];
    const bad = items.filter((c) => PROBLEMS.has(c.status)).length;
    this._note(`${bad ? `${bad} of ${items.length} checks need attention` : `All ${calcs.length} calculations behave as expected`} (${scenarios} answer combinations tried${truncated ? '; a very large form, so not all were' : ''}).`, 'check-form-summary');
    const list = document.createElement('div');
    for (const c of [...items].sort((a, b) => Number(PROBLEMS.has(b.status)) - Number(PROBLEMS.has(a.status)))) list.appendChild(this._row(c));
    this.body.appendChild(list);
    this.body.appendChild(this._reportLink());
  }

  _reportLink() {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'eb-text-toggle';
    btn.dataset.testid = 'check-form-report-btn';
    btn.textContent = 'Open full report (everything that was calculated) →';
    btn.addEventListener('click', async () => {
      if (!this._report) { showWarn('The report could not be built for this form.'); return; }
      if (!storeReportPlain(this._report) && !(await storeReportPacked(this._report))) { // no await before window.open unless the report has to be packed
        showWarn('The report is too large for this browser tab to hand over.');
        return;
      }
      if (!window.open('questionnaire-check.html', '_blank')) showWarn('The browser blocked the new tab. Allow pop-ups for this page and try again.'); // the new tab gets a copy of the stored report as it opens
    });
    return btn;
  }

  _row(c) {
    const row = document.createElement('div');
    row.className = `check-form-row check-form-row--${c.status}`;
    row.dataset.testid = 'check-form-row';
    row.dataset.status = c.status;
    const text = document.createElement('div');
    text.className = 'check-form-text';
    const head = document.createElement('strong');
    head.textContent = c.title;
    const detail = document.createElement('div');
    detail.className = 'check-form-detail';
    detail.textContent = this._detail(c);
    text.append(head, detail);
    const nav = document.createElement('button');
    nav.type = 'button';
    nav.className = 'validate-nav-btn';
    nav.dataset.testid = 'check-form-nav-btn';
    nav.dataset.tipTitle = 'Go to node in builder';
    nav.dataset.tipBody = 'Closes this window and shows it in the builder.';
    nav.setAttribute('aria-label', `Go to ${c.title} in the builder`);
    nav.textContent = '↗';
    nav.addEventListener('click', () => {
      this.close();
      document.dispatchEvent(new CustomEvent(AppEvents.BUILDER_NAVIGATE_TO, { detail: { nodeId: c.id } }));
    });
    row.append(text, nav);
    return row;
  }

  _detail(c) {
    if (c.status === 'unreachable') {
      const maybe = this._truncated ? ' (not every combination was tried)' : '';
      const lines = c.details.map((d) => `“${d.text}” is given when ${d.when}, but no combination of answers makes that happen`);
      const seen = c.reached.length ? ` Results that do appear: ${c.reached.slice(0, 8).map((r) => `“${r}”`).join(', ')}${c.reached.length > 8 ? ', …' : ''}.` : '';
      const sampled = c.sampled?.length ? ` Dates, and numbers without both limits, were tried only in a range (${c.sampled.join(', ')}); a result that needs other values can be missed — for numbers, set the minimum and maximum to check it properly.` : '';
      return `${lines.join('; ')}${maybe}.${seen}${sampled} Check that condition and the ones before it: an earlier condition may already cover every case, or the threshold may be out of range.`;
    }
    if (c.status === 'never-shown') return `Never shown: its Show When rule (${c.when}) is not met by any of the answers tried, so nobody can answer it. Check the rule.`;
    if (c.status === 'no-result') return `No combination of answers gives it a value. Check its formula and the questions it reads.${c.sampled?.length ? ` (Dates, and numbers without both limits, were tried only in a range: ${c.sampled.join(', ')}.)` : ''}`;
    if (c.status === 'skipped') return `${LABEL.skipped}: ${c.reason}.`;
    return `${LABEL.ok}.`;
  }
}

export const checkFormModal = typeof document !== 'undefined' ? new CheckFormModal() : null;

if (typeof document !== 'undefined') {
  document.addEventListener(AppEvents.CHECK_FORM_REQUESTED, () => checkFormModal.open());
}
