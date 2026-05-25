// ── Answer Type sections — self-registering per-type body sections ────────────
// Each section class implements:
//   isVisible(type)    → boolean, controls top-level show/hide
//   build(pending)     → HTMLElement, builds the section's DOM (called each open)
//   onTypeChange(type) → optional hook for internal visibility updates
//
// Sections register themselves via SECTION_REGISTRY.push() at module level.
// modal.js imports SECTION_REGISTRY and iterates it in _renderBody.

import { questContained } from '../../state.js';
import { createCustomSelect } from '../custom-select.js';
import {
  CHOICE_TYPES, ENTRY_FORMAT_TYPES, NUMERIC_TYPES,
  FHIR_R4_TYPES, BUILDER_UNITS,
} from './data.js';

export const SECTION_REGISTRY = [];

// ── Shared helper ─────────────────────────────────────────────────────────────

function _numField(lbl, tid, initVal, onInput) {
  const fw  = document.createElement('div');
  fw.className = 'at-modal-num-field';
  const la  = document.createElement('label');
  la.className   = 'at-modal-num-lbl';
  la.textContent = lbl;
  const inp = document.createElement('input');
  inp.type  = 'number'; inp.step = 'any';
  inp.className      = 'at-modal-num-inp';
  inp.dataset.testid = tid;
  inp.value          = initVal;
  inp.placeholder    = '\u2014';
  inp.oninput = () => onInput(inp.value);
  fw.append(la, inp);
  return fw;
}

// ── Base class ────────────────────────────────────────────────────────────────

class AnswerTypeSection {
  isVisible(type)    { return false; }   // eslint-disable-line no-unused-vars
  build(pending)     { return document.createElement('div'); } // eslint-disable-line no-unused-vars
  onTypeChange(type) {}                  // eslint-disable-line no-unused-vars
}

