import { AnswerTypeSection } from '../base-section.js';
import { ANSWER_TYPE_SECTIONS } from '../registry.js';
import { resolveContainedValueSet } from '../../../../fhir/import.js';
import { createCustomSelect } from '../../../custom-select.js';
import { Modal } from '../../modal-base.js';
import { CHOICE_TYPES } from '../data.js';
import { parseOptions } from '../../../../utils.js';

function _optsWithOrdinals(node) {
  if (!node.options) return '';
  const ords = node._optionOrdinals || {};
  return parseOptions(node.options)
    .map(({ code, display }) => {
      const o = ords[code];
      return o !== undefined ? `${code}=${display}=${o}` : `${code}=${display}`;
    })
    .join(',');
}

function _parseOptsWithOrdinals(str) {
  return (str || '').split(',').map(s => s.trim()).filter(Boolean).map(s => {
    const eq = s.indexOf('=');
    if (eq === -1) return { code: s, display: s };
    const code = s.slice(0, eq).trim();
    const rest = s.slice(eq + 1);
    const lastEq = rest.lastIndexOf('=');
    if (lastEq !== -1) {
      const maybeOrd = rest.slice(lastEq + 1).trim();
      const ordVal = Number(maybeOrd);
      if (!isNaN(ordVal) && maybeOrd !== '') {
        return { code, display: rest.slice(0, lastEq).trim(), ordinal: ordVal };
      }
    }
    return { code, display: rest.trim() };
  });
}

class ChoiceSection extends AnswerTypeSection {
  isVisible(type) { return CHOICE_TYPES.has(type); }

  onTypeChange(type) {
    if (this._openLabelEl) {
      this._openLabelEl.style.display = type === 'open-choice' ? '' : 'none';
    }
  }

