import { AnswerTypeSection } from '../base-section.js';
import { ANSWER_TYPE_SECTIONS } from '../registry.js';
import { resolveContainedValueSet } from '../../../../fhir/import.js';
import { createCustomSelect } from '../../../custom-select.js';
import { Modal } from '../../modal-base.js';
import { CHOICE_TYPES } from '../data.js';
import { parseOptions } from '../../../../utils.js';
import { createOptionsEditor } from '../../../answer-options-editor.js';
import { terminologyService } from '../../../../fhir/terminology-service.js';

function _buildRows(node) {
  const ords    = node._optionOrdinals || {};
  const prefixes = node._optionPrefixes || {};
  return parseOptions(node.options || '').map(({ code, display }) => ({
    code,
    label:  display,
    score:  ords[code] !== undefined ? String(ords[code]) : '',
    prefix: prefixes[code] || '',
  }));
}

class ChoiceSection extends AnswerTypeSection {
  isVisible(type) { return CHOICE_TYPES.has(type); }

  onTypeChange(type) {
    if (this._pending) this._pending.draftType = type;
    if (this._openLabelEl) {
      this._openLabelEl.style.display = type === 'open-choice' ? '' : 'none';
    }
    if (this._acRowEl) {
      this._acRowEl.style.display = type === 'select' ? '' : 'none';
    }
    if (this._lookupRowEl) {
      const p = this._pending;
      const isExtVS = p?.draftSrc === 'valueset' && p?.draftAVS && !p.draftAVS.startsWith('#');
      this._lookupRowEl.style.display = (type === 'select' && !!isExtVS) ? '' : 'none';
    }
  }