// ── 1. Choice (select / radio / open-choice / checkbox) ──────────────────────

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
    optSection.className    = 'at-modal-sub';
    optSection.style.display = !pending.draftAVS ? 'block' : 'none';

    const optSubLbl = document.createElement('div');
    optSubLbl.className        = 'at-modal-sub-lbl';
    optSubLbl.textContent      = 'Options (code=Label or code=Label=score, comma-separated):';
    optSubLbl.dataset.tipTitle = 'Answer options';
    optSubLbl.dataset.tipBody  = 'Coded answer choices. Format: code=Label or code=Label=score (ordinal value). Comma-separated. Exported as item.answerOption[].';
    optSubLbl.dataset.tipFhir  = 'Questionnaire.item.answerOption[].valueCoding';
    optSubLbl.dataset.tipSpec  = 'R4';

    const optInp = document.createElement('textarea');
    optInp.className        = 'at-modal-opt-inp';
    optInp.dataset.testid   = 'options-input';
    optInp.value            = pending.draftOptions;
    optInp.placeholder      = 'e.g. la1=Not at all=0,la2=Several days=1,la3=Always=2';
    optInp.rows             = 1;
    optInp.oninput = () => { pending.draftOptions = optInp.value; };

    const pfxSubLbl = document.createElement('div');
    pfxSubLbl.className        = 'at-modal-sub-lbl';
    pfxSubLbl.textContent      = 'Prefixes (code=Prefix, ...)';
    pfxSubLbl.dataset.tipTitle = 'Option prefixes';
    pfxSubLbl.dataset.tipBody  = 'Display prefix shown before each answer label (e.g. A., 1.). Exported as questionnaire-optionPrefix extension on each answerOption.';
    pfxSubLbl.dataset.tipFhir  = 'Questionnaire.item.answerOption[].extension[questionnaire-optionPrefix]';
    pfxSubLbl.dataset.tipSpec  = 'R4';

    const pfxInp = document.createElement('input');
    pfxInp.type             = 'text';
    pfxInp.className        = 'at-modal-opt-inp';
    pfxInp.dataset.testid   = 'option-prefix-input';
    pfxInp.value            = pending.draftPrefixes;
    pfxInp.placeholder      = 'e.g. la1=A.,la2=B.,la3=C.';
    pfxInp.oninput = () => { pending.draftPrefixes = pfxInp.value; };

    optSection.append(optSubLbl, optInp, pfxSubLbl, pfxInp);
    section.appendChild(optSection);

    // ── ValueSet sub-section ─────────────────────────────────────────────────
    const avsSection = document.createElement('div');
    avsSection.className    = 'at-modal-sub';
    avsSection.style.display = pending.draftAVS ? 'block' : 'none';

    const avsSubLbl = document.createElement('div');
    avsSubLbl.className        = 'at-modal-sub-lbl';
    avsSubLbl.textContent      = 'ValueSet \u2014 select from contained[] or enter an external URL:';
    avsSubLbl.dataset.tipTitle = 'Answer ValueSet';
    avsSubLbl.dataset.tipBody  = 'Links coded answers to a FHIR ValueSet. Use a #id to reference a local contained[] ValueSet, or a full URL for an external terminology server.';
    avsSubLbl.dataset.tipFhir  = 'Questionnaire.item.answerValueSet';
    avsSubLbl.dataset.tipSpec  = 'R4';

    const containedVS = [...questContained].filter(r => r.resourceType === 'ValueSet');
    const avsItems = [
      { value: '', label: '\u2014 none \u2014' },
      ...containedVS.map(vs => ({ value: '#' + vs.id, label: '#' + vs.id + (vs.title ? ' \u2014 ' + vs.title : '') })),
      { value: '__ext__', label: '\u2014 external URL \u2014' },
    ];
    const isExternalAVS = !!pending.draftAVS && !pending.draftAVS.startsWith('#');
    const avsInitVal    = isExternalAVS ? '__ext__' : (pending.draftAVS || '');

    const avsUrlInp = document.createElement('input');
    avsUrlInp.type            = 'text';
    avsUrlInp.className       = 'at-modal-avs-url';
    avsUrlInp.dataset.testid  = 'avs-url-input';
    avsUrlInp.value           = isExternalAVS ? pending.draftAVS : '';
    avsUrlInp.placeholder     = 'http://terminology.hl7.org/ValueSet/...';
    avsUrlInp.style.display   = isExternalAVS ? 'block' : 'none';
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
    openLabelSection.className    = 'at-modal-sub';
    openLabelSection.style.display = pending.draftType === 'open-choice' ? '' : 'none';

    const olSubLbl = document.createElement('div');
    olSubLbl.className        = 'at-modal-sub-lbl';
    olSubLbl.textContent      = 'Open label (Other prompt):';
    olSubLbl.dataset.tipTitle = 'Open-choice label';
    olSubLbl.dataset.tipBody  = 'Custom label for the free-text entry in this open-choice control. Replaces the default "Choose or type\u2026" placeholder.';
    olSubLbl.dataset.tipFhir  = 'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-openLabel';
    olSubLbl.dataset.tipSpec  = 'SDC';

    const olInp = document.createElement('input');
    olInp.type            = 'text';
    olInp.className       = 'at-modal-opt-inp';
    olInp.dataset.testid  = 'open-label-input';
    olInp.value           = pending.draftOpenLabel;
    olInp.placeholder     = 'e.g. Other (please specify)';
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
}
SECTION_REGISTRY.push(new ChoiceSection());

// ── 2. Reference resource type ────────────────────────────────────────────────

class ReferenceSection extends AnswerTypeSection {
  isVisible(type) { return type === 'reference'; }

  build(pending) {
    const section = document.createElement('div');
    section.className = 'at-modal-sub';

    const refLbl = document.createElement('div');
    refLbl.className        = 'at-modal-sub-lbl';
    refLbl.textContent      = 'Allowed resource type:';
    refLbl.dataset.tipTitle = 'Reference resource type';
    refLbl.dataset.tipBody  = 'Restricts which FHIR resource types are valid answer references. Leave blank to allow any type.';
    refLbl.dataset.tipFhir  = 'item.extension[questionnaire-referenceResource].valueCode';
    refLbl.dataset.tipSpec  = 'R4';

    const refSel = createCustomSelect({
      items: [
        { value: '', label: '\u2014 Any (unrestricted) \u2014' },
        ...[...new Set(FHIR_R4_TYPES)].sort().map(t => ({ value: t, label: t })),
      ],
      value:     pending.draftRefRes || '',
      className: 'at-modal-sub-sel sc-trigger--full',
      testid:    'ref-resource-sel',
      onChange:  v => { pending.draftRefRes = v; },
    });

    section.append(refLbl, refSel.el);
    return section;
  }
}
SECTION_REGISTRY.push(new ReferenceSection());

// ── 3. Quantity unit ──────────────────────────────────────────────────────────

