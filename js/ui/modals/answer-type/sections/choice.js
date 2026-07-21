import { AnswerTypeSection } from '../base-section.js';
import { ANSWER_TYPE_SECTIONS } from '../registry.js';
import { resolveContainedValueSet } from '../../../../fhir/import.js';
import { createCustomSelect } from '../../../custom-select.js';
import { CHOICE_TYPES } from '../data.js';
import { parseOptions } from '../../../../utils.js';
import { fhirOptsToStr } from '../../../../fhir/import-helpers.js';
import { createOptionsEditor } from '../../../answer-options-editor.js';
import { terminologyService } from '../../../../fhir/terminology-service.js';
import { FHIR } from '../../../../fhir/urls/fhir.js';
import { EXAMPLE_URL } from '../../../../fhir/urls/examples.js';

function _buildRows(node) {
  const ords       = node._optionOrdinals  || {};
  const prefixes   = node._optionPrefixes  || {};
  const exclusives = node._optionExclusives || {};
  const weights    = node._optionWeights   || {};
  const systems    = node._optionSystems   || {};

  if (node._rawAnswerOptions) {
    return node._rawAnswerOptions.map(o => {
      let code = '', label = '', valueType = 'coding', system = '';
      if (o.valueCoding) {
        code      = o.valueCoding.code    || o.valueCoding.display || '';
        label     = o.valueCoding.display || o.valueCoding.code    || '';
        system    = o.valueCoding.system  || '';
        valueType = 'coding';
      } else if (o.valueString !== undefined) {
        code = label = o.valueString; valueType = 'string';
      } else if (o.valueInteger !== undefined) {
        code = label = String(o.valueInteger); valueType = 'integer';
      } else if (o.valueDate !== undefined) {
        code = label = o.valueDate; valueType = 'date';
      } else if (o.valueTime !== undefined) {
        code = label = o.valueTime; valueType = 'time';
      } else if (o.valueReference) {
        const ref  = typeof o.valueReference === 'string' ? o.valueReference : (o.valueReference.reference || '');
        const disp = (typeof o.valueReference === 'object' && o.valueReference.display) || ref;
        code = ref; label = disp; valueType = 'reference';
      }
      const key = code || label;
      return {
        code, label, system, valueType,
        score:     ords[key]     !== undefined ? String(ords[key])     : '',
        prefix:    prefixes[key] || '',
        weight:    weights[key]  !== undefined ? String(weights[key])  : '',
        exclusive: !!exclusives[key],
      };
    });
  }

  const pairs = parseOptions(node.options || '');
  return pairs.map(({ code, display }) => ({
    code,
    label:     display,
    system:    systems[code] || '',
    score:     ords[code]     !== undefined ? String(ords[code])     : '',
    prefix:    prefixes[code] || '',
    weight:    weights[code]  !== undefined ? String(weights[code])  : '',
    exclusive: !!exclusives[code],
  }));
}