  build(pending) {
    this._pending = pending;
    const section = document.createElement('div');

    // ── Answer source toggle ─────────────────────────────────────────────────
    const sourceRow = document.createElement('div');
    sourceRow.className = 'at-modal-source-row';

    const optRadio  = Object.assign(document.createElement('input'), { type: 'radio', name: '_at_src', id: '_at_src_opt',  value: 'options',     checked: pending.draftSrc === 'options' });
    const avsRadio  = Object.assign(document.createElement('input'), { type: 'radio', name: '_at_src', id: '_at_src_avs',  value: 'valueset',    checked: pending.draftSrc === 'valueset' });
    const exprRadio = Object.assign(document.createElement('input'), { type: 'radio', name: '_at_src', id: '_at_src_expr', value: 'expression',  checked: pending.draftSrc === 'expression' });
    const optLbl    = Object.assign(document.createElement('label'), { htmlFor: '_at_src_opt',  textContent: 'Options list',               className: 'at-modal-src-lbl' });
    const avsLbl    = Object.assign(document.createElement('label'), { htmlFor: '_at_src_avs',  textContent: 'ValueSet (answerValueSet)',   className: 'at-modal-src-lbl' });
    const exprLbl   = Object.assign(document.createElement('label'), { htmlFor: '_at_src_expr', textContent: 'Expression (answerExpression)', className: 'at-modal-src-lbl' });

    sourceRow.append(optRadio, optLbl, avsRadio, avsLbl, exprRadio, exprLbl);
    section.appendChild(sourceRow);

    // ── Options sub-section ──────────────────────────────────────────────────
    const optSection = document.createElement('div');
    optSection.className     = 'at-modal-sub';
    optSection.style.display = pending.draftSrc === 'options' ? 'block' : 'none';

    const optSubLbl = document.createElement('div');
    optSubLbl.className        = 'at-modal-sub-lbl';
    optSubLbl.textContent      = 'Answer options:';
    optSubLbl.dataset.tipTitle = 'Answer options';
    optSubLbl.dataset.tipBody  = 'Coded answer choices. Code and Label are required. Score (ordinal value) and Prefix are optional. Exported as item.answerOption[].';
    optSubLbl.dataset.tipFhir  = 'Questionnaire.item.answerOption[].valueCoding';
    optSubLbl.dataset.tipSpec  = 'R4';

    const optEditor = createOptionsEditor({
      rows:         pending.draftOptionRows,
      testidPrefix: 'opt',
      onchange:     rows => { pending.draftOptionRows = rows; },
    });

    optSection.append(optSubLbl, optEditor.el);
    section.appendChild(optSection);

    // ── ValueSet sub-section ─────────────────────────────────────────────────
    const avsSection = document.createElement('div');
    avsSection.className     = 'at-modal-sub';
    avsSection.style.display = pending.draftSrc === 'valueset' ? 'block' : 'none';

    const avsSubLbl = document.createElement('div');
    avsSubLbl.className        = 'at-modal-sub-lbl';
    avsSubLbl.textContent      = 'ValueSet \u2014 select from contained[] or enter an external URL:';
    avsSubLbl.dataset.tipTitle = 'Answer ValueSet';
    avsSubLbl.dataset.tipBody  = 'Links coded answers to a FHIR ValueSet. Use a #id to reference a local contained[] ValueSet, or a full URL for an external terminology server.';
    avsSubLbl.dataset.tipFhir  = 'Questionnaire.item.answerValueSet';
    avsSubLbl.dataset.tipSpec  = 'R4';

    const containedVS = [...Modal._svc.questContained].filter(r => r.resourceType === 'ValueSet');
    const avsItems = [
      { value: '', label: '\u2014 none \u2014' },
      ...containedVS.map(vs => ({ value: '#' + vs.id, label: '#' + vs.id + (vs.title ? ' \u2014 ' + vs.title : '') })),
      { value: '__ext__', label: '\u2014 external URL \u2014' },
    ];
    const isExternalAVS = !!pending.draftAVS && !pending.draftAVS.startsWith('#');
    const avsInitVal    = isExternalAVS ? '__ext__' : (pending.draftAVS || '');

    const avsUrlInp = document.createElement('input');
    avsUrlInp.type           = 'text';
    avsUrlInp.className      = 'at-modal-avs-url';
    avsUrlInp.dataset.testid = 'avs-url-input';
    avsUrlInp.value          = isExternalAVS ? pending.draftAVS : '';
    avsUrlInp.placeholder    = 'http://terminology.hl7.org/ValueSet/...';
    avsUrlInp.style.display  = isExternalAVS ? 'block' : 'none';
    avsUrlInp.oninput = () => { pending.draftAVS = avsUrlInp.value.trim(); _updateItemControlRows(); };

    // ── Test expansion button ────────────────────────────────────────────────
    const avsTestWrap = document.createElement('div');
    avsTestWrap.className    = 'term-test-wrap';
    avsTestWrap.style.display = isExternalAVS ? 'flex' : 'none';

    const avsTestBtn = document.createElement('button');
    avsTestBtn.type          = 'button';
    avsTestBtn.className     = 'modal-btn modal-btn--secondary';
    avsTestBtn.textContent   = 'Test expansion';
    avsTestBtn.dataset.testid = 'avs-test-btn';

    const avsTestStatus = document.createElement('span');
    avsTestStatus.className     = 'term-test-status';
    avsTestStatus.dataset.testid = 'avs-test-status';

    avsTestBtn.addEventListener('click', async () => {
      const url = pending.draftAVS;
      if (!url) {
        avsTestStatus.className   = 'term-test-status term-test-status--err';
        avsTestStatus.textContent = '\u2717 No URL entered';
        return;
      }
      avsTestStatus.className   = 'term-test-status term-test-status--loading';
      avsTestStatus.textContent = 'Expanding\u2026';
      avsTestBtn.disabled = true;
      const result = await terminologyService.testExpand(
        url,
        Modal._svc.questMeta?.preferredTermServer,
      );
      avsTestBtn.disabled = false;
      avsTestStatus.className   = `term-test-status term-test-status--${result.ok ? 'ok' : 'err'}`;
      avsTestStatus.textContent = (result.ok ? '\u2713 ' : '\u2717 ') + result.message;
    });

    avsTestWrap.append(avsTestBtn, avsTestStatus);

    const avsDrop = createCustomSelect({
      items:     avsItems,
      value:     avsInitVal,
      className: 'at-modal-avs-drop sc-trigger--full',
      testid:    'avs-select',
      onChange:  v => {
        if (v === '__ext__') {
          avsUrlInp.style.display  = 'block';
          avsTestWrap.style.display = 'flex';
          pending.draftAVS = avsUrlInp.value.trim();
        } else {
          avsUrlInp.style.display  = 'none';
          avsTestWrap.style.display = 'none';
          avsTestStatus.textContent = '';
          pending.draftAVS = v;
        }
        _updateItemControlRows();
      },
    });

    avsSection.append(avsSubLbl, avsDrop.el, avsUrlInp, avsTestWrap);
    section.appendChild(avsSection);

    // ── answerExpression sub-section ─────────────────────────────────────────
    const exprSection = document.createElement('div');
    exprSection.className     = 'at-modal-sub';
    exprSection.style.display = pending.draftSrc === 'expression' ? 'block' : 'none';

    const exprSubLbl = document.createElement('div');
    exprSubLbl.className        = 'at-modal-sub-lbl';
    exprSubLbl.textContent      = 'FHIRPath expression (sdc-questionnaire-answerExpression):';
    exprSubLbl.dataset.tipTitle = 'Answer Expression';
    exprSubLbl.dataset.tipBody  = 'FHIRPath expression evaluated against the current QuestionnaireResponse. Must return a collection of strings, numbers, or Coding objects — each becomes an answer option. Falls back to the static options list if evaluation fails or returns empty.';
    exprSubLbl.dataset.tipFhir  = 'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-answerExpression';
    exprSubLbl.dataset.tipSpec  = 'SDC';

    const exprInp = document.createElement('textarea');
    exprInp.className      = 'at-modal-opt-inp';
    exprInp.dataset.testid = 'answer-expr-input';
    exprInp.value          = pending.draftAnswerExpr;
    exprInp.placeholder    = "e.g. %resource.item.where(linkId='category').answer.valueCoding.code";
    exprInp.rows           = 3;
    exprInp.oninput = () => { pending.draftAnswerExpr = exprInp.value; };

    exprSection.append(exprSubLbl, exprInp);
    section.appendChild(exprSection);

    // ── openLabel sub-section (open-choice only) ─────────────────────────────
    const openLabelSection = document.createElement('div');
    openLabelSection.className     = 'at-modal-sub';
    openLabelSection.style.display = pending.draftType === 'open-choice' ? '' : 'none';

    const olSubLbl = document.createElement('div');
    olSubLbl.className        = 'at-modal-sub-lbl';
    olSubLbl.textContent      = 'Open label (Other prompt):';
    olSubLbl.dataset.tipTitle = 'Open-choice label';
    olSubLbl.dataset.tipBody  = 'Custom label for the free-text entry in this open-choice control. Replaces the default "Choose or type\u2026" placeholder.';
    olSubLbl.dataset.tipFhir  = 'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-openLabel';
    olSubLbl.dataset.tipSpec  = 'SDC';

    const olInp = document.createElement('input');
    olInp.type           = 'text';
    olInp.className      = 'at-modal-opt-inp';
    olInp.dataset.testid = 'open-label-input';
    olInp.value          = pending.draftOpenLabel;
    olInp.placeholder    = 'e.g. Other (please specify)';
    olInp.oninput = () => { pending.draftOpenLabel = olInp.value; };

    openLabelSection.append(olSubLbl, olInp);
    section.appendChild(openLabelSection);
    this._openLabelEl = openLabelSection;

    // ── Autocomplete toggle (select only) ────────────────────────────────────
    let lookupCb; // forward-declared — assigned when lookupRow is built below
    const acRow = document.createElement('label');
    acRow.className = 'at-modal-sub';
    acRow.style.display = (pending.draftType === 'select') ? '' : 'none';
    const acCb = Object.assign(document.createElement('input'), { type: 'checkbox', checked: !!pending.draftAutocomplete });
    acCb.dataset.testid = 'autocomplete-toggle';
    acCb.onchange = () => { pending.draftAutocomplete = acCb.checked; if (acCb.checked && lookupCb) { lookupCb.checked = false; pending.draftLookup = false; } };
    const acLbl = document.createTextNode(' Autocomplete (searchable dropdown)');
    acRow.dataset.tipTitle = 'Autocomplete';
    acRow.dataset.tipBody  = 'Adds a search/filter input at the top of the dropdown, allowing users to type and filter options. Exports as questionnaire-itemControl = autocomplete.';
    acRow.dataset.tipFhir  = 'item.extension[questionnaire-itemControl].valueCodeableConcept.coding.code = autocomplete';
    acRow.dataset.tipSpec  = 'R4';
    acRow.append(acCb, acLbl);
    section.appendChild(acRow);
    this._acRowEl = acRow;

    // ── Lookup toggle (select + external ValueSet only) ───────────────────────
    const isExtVSInit = pending.draftSrc === 'valueset' && !!pending.draftAVS && !pending.draftAVS.startsWith('#');
    const lookupRow = document.createElement('label');
    lookupRow.className = 'at-modal-multiline-row';
    lookupRow.style.display = (pending.draftType === 'select' && isExtVSInit) ? '' : 'none';
    lookupCb = Object.assign(document.createElement('input'), { type: 'checkbox', checked: !!pending.draftLookup });
    lookupCb.dataset.testid = 'lookup-toggle';
    lookupCb.onchange = () => { pending.draftLookup = lookupCb.checked; if (lookupCb.checked) { acCb.checked = false; pending.draftAutocomplete = false; } };
    const lookupLbl = document.createTextNode(' Lookup (server-side live search)');
    lookupRow.dataset.tipTitle = 'Lookup';
    lookupRow.dataset.tipBody  = 'Queries the terminology server live on each keystroke using ValueSet/$expand?filter=. Only available for items with an external answerValueSet. Exports as questionnaire-itemControl = lookup.';
    lookupRow.dataset.tipFhir  = 'item.extension[questionnaire-itemControl].valueCodeableConcept.coding.code = lookup';
    lookupRow.dataset.tipSpec  = 'R4';
    lookupRow.append(lookupCb, lookupLbl);
    section.appendChild(lookupRow);
    this._lookupRowEl = lookupRow;

    // ── _updateItemControlRows: sync acRow/lookupRow visibility ───────────────
    const _updateItemControlRows = () => {
      const isSelect = pending.draftType === 'select';
      const isExtVS  = pending.draftSrc === 'valueset' && !!pending.draftAVS && !pending.draftAVS.startsWith('#');
      acRow.style.display    = isSelect ? '' : 'none';
      lookupRow.style.display = (isSelect && isExtVS) ? '' : 'none';
    };

    // ── Wire radio toggles ───────────────────────────────────────────────────
    const _showOnly = which => {
      optSection.style.display  = which === 'options'     ? 'block' : 'none';
      avsSection.style.display  = which === 'valueset'    ? 'block' : 'none';
      exprSection.style.display = which === 'expression'  ? 'block' : 'none';
      pending.draftSrc = which;
      _updateItemControlRows();
    };
    optRadio.onchange  = () => { if (optRadio.checked)  { pending.draftAVS = ''; _showOnly('options'); } };
    avsRadio.onchange  = () => {
      if (avsRadio.checked) {
        _showOnly('valueset');
        if (!pending.draftAVS) {
          if (containedVS.length) {
            pending.draftAVS = '#' + containedVS[0].id;
            avsDrop.setValue('#' + containedVS[0].id);
          } else {
            avsDrop.setValue('__ext__');
            avsUrlInp.style.display = 'block';
            pending.draftAVS = '';
          }
        }
      }
    };
    exprRadio.onchange = () => { if (exprRadio.checked) { pending.draftAVS = ''; _showOnly('expression'); } };

    return section;
  }

