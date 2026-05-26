// ── Constraint edit modal ─────────────────────────────────────────────────────
import { MODAL_REGISTRY } from './modal-registry.js';
import { Modal } from './modal-base.js';
import * as explainModal from './explain-modal.js';
import { createCustomSelect } from '../custom-select.js';

class ConstraintModal extends Modal {
  constructor() {
    super();
    this._pending = null;
    MODAL_REGISTRY.set('constraint', this);
  }

  open(node, constraintLink, setActive) {
    if (!Array.isArray(node.constraint)) node.constraint = [];
    const draft = JSON.parse(JSON.stringify(node.constraint));
    this._pending = { node, constraintLink, setActive, draft };
    this.setTitle('Constraints', node.title || node.id || 'Item');
    this.body.innerHTML = '';
    this._renderBody(draft);
    super.open();
  }

  _apply() {
    if (!this._pending) return;
    const { node, draft, constraintLink, setActive } = this._pending;
    node.constraint = draft;
    setActive(constraintLink, draft.length > 0);
    Modal._svc.triggerCalcRecalc();
    this._cancel();
  }

  _cancel() {
    this._pending = null;
    this.close();
  }

  _renderBody(draft) {
    const container = this.body;
    container.innerHTML = '';

    if (draft.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'constraint-empty-msg';
      empty.textContent = 'No constraints. Add one below.';
      container.appendChild(empty);
    }

    draft.forEach((c, idx) => {
      const card = document.createElement('div');
      card.className = 'constraint-card';

      const hdr = document.createElement('div');
      hdr.className = 'constraint-card-hdr';

      const keyLbl = document.createElement('span');
      keyLbl.className   = 'constraint-key';
      keyLbl.textContent = c.key || '(no key)';
      hdr.appendChild(keyLbl);

      const sevSel = createCustomSelect({
        items: [{ value: 'error', label: 'error \u274C' }, { value: 'warning', label: 'warning \u26A0\uFE0F' }],
        value: c.severity || 'error',
        className: 'constraint-sev-sel sc-trigger--sm',
        onChange: v => { c.severity = v; },
      });
      hdr.appendChild(sevSel.el);

      const rmBtn = document.createElement('button');
      rmBtn.type = 'button'; rmBtn.className = 'vis-cond-rm'; rmBtn.textContent = '\u2715';
      rmBtn.onclick = () => { draft.splice(idx, 1); this._renderBody(draft); };
      hdr.appendChild(rmBtn);
      sevSel.el.dataset.tipTitle = 'Constraint severity';
      sevSel.el.dataset.tipBody  = '"error" prevents a valid QuestionnaireResponse submission; "warning" allows submission but shows a caution badge.';
      sevSel.el.dataset.tipFhir  = 'questionnaire-constraint.extension[severity].valueCode';
      sevSel.el.dataset.tipSpec  = 'R4';
      card.appendChild(hdr);

      const keyInp = document.createElement('input');
      keyInp.type = 'text'; keyInp.className = 'panel-inp-sm constraint-inp';
      keyInp.placeholder = 'key (e.g. consent-required)';
      keyInp.value = c.key || '';
      keyInp.oninput = () => { c.key = keyInp.value; keyLbl.textContent = keyInp.value || '(no key)'; };
      card.appendChild(_lbl('Key:', keyInp, { title: 'Constraint key', body: 'Unique identifier for this constraint. Used in validation messages and the questionnaire-constraint-check FHIRPath evaluator.', fhir: 'questionnaire-constraint.extension[key].valueId', spec: 'R4' }));

      const humanInp = document.createElement('input');
      humanInp.type = 'text'; humanInp.className = 'panel-inp-sm constraint-inp';
      humanInp.placeholder = 'Human-readable message';
      humanInp.value = c.human || '';
      humanInp.oninput = () => { c.human = humanInp.value; };
      card.appendChild(_lbl('Message:', humanInp, { title: 'Human-readable message', body: 'Error message shown to the user when the constraint expression evaluates to false.', fhir: 'questionnaire-constraint.extension[human].valueString', spec: 'R4' }));

      const exprInp = document.createElement('textarea');
      exprInp.rows = 3;
      exprInp.className = 'expr-textarea';
      exprInp.placeholder = 'FHIRPath expression (must return true to pass)';
      exprInp.value = c.expression || '';
      const _resize = () => { exprInp.style.height = 'auto'; exprInp.style.height = exprInp.scrollHeight + 'px'; };
      exprInp.addEventListener('input', _resize);
      setTimeout(_resize, 0);
      exprInp.oninput = () => { c.expression = exprInp.value; };

      const explainBtn = document.createElement('button');
      explainBtn.type = 'button';
      explainBtn.className = 'expr-explain-btn';
      explainBtn.textContent = 'Explain';
      explainBtn.dataset.tipTitle = 'Evaluate expression';
      explainBtn.dataset.tipBody  = 'Evaluate the FHIRPath expression and show the result tree';
      explainBtn.onclick = () => {
        const fp = window.fhirpath;
        const { qr, env } = Modal._svc.getLastCtx();
        if (fp && exprInp.value.trim()) explainModal.show(exprInp.value.trim(), fp, qr, env);
      };

      const exprWrap = document.createElement('div');
      exprWrap.className = 'constraint-expr-wrap';
      exprWrap.append(exprInp, explainBtn);
      card.appendChild(_lbl('Expression:', exprWrap, { title: 'Constraint FHIRPath expression', body: 'Must evaluate to true to pass validation. Use %resource and %questionnaire to access answers.', fhir: 'questionnaire-constraint.extension[expression].valueString', spec: 'R4' }));

      container.appendChild(card);
    });

    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'vis-add-btn vis-add-btn--mt';
    addBtn.textContent = '+ Add constraint';
    addBtn.onclick = () => {
      draft.push({ key: '', severity: 'error', human: '', expression: '' });
      this._renderBody(draft);
    };
    container.appendChild(addBtn);
  }
}

function _lbl(text, input, tip = null) {
  const row = document.createElement('div');
  row.className = 'constraint-field-row';
  const lbl = document.createElement('label');
  lbl.className   = 'constraint-field-lbl';
  lbl.textContent = text;
  if (tip) {
    lbl.dataset.tipTitle = tip.title;
    if (tip.body) lbl.dataset.tipBody = tip.body;
    if (tip.fhir) lbl.dataset.tipFhir = tip.fhir;
    if (tip.spec) lbl.dataset.tipSpec = tip.spec;
  }
  row.append(lbl, input);
  return row;
}

new ConstraintModal();