class UnitSection extends AnswerTypeSection {
  isVisible(type) { return type === 'quantity'; }

  build(pending) {
    const section = document.createElement('div');
    section.className = 'at-modal-sub';

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

    section.append(unitLbl, unitSel.el);
    return section;
  }
}
SECTION_REGISTRY.push(new UnitSection());

// ── 4. Numeric constraints (integer / decimal) ────────────────────────────────

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
    numericGrid.appendChild(_numField('Min', 'min-value-input',  pending.draftMinValue, v => { pending.draftMinValue = v; }));
    numericGrid.appendChild(_numField('Max', 'max-value-input',  pending.draftMaxValue, v => { pending.draftMaxValue = v; }));

    // ── "Render as slider" toggle + step field ───────────────────────────────
    const sliderRow = document.createElement('div');
    sliderRow.className = 'at-modal-slider-row';

    const sliderChk = document.createElement('input');
    sliderChk.type            = 'checkbox';
    sliderChk.dataset.testid  = 'slider-toggle';
    sliderChk.checked         = pending.draftSliderStep !== '';

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
}
SECTION_REGISTRY.push(new NumericSection());

// ── 5. Entry format / placeholder hint ───────────────────────────────────────

class PlaceholderSection extends AnswerTypeSection {
  isVisible(type) { return ENTRY_FORMAT_TYPES.has(type); }

  build(pending) {
    const section = document.createElement('div');
    section.className = 'at-modal-sub';

    const placeholderLbl = document.createElement('div');
    placeholderLbl.className        = 'at-modal-sub-lbl at-modal-sub-lbl--tip';
    placeholderLbl.textContent      = 'Placeholder hint (entryFormat):';
    placeholderLbl.dataset.tipTitle = 'Entry Format';
    placeholderLbl.dataset.tipBody  = 'Text shown inside the input field before the user types. Guides the expected format (e.g. MM/DD/YYYY, (999) 999-9999). Exported as the sdc-questionnaire-entryFormat SDC extension.';
    placeholderLbl.dataset.tipFhir  = 'item.extension[sdc-questionnaire-entryFormat].valueString';
    placeholderLbl.dataset.tipSpec  = 'SDC';

    const placeholderInp = document.createElement('input');
    placeholderInp.type           = 'text';
    placeholderInp.className      = 'at-modal-placeholder-inp';
    placeholderInp.dataset.testid = 'entry-format-input';
    placeholderInp.value          = pending.draftEntryFormat;
    placeholderInp.placeholder    = 'e.g. MM/DD/YYYY, (999) 999-9999';
    placeholderInp.oninput = () => { pending.draftEntryFormat = placeholderInp.value; };

    section.append(placeholderLbl, placeholderInp);
    return section;
  }
}
SECTION_REGISTRY.push(new PlaceholderSection());

// ── 6. Choice orientation (radio only) ───────────────────────────────────────

class OrientationSection extends AnswerTypeSection {
  isVisible(type) { return type === 'radio'; }

  build(pending) {
    const section = document.createElement('div');
    section.className = 'at-modal-sub';

    const orientLbl = document.createElement('div');
    orientLbl.className        = 'at-modal-sub-lbl at-modal-sub-lbl--tip';
    orientLbl.textContent      = 'Choice orientation:';
    orientLbl.dataset.tipTitle = 'Choice Orientation';
    orientLbl.dataset.tipBody  = 'Controls whether radio buttons are stacked vertically or placed side by side horizontally. Exported as the questionnaire-choiceOrientation extension.';
    orientLbl.dataset.tipFhir  = 'item.extension[questionnaire-choiceOrientation].valueCode';
    orientLbl.dataset.tipSpec  = 'R4';

    const orientSel = createCustomSelect({
      items: [
        { value: '',           label: '\u2014 default \u2014' },
        { value: 'vertical',   label: 'Vertical (stacked)' },
        { value: 'horizontal', label: 'Horizontal (inline)' },
      ],
      value:     pending.draftOrientation,
      className: 'at-modal-sub-sel sc-trigger--full',
      testid:    'orientation-select',
      onChange:  v => { pending.draftOrientation = v; },
    });

    section.append(orientLbl, orientSel.el);
    return section;
  }
}
SECTION_REGISTRY.push(new OrientationSection());

// ── 7. Display category ───────────────────────────────────────────────────────

class DisplayCatSection extends AnswerTypeSection {
  isVisible(type) { return type === 'display'; }

