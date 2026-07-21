import { AnswerTypeSection } from '../base-section.js';
import { ANSWER_TYPE_SECTIONS } from '../registry.js';
import { createCustomSelect } from '../../../custom-select.js';
import { BUILDER_UNITS } from '../data.js';
import { UCUM_URL } from '../../../../fhir/urls/ucum.js';
import { EXAMPLE_URL } from '../../../../fhir/urls/examples.js';

class UnitSection extends AnswerTypeSection {
  isVisible(type) { return type === 'quantity'; }

  build(pending) {
    const section = document.createElement('div');
    section.className = 'at-modal-sub';

    // ── Default unit (fixed) ──────────────────────────────────────────────────
    const unitLbl = document.createElement('div');
    unitLbl.className        = 'at-modal-sub-lbl';
    unitLbl.textContent      = 'Default unit:';
    unitLbl.dataset.tipTitle = 'Quantity unit';
    unitLbl.dataset.tipBody  = 'Default UCUM unit code for this measurement field. Shown next to the numeric input in the preview.';
    unitLbl.dataset.tipFhir  = 'item.extension[questionnaire-unit].valueCoding.code';
    unitLbl.dataset.tipSpec  = 'R4';

    const unitSel = createCustomSelect({
      items: [
        { value: '', label: '\u2014 none \u2014' },
        ...BUILDER_UNITS.map(u => ({ value: u, label: u })),
      ],
      value:     pending.draftUnit || '',
      className: 'at-modal-sub-sel sc-trigger--full',
      testid:    'unit-sel',
      onChange:  v => { pending.draftUnit = v; },
    });

    // ── Unit ValueSet URL ─────────────────────────────────────────────────────
    const vsLbl = document.createElement('div');
    vsLbl.className        = 'at-modal-sub-lbl';
    vsLbl.textContent      = 'Unit ValueSet URL:';
    vsLbl.dataset.tipTitle = 'questionnaire-unitValueSet';
    vsLbl.dataset.tipBody  = 'Canonical URL of a ValueSet containing selectable UCUM units. When set, a unit dropdown is rendered next to the number input. Overrides "Default unit" in the preview.';
    vsLbl.dataset.tipFhir  = 'item.extension[questionnaire-unitValueSet].valueCanonical';
    vsLbl.dataset.tipSpec  = 'R4';

    const vsInp = document.createElement('textarea');
    vsInp.rows             = 1;
    vsInp.className        = 'at-modal-sub-inp';
    vsInp.placeholder      = EXAMPLE_URL.unitValueSet;
    vsInp.dataset.testid   = 'unit-valueset-url';
    vsInp.value            = pending.draftUnitValueSet || '';
    vsInp.oninput = () => { pending.draftUnitValueSet = vsInp.value.trim(); };

    // ── Unit Options (explicit selectable units) ──────────────────────────────
    const uoLbl = document.createElement('div');
    uoLbl.className        = 'at-modal-sub-lbl at-modal-sub-lbl--tip';
    uoLbl.textContent      = 'Unit options (explicit list):';
    uoLbl.dataset.tipTitle = 'questionnaire-unitOption';
    uoLbl.dataset.tipBody  = 'Explicit list of selectable UCUM units. Each entry has system, code, and display. When set, only these units appear in the dropdown (overrides the default UCUM list). Mutually exclusive with Unit ValueSet URL.';
    uoLbl.dataset.tipFhir  = 'item.extension[questionnaire-unitOption].valueCoding';
    uoLbl.dataset.tipSpec  = 'R4';

    const uoList = document.createElement('div');
    uoList.className = 'cc-list';
    uoList.dataset.testid = 'unit-options-list';

    const _renderUoRows = () => {
      uoList.innerHTML = '';
      const opts = pending.draftUnitOptions || [];
      if (!opts.length) {
        const empty = document.createElement('div');
        empty.className = 'cc-empty';
        empty.textContent = 'No unit options defined (using default UCUM list)';
        uoList.appendChild(empty);
        return;
      }
      for (let i = 0; i < opts.length; i++) {
        uoList.appendChild(_buildUoRow(opts, i, pending, _renderUoRows));
      }
    };
    _renderUoRows();

    const uoAddBtn = document.createElement('button');
    uoAddBtn.type = 'button';
    uoAddBtn.className = 'modal-btn modal-btn--sm';
    uoAddBtn.textContent = '+ Add unit';
    uoAddBtn.dataset.testid = 'uo-add-btn';
    uoAddBtn.onclick = () => {
      if (!pending.draftUnitOptions) pending.draftUnitOptions = [];
      pending.draftUnitOptions.push({ system: UCUM_URL.system, code: '', display: '' });
      _renderUoRows();
    };

    section.append(unitLbl, unitSel.el, vsLbl, vsInp, uoLbl, uoList, uoAddBtn);
    return section;
  }

  commit(pending, node, _questDoc, _answerStore) {
    node.quantityUnit = (node.itemType === 'quantity' && pending.draftUnit) ? pending.draftUnit : undefined;
    if (node.itemType === 'quantity' && pending.draftUnitValueSet)
      node._unitValueSet = pending.draftUnitValueSet;
    else
      delete node._unitValueSet;
    // Unit options (explicit list) — derive code from display when blank (prevents
    // silent drop of rows where the user fills only the display name).
    const uopts = (pending.draftUnitOptions || [])
      .map(u => ({ ...u, code: u.code.trim() || u.display.trim(), display: u.display.trim() || u.code.trim() }))
      .filter(u => u.code);
    node._unitOptions = uopts.length ? uopts.map(u => ({
      system: u.system.trim() || undefined,
      code: u.code,
      display: u.display || undefined,
    })) : undefined;
  }

  initPending(node) {
    return {
      draftUnit: node.quantityUnit || '',
      draftUnitValueSet: node._unitValueSet || '',
      draftUnitOptions: node._unitOptions ? node._unitOptions.map(u => ({ ...u })) : [],
    };
  }
}

function _buildUoRow(opts, idx, pending, rerender) {
  const u = opts[idx];
  const row = document.createElement('div');
  row.className = 'cc-row';
  row.dataset.testid = 'uo-row';

  const codeIn = document.createElement('input');
  codeIn.type = 'text';
  codeIn.className = 'cc-input';
  codeIn.placeholder = 'Code (e.g. kg)';
  codeIn.value = u.code || '';
  codeIn.dataset.testid = 'uo-code';
  codeIn.oninput = () => { u.code = codeIn.value; };

  const dispIn = document.createElement('input');
  dispIn.type = 'text';
  dispIn.className = 'cc-input';
  dispIn.placeholder = 'Display (e.g. Kilograms)';
  dispIn.value = u.display || '';
  dispIn.dataset.testid = 'uo-display';
  dispIn.oninput = () => { u.display = dispIn.value; };

  const sysIn = document.createElement('input');
  sysIn.type = 'text';
  sysIn.className = 'cc-input';
  sysIn.placeholder = 'System';
  sysIn.value = u.system || '';
  sysIn.dataset.testid = 'uo-system';
  sysIn.oninput = () => { u.system = sysIn.value; };

  const delBtn = document.createElement('button');
  delBtn.type = 'button';
  delBtn.className = 'cc-del-btn';
  delBtn.textContent = '\u00D7';
  delBtn.dataset.testid = 'uo-del-btn';
  delBtn.onclick = () => {
    pending.draftUnitOptions.splice(idx, 1);
    rerender();
  };

  row.append(codeIn, dispIn, sysIn, delBtn);
  return row;
}

ANSWER_TYPE_SECTIONS.push(new UnitSection());
