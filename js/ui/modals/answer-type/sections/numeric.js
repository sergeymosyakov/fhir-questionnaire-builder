import { SECTION_REGISTRY, AnswerTypeSection } from '../base-section.js';
import { NUMERIC_TYPES } from '../data.js';

function _numField(lbl, tid, initVal, onInput) {
  const fw  = document.createElement('div');
  fw.className = 'at-modal-num-field';
  const la  = document.createElement('label');
  la.className   = 'at-modal-num-lbl';
  la.textContent = lbl;
  const inp = document.createElement('input');
  inp.type           = 'number';
  inp.step           = 'any';
  inp.className      = 'at-modal-num-inp';
  inp.dataset.testid = tid;
  inp.value          = initVal;
  inp.placeholder    = '\u2014';
  inp.oninput = () => onInput(inp.value);
  fw.append(la, inp);
  return fw;
}

class NumericSection extends AnswerTypeSection {
  isVisible(type) { return NUMERIC_TYPES.has(type); }

  build(pending) {
    const section = document.createElement('div');
    section.className = 'at-modal-sub';

    const numericHdr = document.createElement('div');
    numericHdr.className        = 'at-modal-sub-lbl';
    numericHdr.textContent      = 'Numeric constraints:';
    numericHdr.dataset.tipTitle = 'Numeric constraints';
    numericHdr.dataset.tipBody  = 'Sets the allowed value range. Violations show an error badge in preview and are enforced in QR export.';
    numericHdr.dataset.tipFhir  = 'item.extension[minValue] / item.extension[maxValue]';
    numericHdr.dataset.tipSpec  = 'R4';

    const numericGrid = document.createElement('div');
    numericGrid.className = 'at-modal-num-grid';
    numericGrid.appendChild(_numField('Min', 'min-value-input', pending.draftMinValue, v => { pending.draftMinValue = v; }));
    numericGrid.appendChild(_numField('Max', 'max-value-input', pending.draftMaxValue, v => { pending.draftMaxValue = v; }));

    // ── "Render as slider" toggle + step field ───────────────────────────────
    const sliderRow = document.createElement('div');
    sliderRow.className = 'at-modal-slider-row';

    const sliderChk = document.createElement('input');
    sliderChk.type           = 'checkbox';
    sliderChk.dataset.testid = 'slider-toggle';
    sliderChk.checked        = pending.draftSliderStep !== '';

    const sliderChkLbl = document.createElement('label');
    sliderChkLbl.className        = 'at-modal-slider-lbl';
    sliderChkLbl.textContent      = 'Render as slider';
    sliderChkLbl.dataset.tipTitle = 'Slider';
    sliderChkLbl.dataset.tipBody  = 'Renders the numeric input as a range slider. The step value sets the slider increment. Exported as questionnaire-sliderStepValue.';
    sliderChkLbl.dataset.tipFhir  = 'item.extension[questionnaire-sliderStepValue].valueDecimal';
    sliderChkLbl.dataset.tipSpec  = 'SDC';

    const stepWrap = _numField('Step', 'slider-step-input',
      pending.draftSliderStep !== '' ? pending.draftSliderStep : '1',
      v => { pending.draftSliderStep = v; });
    stepWrap.style.display = sliderChk.checked ? 'flex' : 'none';

    sliderChk.onchange = () => {
      if (sliderChk.checked) {
        if (!pending.draftSliderStep) pending.draftSliderStep = '1';
        stepWrap.querySelector('input').value = pending.draftSliderStep;
        stepWrap.style.display = 'flex';
      } else {
        pending.draftSliderStep = '';
        stepWrap.style.display  = 'none';
      }
    };

    sliderRow.append(sliderChk, sliderChkLbl, stepWrap);

    const numericHint = document.createElement('div');
    numericHint.className   = 'at-modal-num-hint';
    numericHint.textContent = 'Min / Max set HTML constraints and show error badge in the preview.';

    section.append(numericHdr, numericGrid, sliderRow, numericHint);
    return section;
  }

  commit(pending, node) {
    if (NUMERIC_TYPES.has(node.itemType)) {
      const _pf    = s => { const n = parseFloat(s); return isNaN(n) ? undefined : n; };
      const _round = node.itemType === 'integer';
      const minV   = _pf(pending.draftMinValue);
      const maxV   = _pf(pending.draftMaxValue);
      const stepV  = _pf(pending.draftSliderStep);
      if (minV  !== undefined)              node._minValue   = _round ? Math.round(minV)  : minV;  else delete node._minValue;
      if (maxV  !== undefined)              node._maxValue   = _round ? Math.round(maxV)  : maxV;  else delete node._maxValue;
      if (stepV !== undefined && stepV > 0) node._sliderStep = _round ? Math.round(stepV) : stepV; else delete node._sliderStep;
    } else {
      delete node._minValue;
      delete node._maxValue;
      delete node._sliderStep;
    }
  }

  initDraft(node) {
    return {
      draftMinValue:   node._minValue   !== undefined ? String(node._minValue)   : '',
      draftMaxValue:   node._maxValue   !== undefined ? String(node._maxValue)   : '',
      draftSliderStep: node._sliderStep !== undefined ? String(node._sliderStep) : '',
    };
  }
}

SECTION_REGISTRY.push(new NumericSection());