  build(pending) {
    const section = document.createElement('div');

    // ── Answer source toggle ─────────────────────────────────────────────────
    const sourceRow = document.createElement('div');
    sourceRow.className = 'at-modal-source-row';

    const optRadio = Object.assign(document.createElement('input'), { type: 'radio', name: '_at_src', id: '_at_src_opt', value: 'options', checked: !pending.draftAVS });
    const avsRadio = Object.assign(document.createElement('input'), { type: 'radio', name: '_at_src', id: '_at_src_avs', value: 'valueset', checked: !!pending.draftAVS });
    const optLbl   = Object.assign(document.createElement('label'), { htmlFor: '_at_src_opt', textContent: 'Options list', className: 'at-modal-src-lbl' });
    const avsLbl   = Object.assign(document.createElement('label'), { htmlFor: '_at_src_avs', textContent: 'ValueSet (answerValueSet)', className: 'at-modal-src-lbl' });

    sourceRow.append(optRadio, optLbl, avsRadio, avsLbl);
    section.appendChild(sourceRow);

    // ── Options sub-section ──────────────────────────────────────────────────
    const optSection = document.createElement('div');
    optSection.className     = 'at-modal-sub';
    optSection.style.display = !pending.draftAVS ? 'block' : 'none';

    const optSubLbl = document.createElement('div');
    optSubLbl.className        = 'at-modal-sub-lbl';
    optSubLbl.textContent      = 'Options (code=Label or code=Label=score, comma-separated):';
    optSubLbl.dataset.tipTitle = 'Answer options';
    optSubLbl.dataset.tipBody  = 'Coded answer choices. Format: code=Label or code=Label=score (ordinal value). Comma-separated. Exported as item.answerOption[].';
    optSubLbl.dataset.tipFhir  = 'Questionnaire.item.answerOption[].valueCoding';
    optSubLbl.dataset.tipSpec  = 'R4';

    const optInp = document.createElement('textarea');
    optInp.className      = 'at-modal-opt-inp';
    optInp.dataset.testid = 'options-input';
    optInp.value          = pending.draftOptions;
    optInp.placeholder    = 'e.g. la1=Not at all=0,la2=Several days=1,la3=Always=2';
    optInp.rows           = 1;
    optInp.oninput = () => { pending.draftOptions = optInp.value; };

    const pfxSubLbl = document.createElement('div');
    pfxSubLbl.className        = 'at-modal-sub-lbl';
    pfxSubLbl.textContent      = 'Prefixes (code=Prefix, ...)';
    pfxSubLbl.dataset.tipTitle = 'Option prefixes';
    pfxSubLbl.dataset.tipBody  = 'Display prefix shown before each answer label (e.g. A., 1.). Exported as questionnaire-optionPrefix extension on each answerOption.';
    pfxSubLbl.dataset.tipFhir  = 'Questionnaire.item.answerOption[].extension[questionnaire-optionPrefix]';
    pfxSubLbl.dataset.tipSpec  = 'R4';

    const pfxInp = document.createElement('input');
    pfxInp.type           = 'text';
    pfxInp.className      = 'at-modal-opt-inp';
    pfxInp.dataset.testid = 'option-prefix-input';
    pfxInp.value          = pending.draftPrefixes;
    pfxInp.placeholder    = 'e.g. la1=A.,la2=B.,la3=C.';
    pfxInp.oninput = () => { pending.draftPrefixes = pfxInp.value; };

    optSection.append(optSubLbl, optInp, pfxSubLbl, pfxInp);
    section.appendChild(optSection);

    // ── ValueSet sub-section ─────────────────────────────────────────────────
    const avsSection = document.createElement('div');
    avsSection.className     = 'at-modal-sub';
    avsSection.style.display = pending.draftAVS ? 'block' : 'none';

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
    avsUrlInp.oninput = () => { pending.draftAVS = avsUrlInp.value.trim(); };

    const avsDrop = createCustomSelect({
      items:     avsItems,
      value:     avsInitVal,
      className: 'at-modal-avs-drop sc-trigger--full',
      testid:    'avs-select',
      onChange:  v => {
        if (v === '__ext__') {
          avsUrlInp.style.display = 'block';
          pending.draftAVS = avsUrlInp.value.trim();
        } else {
          avsUrlInp.style.display = 'none';
          pending.draftAVS = v;
        }
      },
    });

    avsSection.append(avsSubLbl, avsDrop.el, avsUrlInp);
    section.appendChild(avsSection);

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

    // ── Wire radio toggles ───────────────────────────────────────────────────
    optRadio.onchange = () => {
      if (optRadio.checked) {
        optSection.style.display = 'block';
        avsSection.style.display = 'none';
        pending.draftAVS = '';
      }
    };
    avsRadio.onchange = () => {
      if (avsRadio.checked) {
        optSection.style.display = 'none';
        avsSection.style.display = 'block';
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

    return section;
  }

  commit(pending, node) {
    if (CHOICE_TYPES.has(node.itemType)) {
      if (pending.draftAVS) {
        node._answerValueSet = pending.draftAVS;
        node.options = resolveContainedValueSet(Modal._svc.questContained, pending.draftAVS);
        delete node._optionOrdinals;
        delete node._optionPrefixes;
      } else {
        delete node._answerValueSet;
        const _parsedOrds  = _parseOptsWithOrdinals(pending.draftOptions);
        const _newOrdinals = {};
        node.options = _parsedOrds.map(({ code, display, ordinal }) => {
          if (ordinal !== undefined) _newOrdinals[code] = ordinal;
          return code + '=' + display;
        }).join(',');
        if (Object.keys(_newOrdinals).length) node._optionOrdinals = _newOrdinals;
        else delete node._optionOrdinals;

        const _newPrefixes = {};
        (pending.draftPrefixes || '').split(',').forEach(s => {
          const idx = s.indexOf('=');
          if (idx < 1) return;
          const code = s.slice(0, idx).trim();
          const pfx  = s.slice(idx + 1).trim();
          if (code && pfx) _newPrefixes[code] = pfx;
        });
        if (Object.keys(_newPrefixes).length) node._optionPrefixes = _newPrefixes;
        else delete node._optionPrefixes;
      }
    } else {
      delete node._answerValueSet;
      delete node._optionOrdinals;
      delete node._optionPrefixes;
      node.options = '';
    }

    if (node.itemType === 'open-choice' && pending.draftOpenLabel.trim()) {
      node._openLabel = pending.draftOpenLabel.trim();
    } else {
      delete node._openLabel;
    }
  }

  initPending(node) {
    return {
      draftOptions:   _optsWithOrdinals(node),
      draftAVS:       node._answerValueSet || '',
      draftPrefixes:  node._optionPrefixes
        ? Object.entries(node._optionPrefixes).map(([code, pfx]) => `${code}=${pfx}`).join(',')
        : '',
      draftOpenLabel: node._openLabel || '',
    };
  }
}

ANSWER_TYPE_SECTIONS.push(new ChoiceSection());