  build(pending) {
    const section = document.createElement('div');
    section.className = 'at-modal-sub';

    const displayCatLbl = document.createElement('div');
    displayCatLbl.className        = 'at-modal-sub-lbl at-modal-sub-lbl--tip';
    displayCatLbl.textContent      = 'Display category:';
    displayCatLbl.dataset.tipTitle = 'Display Category';
    displayCatLbl.dataset.tipBody  = 'Controls the visual style of this display item. "Instructions" shows an info block, "Security" shows a warning notice, "Help" renders as a collapsible help toggle.';
    displayCatLbl.dataset.tipFhir  = 'item.extension[questionnaire-displayCategory].valueCodeableConcept.coding[0].code';
    displayCatLbl.dataset.tipSpec  = 'R4';

    const displayCatSel = createCustomSelect({
      items: [
        { value: '',             label: '\u2014 none \u2014' },
        { value: 'instructions', label: 'Instructions (\u2139 info block)' },
        { value: 'security',     label: 'Security notice (\u26A0 warning)' },
        { value: 'help',         label: 'Help (? collapsible)' },
      ],
      value:     pending.draftDisplayCategory,
      className: 'at-modal-sub-sel sc-trigger--full',
      testid:    'display-category-select',
      onChange:  v => { pending.draftDisplayCategory = v; },
    });

    section.append(displayCatLbl, displayCatSel.el);
    return section;
  }
}
SECTION_REGISTRY.push(new DisplayCatSection());

// ── 8. Attachment ─────────────────────────────────────────────────────────────

class AttachSection extends AnswerTypeSection {
  isVisible(type) { return type === 'attachment'; }

  build(pending) {
    const section = document.createElement('div');
    section.className = 'at-modal-sub';

    const maxSizeLbl = document.createElement('div');
    maxSizeLbl.className        = 'at-modal-sub-lbl at-modal-sub-lbl--tip';
    maxSizeLbl.textContent      = 'Max file size (MB):';
    maxSizeLbl.dataset.tipTitle = 'Maximum file size';
    maxSizeLbl.dataset.tipBody  = 'Maximum allowed file size in megabytes. Validated when the user selects a file in preview. Exported as the maxSize FHIR extension (valueDecimal).';
    maxSizeLbl.dataset.tipFhir  = 'item.extension[maxSize].valueDecimal';
    maxSizeLbl.dataset.tipSpec  = 'R4';

    const maxSizeInp = document.createElement('input');
    maxSizeInp.type           = 'number';
    maxSizeInp.min            = '0.01';
    maxSizeInp.step           = 'any';
    maxSizeInp.className      = 'at-modal-num-inp';
    maxSizeInp.dataset.testid = 'max-file-size-input';
    maxSizeInp.value          = pending.draftMaxFileSizeMB;
    maxSizeInp.placeholder    = 'e.g. 5';
    maxSizeInp.oninput = () => { pending.draftMaxFileSizeMB = maxSizeInp.value; };

    const mimeTypesLbl = document.createElement('div');
    mimeTypesLbl.className        = 'at-modal-sub-lbl at-modal-sub-lbl--tip';
    mimeTypesLbl.textContent      = 'Allowed MIME types:';
    mimeTypesLbl.dataset.tipTitle = 'Allowed MIME types';
    mimeTypesLbl.dataset.tipBody  = 'Comma-separated list of accepted MIME types (e.g. image/jpeg, application/pdf). Sets the accept attribute on the file input. Exported as one mimeType extension entry per value.';
    mimeTypesLbl.dataset.tipFhir  = 'item.extension[mimeType].valueCode';
    mimeTypesLbl.dataset.tipSpec  = 'R4';

    const mimeTypesInp = document.createElement('input');
    mimeTypesInp.type           = 'text';
    mimeTypesInp.className      = 'at-modal-placeholder-inp';
    mimeTypesInp.dataset.testid = 'mime-types-input';
    mimeTypesInp.value          = pending.draftMimeTypes;
    mimeTypesInp.placeholder    = 'e.g. image/*,application/pdf';
    mimeTypesInp.oninput = () => { pending.draftMimeTypes = mimeTypesInp.value; };

    section.append(maxSizeLbl, maxSizeInp, mimeTypesLbl, mimeTypesInp);
    return section;
  }
}
SECTION_REGISTRY.push(new AttachSection());