  commit(pending, node) {
    if (CHOICE_TYPES.has(node.itemType)) {
      if (pending.draftSrc === 'expression') {
        node._answerExpression = pending.draftAnswerExpr.trim();
        delete node._answerValueSet;
        delete node._optionOrdinals;
        delete node._optionPrefixes;
      } else if (pending.draftAVS) {
        node._answerValueSet = pending.draftAVS;
        node.options = resolveContainedValueSet(Modal._svc.questContained, pending.draftAVS);
        delete node._optionOrdinals;
        delete node._optionPrefixes;
      } else {
        delete node._answerValueSet;
        delete node._answerExpression;

        const rows = (pending.draftOptionRows || []).filter(r => r.code.trim());
        node.options = rows.map(r => r.code.trim() + '=' + r.label.trim()).join(',');

        const newOrdinals = {};
        const newPrefixes = {};
        rows.forEach(r => {
          const code = r.code.trim();
          const score = r.score.trim();
          if (score !== '' && !isNaN(Number(score))) newOrdinals[code] = Number(score);
          if (r.prefix.trim()) newPrefixes[code] = r.prefix.trim();
        });
        if (Object.keys(newOrdinals).length) node._optionOrdinals = newOrdinals;
        else delete node._optionOrdinals;
        if (Object.keys(newPrefixes).length) node._optionPrefixes = newPrefixes;
        else delete node._optionPrefixes;
      }
    } else {
      delete node._answerValueSet;
      delete node._answerExpression;
      delete node._optionOrdinals;
      delete node._optionPrefixes;
      node.options = '';
    }

    if (node.itemType === 'open-choice' && pending.draftOpenLabel.trim()) {
      node._openLabel = pending.draftOpenLabel.trim();
    } else {
      delete node._openLabel;
    }

    // itemControl: autocomplete / lookup (select only, mutually exclusive)
    if (node.itemType === 'select' && pending.draftLookup) {
      node._itemControl = 'lookup';
    } else if (node.itemType === 'select' && pending.draftAutocomplete) {
      node._itemControl = 'autocomplete';
    } else if (node._itemControl === 'autocomplete' || node._itemControl === 'lookup') {
      delete node._itemControl;
    }
  }

  initPending(node) {
    return {
      draftOptionRows:  _buildRows(node),
      draftAVS:         node._answerValueSet || '',
      draftOpenLabel:   node._openLabel || '',
      draftAnswerExpr:  node._answerExpression || '',
      draftSrc:         node._answerExpression ? 'expression' : (node._answerValueSet ? 'valueset' : 'options'),
      draftAutocomplete: node._itemControl === 'autocomplete',
      draftLookup:       node._itemControl === 'lookup',
    };
  }
}

ANSWER_TYPE_SECTIONS.push(new ChoiceSection());