// Build a labelled FHIRPath textarea sub-section for an answer-source expression
// (answerExpression / candidateExpression). Shared by both to avoid duplication.
function _buildExprSubSection({ visible, label, tipTitle, tipBody, tipFhir, testid, value, placeholder, onInput }) {
  const sec = document.createElement('div');
  sec.className     = 'at-modal-sub';
  sec.style.display = visible ? 'block' : 'none';

  const lbl = document.createElement('div');
  lbl.className        = 'at-modal-sub-lbl';
  lbl.textContent      = label;
  lbl.dataset.tipTitle = tipTitle;
  lbl.dataset.tipBody  = tipBody;
  lbl.dataset.tipFhir  = tipFhir;
  lbl.dataset.tipSpec  = 'SDC';

  const inp = document.createElement('textarea');
  inp.className      = 'at-modal-opt-inp';
  inp.dataset.testid = testid;
  inp.value          = value;
  inp.placeholder    = placeholder;
  inp.rows           = 3;
  inp.oninput = () => onInput(inp.value);

  sec.append(lbl, inp);
  return sec;
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

  build(pending, questDoc, _answerStore) {
    this._pending = pending;
    const section = document.createElement('div');

    // ── Answer source toggle ─────────────────────────────────────────────────
    const sourceRow = document.createElement('div');
    sourceRow.className = 'at-modal-source-row';

    const optRadio  = Object.assign(document.createElement('input'), { type: 'radio', name: '_at_src', id: '_at_src_opt',  value: 'options',     checked: pending.draftSrc === 'options' });
    const avsRadio  = Object.assign(document.createElement('input'), { type: 'radio', name: '_at_src', id: '_at_src_avs',  value: 'valueset',    checked: pending.draftSrc === 'valueset' });
    const exprRadio = Object.assign(document.createElement('input'), { type: 'radio', name: '_at_src', id: '_at_src_expr', value: 'expression',  checked: pending.draftSrc === 'expression' });
    const candRadio = Object.assign(document.createElement('input'), { type: 'radio', name: '_at_src', id: '_at_src_cand', value: 'candidate',   checked: pending.draftSrc === 'candidate' });
    optRadio.dataset.testid  = 'src-options-radio';
    avsRadio.dataset.testid  = 'src-valueset-radio';
    exprRadio.dataset.testid = 'src-answer-expr-radio';
    candRadio.dataset.testid = 'src-candidate-expr-radio';
    const optLbl    = Object.assign(document.createElement('label'), { htmlFor: '_at_src_opt',  textContent: 'Options list',                    className: 'at-modal-src-lbl' });
    const avsLbl    = Object.assign(document.createElement('label'), { htmlFor: '_at_src_avs',  textContent: 'ValueSet (answerValueSet)',       className: 'at-modal-src-lbl' });
    const exprLbl   = Object.assign(document.createElement('label'), { htmlFor: '_at_src_expr', textContent: 'Expression (answerExpression)',    className: 'at-modal-src-lbl' });
    const candLbl   = Object.assign(document.createElement('label'), { htmlFor: '_at_src_cand', textContent: 'Candidate (candidateExpression)', className: 'at-modal-src-lbl' });

    sourceRow.append(optRadio, optLbl, avsRadio, avsLbl, exprRadio, exprLbl, candRadio, candLbl);
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
      showType:     !!pending.draftHasRawOpts,
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

    const containedVS = [...questDoc?.contained ?? []].filter(r => r.resourceType === 'ValueSet');
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
    avsUrlInp.placeholder    = EXAMPLE_URL.valueSet;
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
        questDoc?.meta?.preferredTermServer,
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

    // ── answerExpression / candidateExpression sub-sections ──────────────────
    const exprSection = _buildExprSubSection({
      visible:     pending.draftSrc === 'expression',
      label:       'FHIRPath expression (sdc-questionnaire-answerExpression):',
      tipTitle:    'Answer Expression',
      tipBody:     'FHIRPath expression evaluated against the current QuestionnaireResponse. Returns the permitted answers — a collection of strings, numbers, or Coding objects, each becoming an answer option. Falls back to the static options list if evaluation fails or returns empty.',
      tipFhir:     FHIR.answerExpression,
      testid:      'answer-expr-input',
      value:       pending.draftAnswerExpr,
      placeholder: "e.g. %resource.item.where(linkId='category').answer.valueCoding.code",
      onInput:     v => { pending.draftAnswerExpr = v; },
    });
    section.appendChild(exprSection);

    const candidateSection = _buildExprSubSection({
      visible:     pending.draftSrc === 'candidate',
      label:       'FHIRPath expression (sdc-questionnaire-candidateExpression):',
      tipTitle:    'Candidate Expression',
      tipBody:     'FHIRPath, CQL, or FHIR Query expression that resolves to a list of candidate (suggested) answers for the item. Like answerExpression, each result becomes a selectable option, but candidates are suggestions rather than the strictly permitted set — typically used for lookup / reference items. Falls back to the static options list if evaluation fails or returns empty.',
      tipFhir:     FHIR.candidateExpression,
      testid:      'candidate-expr-input',
      value:       pending.draftCandidateExpr,
      placeholder: "e.g. %resource.item.where(linkId='contacts').answer.valueReference",
      onInput:     v => { pending.draftCandidateExpr = v; },
    });
    section.appendChild(candidateSection);

    // ── openLabel sub-section (open-choice only) ─────────────────────────────
    const openLabelSection = document.createElement('div');
    openLabelSection.className     = 'at-modal-sub';
    openLabelSection.style.display = pending.draftType === 'open-choice' ? '' : 'none';

    const olSubLbl = document.createElement('div');
    olSubLbl.className        = 'at-modal-sub-lbl';
    olSubLbl.textContent      = 'Open label (Other prompt):';
    olSubLbl.dataset.tipTitle = 'Open-choice label';
    olSubLbl.dataset.tipBody  = 'Custom label for the free-text entry in this open-choice control. Replaces the default "Choose or type\u2026" placeholder.';
    olSubLbl.dataset.tipFhir  = FHIR.openLabel;
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
    acRow.className = 'at-modal-multiline-row';
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
      candidateSection.style.display = which === 'candidate' ? 'block' : 'none';
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
    candRadio.onchange = () => { if (candRadio.checked) { pending.draftAVS = ''; _showOnly('candidate'); } };

    // ── answerConstraint (R4B/R5) ────────────────────────────────────────────
    const aconstRow = document.createElement('div');
    aconstRow.className = 'at-modal-multiline-row';
    const aconstLbl = document.createElement('span');
    aconstLbl.className        = 'at-modal-sub-lbl at-modal-sub-lbl--mb0';
    aconstLbl.textContent      = 'Answer constraint:';
    aconstLbl.dataset.tipTitle = 'answerConstraint';
    aconstLbl.dataset.tipBody  = 'Controls how free-text answers are handled when options are defined.\n\u2022 optionsOnly \u2014 only coded options allowed\n\u2022 optionsOrType \u2014 option or any value of the answer type\n\u2022 optionsOrString \u2014 option or free-text string';
    aconstLbl.dataset.tipFhir  = 'Questionnaire.item.answerConstraint';
    aconstLbl.dataset.tipSpec  = 'R4';
    const ACONST_ITEMS = [
      { value: '',                label: '\u2014 not set \u2014' },
      { value: 'optionsOnly',     label: 'optionsOnly' },
      { value: 'optionsOrType',   label: 'optionsOrType' },
      { value: 'optionsOrString', label: 'optionsOrString' },
    ];
    const aconstSel = createCustomSelect({
      items:    ACONST_ITEMS,
      value:    pending.draftAnswerConstraint || '',
      testid:   'answer-constraint-select',
      className: 'sc-trigger--sm',
      onChange:  v => { pending.draftAnswerConstraint = v || undefined; },
    });
    aconstRow.append(aconstLbl, aconstSel.el);
    section.appendChild(aconstRow);

    return section;
  }

  commit(pending, node, questDoc, _answerStore) {
    if (CHOICE_TYPES.has(node.itemType)) {
      if (pending.draftSrc === 'expression' || pending.draftSrc === 'candidate') {
        if (pending.draftSrc === 'expression') {
          node._answerExpression = pending.draftAnswerExpr.trim();
          delete node._candidateExpression;
        } else {
          node._candidateExpression = pending.draftCandidateExpr.trim();
          delete node._answerExpression;
        }
        delete node._answerValueSet;
        delete node._optionOrdinals;
        delete node._optionPrefixes;
        delete node._optionExclusives;
        delete node._optionWeights;
        delete node._answerMedias;
      } else if (pending.draftAVS) {
        node._answerValueSet = pending.draftAVS;
        node.options = resolveContainedValueSet(questDoc?.contained ?? [], pending.draftAVS);
        delete node._optionOrdinals;
        delete node._optionPrefixes;
        delete node._optionExclusives;
        delete node._optionWeights;
        delete node._answerMedias;
      } else {
        delete node._answerValueSet;
        delete node._answerExpression;
        delete node._candidateExpression;

        // Derive a code from the label when the Code field is left blank (and
        // vice versa) so a label-only option is kept instead of silently dropped.
        const rows = (pending.draftOptionRows || [])
          .map(r => {
            const code  = r.code.trim()  || r.label.trim();
            const label = r.label.trim() || r.code.trim();
            return { ...r, code, label };
          })
          .filter(r => r.code);
        node.options = rows.map(r => r.code.trim() + '=' + r.label.trim()).join(',');

        // Sync _rawAnswerOptions: preserve extra Coding properties (system, etc.)
        // and use each row's valueType to write the correct value[x] key.
        if (node._rawAnswerOptions) {
          const oldByCode = new Map();
          for (const raw of node._rawAnswerOptions) {
            const c = raw.valueCoding;
            if (c) oldByCode.set(c.code || c.display || '', raw);
          }
          const synced = rows.map(r => {
            const code  = r.code.trim();
            const label = r.label.trim();
            const vt    = r.valueType || 'coding';
            if (vt === 'string')    return { valueString: code };
            if (vt === 'integer')   { const n = parseInt(code, 10); return { valueInteger: isNaN(n) ? 0 : n }; }
            if (vt === 'date')      return { valueDate: code };
            if (vt === 'time')      return { valueTime: code };
            if (vt === 'reference') return { valueReference: { reference: code, ...(label && label !== code ? { display: label } : {}) } };
            // coding: preserve existing entry (system, version, etc.) but apply system/code/display from row
            const existing = oldByCode.get(code);
            const newSys = (r.system || '').trim() || undefined;
            if (existing?.valueCoding) {
              const vCoding = { ...existing.valueCoding, code, display: label };
              if (newSys) vCoding.system = newSys;
              else delete vCoding.system;
              return { ...existing, valueCoding: vCoding };
            }
            return { valueCoding: { ...(newSys ? { system: newSys } : {}), code, display: label } };
          });
          node._rawAnswerOptions = synced.length ? synced : undefined;
          // keep node.options in sync for builder display
          node.options = fhirOptsToStr(node._rawAnswerOptions || []);
        }

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

        const newExclusives = {};
        rows.forEach(r => {
          const code = r.code.trim();
          if (r.exclusive) newExclusives[code] = true;
        });
        if (Object.keys(newExclusives).length) node._optionExclusives = newExclusives;
        else delete node._optionExclusives;

        const newWeights = {};
        rows.forEach(r => {
          const code = r.code.trim();
          const w = (r.weight ?? '').toString().trim();
          if (w !== '' && !isNaN(Number(w))) newWeights[code] = Number(w);
        });
        if (Object.keys(newWeights).length) node._optionWeights = newWeights;
        else delete node._optionWeights;

        const newSystems = {};
        rows.forEach(r => {
          const code = r.code.trim();
          const sys  = (r.system || '').trim();
          if (sys) newSystems[code] = sys;
        });
        if (Object.keys(newSystems).length) node._optionSystems = newSystems;
        else delete node._optionSystems;
      }
    } else {
      delete node._answerValueSet;
      delete node._answerExpression;
      delete node._optionOrdinals;
      delete node._optionPrefixes;
      delete node._optionExclusives;
      delete node._optionWeights;
      delete node._optionSystems;
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
    if (pending.draftAnswerConstraint) node._answerConstraint = pending.draftAnswerConstraint;
    else delete node._answerConstraint;
  }

  initPending(node) {
    return {
      draftOptionRows:  _buildRows(node),
      draftHasRawOpts:  !!node._rawAnswerOptions,
      draftAVS:         node._answerValueSet || '',
      draftOpenLabel:   node._openLabel || '',
      draftAnswerExpr:  node._answerExpression || '',
      draftCandidateExpr: node._candidateExpression || '',
      draftSrc:         node._answerExpression ? 'expression'
                      : node._candidateExpression ? 'candidate'
                      : node._answerValueSet ? 'valueset'
                      : 'options',
      draftAutocomplete:      node._itemControl === 'autocomplete',
      draftLookup:            node._itemControl === 'lookup',
      draftAnswerConstraint:  node._answerConstraint || '',
    };
  }
}

ANSWER_TYPE_SECTIONS.push(new ChoiceSection());
