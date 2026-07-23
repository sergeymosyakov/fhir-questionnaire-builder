// ── FHIRPath console ──────────────────────────────────────────────────────────
// A dev-console-style block that appears ABOVE the preview when opened from
// ⚙ Settings ▾ → 🧪 FHIRPath tester…. Evaluate a FHIRPath expression against the
// live QuestionnaireResponse (the same runtime the preview uses: _rc.ctx =
// { fp, qr, envVars }). Because it sits above the still-visible form, you can
// edit answers and watch the result update live. The ✕ on the right hides it.
//
// Self-mounts on [data-mount="fhirpath-panel"]; opened via FHIRPATH_TESTER_REQUESTED.
import { _rc } from '../preview/render-ctx.js';
import { AppEvents } from '../events.js';

class FhirpathConsole {
  constructor() {
    this._mount = document.querySelector('[data-mount="fhirpath-panel"]');
    if (!this._mount) return;

    this._build();

    document.addEventListener(AppEvents.FHIRPATH_TESTER_REQUESTED, () => this._toggle());

    this._input.addEventListener('input', () => {
      clearTimeout(this._deb);
      this._deb = setTimeout(() => this._evaluate(), 250);
    });
    document.addEventListener(AppEvents.PREVIEW_RENDER_DONE, () => {
      if (!this._panel.hidden) this._evaluate();
    });
  }

  _build() {
    const p = document.createElement('div');
    p.className = 'fhirpath-console';
    p.hidden = true;
    p.dataset.testid = 'fhirpath-console';

    const head = document.createElement('div');
    head.className = 'fhirpath-console-head';
    const title = document.createElement('span');
    title.className = 'fhirpath-console-title';
    title.textContent = '\uD83E\uDDEA FHIRPath tester';
    this._count = document.createElement('span');
    this._count.className = 'fhirpath-count';
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'fhirpath-close';
    close.dataset.testid = 'fhirpath-close';
    close.textContent = '\u2715';
    close.setAttribute('aria-label', 'Hide FHIRPath tester');
    close.addEventListener('click', () => this._setOpen(false));
    head.append(title, this._count, close);

    this._input = document.createElement('textarea');
    this._input.className = 'fhirpath-input';
    this._input.rows = 2;
    this._input.spellcheck = false;
    this._input.dataset.testid = 'fhirpath-input';
    this._input.setAttribute('aria-label', 'FHIRPath expression');
    this._input.placeholder = "e.g.  %age > 18   \u00b7   %resource.descendants().where(linkId='bmi').answer.valueDecimal";

    this._result = document.createElement('pre');
    this._result.className = 'fhirpath-result';
    this._result.dataset.testid = 'fhirpath-result';

    p.append(head, this._input, this._result);
    this._mount.replaceWith(p);
    this._panel = p;
  }

  _toggle() { this._setOpen(this._panel.hidden); }

  _setOpen(open) {
    this._panel.hidden = !open;
    if (open) { this._evaluate(); this._input.focus(); }
  }

  _evaluate() {
    const expr = this._input.value.trim();
    if (!expr) { this._show('', null, false); return; }
    const ctx = _rc.ctx;
    if (!ctx || !ctx.fp || !ctx.qr) {
      this._show('Preview not ready \u2014 load or build a questionnaire first.', null, true);
      return;
    }
    try {
      const env = { resource: ctx.qr, ...(ctx.envVars || {}) };
      const res = ctx.fp.evaluate(ctx.qr, expr, env);
      this._show(JSON.stringify(res, null, 2), Array.isArray(res) ? res.length : null, false);
    } catch (e) {
      this._show(e?.message ? 'Error: ' + e.message : String(e), null, true);
    }
  }

  _show(text, count, isError) {
    this._result.textContent = text;
    this._result.classList.toggle('fhirpath-result--error', !!isError);
    this._count.textContent = count === null ? '' : `${count} result${count === 1 ? '' : 's'}`;
  }
}

if (typeof document !== 'undefined') {
  const start = () => { if (document.querySelector('[data-mount="fhirpath-panel"]')) new FhirpathConsole(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
}
