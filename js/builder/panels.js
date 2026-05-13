// ── Action panel builders ─────────────────────────────────────────────────────
// buildXxxPanel(node, panelEl, linkEl, setActive, ctx: BuilderCtx)  — see ctx.js
//
// Each panel is keyed and toggled by the action links defined in node-item/group.
import { escAttr, parseOptions } from '../utils.js';
import { getAllItems, buildSuccessValueUI, triggerCalcRecalc } from './_shared.js';
import { values } from '../state.js';

// ── Panel factory helper ──────────────────────────────────────────────────────
export function addPanel(key, buildFn, div, panels) {
  const p = document.createElement('div');
  p.className = 'hidden-panel';
  p.style.display = 'none';
  buildFn(p);
  panels[key] = p;
  div.appendChild(p);
}

// ── Visibility panel ──────────────────────────────────────────────────────────
export function buildVisPanel(node, p, visLink, setActive, ctx) {
  const friendly = document.createElement('div');
  friendly.className = 'panel-vis-hint';
  const updateFriendly = () => {
    friendly.innerHTML = node._enableWhenText && node.visibilityRule
      ? '\uD83D\uDD12 <b>Shown when:</b> ' + escAttr(node._enableWhenText)
      : '';
    friendly.style.display = (node._enableWhenText && node.visibilityRule) ? 'block' : 'none';
  };
  updateFriendly();
  p.appendChild(friendly);

  // Visual condition builder
  const builderWrap = document.createElement('div');
  builderWrap.className = 'vis-builder';
  const items = getAllItems(ctx.tree).filter(it => it.id !== node.id);

  const qSel = document.createElement('select');
  qSel.className = 'vis-builder-sel';
  const blank = document.createElement('option');
  blank.value = ''; blank.textContent = '\u2014 pick a question \u2014';
  qSel.appendChild(blank);
  for (const it of items) {
    const opt = document.createElement('option');
    opt.value = it.id; opt.textContent = it.label;
    opt.dataset.itype = it.itemType; opt.dataset.opts = it.options || '';
    qSel.appendChild(opt);
  }

  const opSel = document.createElement('select');
  opSel.className = 'vis-builder-sel vis-builder-op';
  const valWrap = document.createElement('span');

  const preview = document.createElement('div');
  preview.className = 'vis-builder-preview';
  preview.style.display = 'none';

  const applyBtn = document.createElement('button');
  applyBtn.type = 'button';
  applyBtn.className = 'vis-builder-apply';
  applyBtn.textContent = 'Use \u2192';

  const rebuildValueInput = (itype, opts) => {
    valWrap.innerHTML = '';
    opSel.innerHTML = '';
    if (itype === 'checkbox') {
      ['== true|is Yes (checked)', '== false|is No (unchecked)'].forEach(s => {
        const [v, l] = s.split('|');
        const o = document.createElement('option'); o.value = v; o.textContent = l; opSel.appendChild(o);
      });
    } else {
      ['==|equals', '!=|not equals', '>|greater than', '<|less than'].forEach(s => {
        const [v, l] = s.split('|');
        const o = document.createElement('option'); o.value = v; o.textContent = l; opSel.appendChild(o);
      });
      if (itype === 'select' && opts) {
        const sel2 = document.createElement('select');
        sel2.className = 'vis-builder-sel';
        parseOptions(opts).forEach(({ code, display }) => {
          const opt = document.createElement('option'); opt.value = code; opt.textContent = display; sel2.appendChild(opt);
        });
        valWrap.appendChild(sel2);
      } else {
        const inp2 = document.createElement('input');
        inp2.type = itype === 'number' ? 'number' : 'text';
        inp2.placeholder = 'value';
        inp2.className = 'panel-inp-sm';
        valWrap.appendChild(inp2);
      }
    }
  };

  const updatePreview = () => {
    const qid = qSel.value; if (!qid) { preview.style.display = 'none'; return; }
    const op  = opSel.value;
    const selOpt = qSel.options[qSel.selectedIndex];
    const itype = selOpt.dataset.itype;
    let valPart = '';
    if (itype === 'checkbox') {
      valPart = op;
    } else {
      const inp2 = valWrap.querySelector('input,select');
      const raw  = inp2 ? inp2.value : '';
      valPart = op + ' ' + (isNaN(raw) || raw === '' ? '\'' + raw.replace(/'/g, "\\'") + '\'' : raw);
    }
    const expr = `values['${qid}'] ${valPart}`;
    preview.textContent = expr;
    preview.style.display = 'block';
    applyBtn.onclick = () => {
      node.visibilityRule = expr;
      rawInp.value = expr;
      setActive(visLink, !!expr);
    };
  };

  qSel.onchange = () => {
    const selOpt = qSel.options[qSel.selectedIndex];
    if (!selOpt || !selOpt.value) { preview.style.display = 'none'; return; }
    rebuildValueInput(selOpt.dataset.itype, selOpt.dataset.opts);
    opSel.onchange = updatePreview;
    const inp2 = valWrap.querySelector('input,select');
    if (inp2) inp2.oninput = inp2.onchange = updatePreview;
    updatePreview();
  };

  builderWrap.appendChild(qSel);
  builderWrap.appendChild(opSel);
  builderWrap.appendChild(valWrap);
  builderWrap.appendChild(preview);
  builderWrap.appendChild(applyBtn);
  p.appendChild(builderWrap);

  const rawLbl = document.createElement('div');
  rawLbl.className = 'panel-raw-lbl';
  rawLbl.textContent = 'or type JS directly:';
  p.appendChild(rawLbl);

  const rawInp = document.createElement('input');
  rawInp.type = 'text';
  rawInp.value = node.visibilityRule || '';
  rawInp.oninput = () => {
    node.visibilityRule = rawInp.value;
    if (!rawInp.value) node._enableWhenText = '';
    updateFriendly();
    setActive(visLink, !!rawInp.value);
  };
  p.appendChild(rawInp);
}

// ── Mandatory panel ───────────────────────────────────────────────────────────
export function buildMandPanel(node, p, mandLink, setActive) {
  const label = document.createElement('label');
  label.className = 'panel-mand-label';
  label.textContent = 'Required:';
  const sel = document.createElement('select');
  sel.className = 'panel-mand-sel';
  [['null', 'Not set (acts as required)'], ['true', 'Yes \u2014 required'], ['false', 'No \u2014 optional']].forEach(([val, text]) => {
    const o = document.createElement('option');
    o.value = val; o.textContent = text;
    if (String(node.mandatory) === val) o.selected = true;
    sel.appendChild(o);
  });
  sel.onchange = () => {
    node.mandatory = sel.value === 'null' ? null : sel.value === 'true';
    setActive(mandLink, node.mandatory === true);
  };
  label.appendChild(sel);
  p.appendChild(label);
}

// ── Condition panel ───────────────────────────────────────────────────────────
export function buildCondPanel(node, p, condLink, setActive, isGroup) {
  p.innerHTML = isGroup
    ? 'Condition rule \u2014 if false, group is N/A (disabled, not FAIL):<br>'
      + '<small class="panel-hint">Variables: age, gender, bmi, pregnant, smoker, proc, comorb</small>'
      + '<input type="text" value="' + escAttr(node.conditionRule) + '">'
    : 'Condition rule (age, bmi, proc, comorb):<br>'
      + '<input type="text" value="' + escAttr(node.conditionRule) + '">';
  p.querySelector('input').oninput = function () {
    node.conditionRule = this.value;
    setActive(condLink, !!this.value);
  };
}

// ── Type + Options panel (item only) ─────────────────────────────────────────
export function buildTypePanel(node, p) {
  const typeRow = document.createElement('div');
  typeRow.textContent = 'Type: ';
  const typeSelect = document.createElement('select');
  typeSelect.className = 'panel-type-sel';
  for (const t of ['text', 'number', 'date', 'url', 'attachment', 'checkbox', 'select', 'open-choice', 'radio', 'reference', 'quantity', 'display']) {
    const opt = document.createElement('option');
    opt.value = t; opt.textContent = t;
    if (node.itemType === t) opt.selected = true;
    typeSelect.appendChild(opt);
  }
  typeRow.appendChild(typeSelect);
  p.appendChild(typeRow);

  const optionsDiv = document.createElement('div');
  optionsDiv.className = 'panel-sub-section';
  optionsDiv.style.display = (node.itemType === 'select' || node.itemType === 'open-choice') ? 'block' : 'none';
  optionsDiv.innerHTML = 'Options (comma-separated):<br>'
    + '<input type="text" value="' + escAttr(node.options) + '">';
  optionsDiv.querySelector('input').oninput = function () { node.options = this.value; };
  p.appendChild(optionsDiv);

  const refResDiv = document.createElement('div');
  refResDiv.className = 'panel-sub-section';
  refResDiv.style.display = node.itemType === 'reference' ? 'block' : 'none';
  const refResLbl = document.createElement('div');
  refResLbl.textContent = 'Allowed resource type:';
  refResLbl.className = 'panel-sub-lbl';
  const refResSel = document.createElement('select');
  refResSel.className = 'panel-sub-sel';
  const FHIR_R4_TYPES = ['Patient','Practitioner','PractitionerRole','RelatedPerson','Organization',
    'Encounter','EpisodeOfCare','Condition','Observation','DiagnosticReport','Procedure',
    'MedicationRequest','MedicationStatement','Medication','AllergyIntolerance','Immunization',
    'CarePlan','CareTeam','Goal','ServiceRequest','Appointment','Slot','Schedule',
    'HealthcareService','Location','Device','Specimen','ImagingStudy','Media',
    'DocumentReference','Composition','QuestionnaireResponse','Questionnaire',
    'Coverage','Claim','ExplanationOfBenefit','Account','Invoice','ChargeItem',
    'ResearchStudy','ResearchSubject','Group','Person','Patient','Account',
    'ActivityDefinition','AdverseEvent','AppointmentResponse','AuditEvent','Basic',
    'Binary','BiologicallyDerivedProduct','BodyStructure','Bundle','CapabilityStatement',
    'ChargeItemDefinition','ClaimResponse','ClinicalImpression','CodeSystem','Communication',
    'CommunicationRequest','CompartmentDefinition','ConceptMap','Consent','Contract',
    'CoverageEligibilityRequest','CoverageEligibilityResponse','DetectedIssue','DeviceDefinition',
    'DeviceMetric','DeviceRequest','DeviceUseStatement','DocumentManifest','Endpoint',
    'EnrollmentRequest','EnrollmentResponse','EventDefinition','FamilyMemberHistory',
    'Flag','GuidanceResponse','ImmunizationEvaluation','ImmunizationRecommendation',
    'ImplementationGuide','InsurancePlan','Library','Linkage','List','Measure',
    'MeasureReport','MessageDefinition','MessageHeader','MolecularSequence','NamingSystem',
    'NutritionOrder','ObservationDefinition','OperationDefinition','OperationOutcome',
    'OrganizationAffiliation','Parameters','PaymentNotice','PaymentReconciliation',
    'PlanDefinition','Provenance','RequestGroup','RiskAssessment','SearchParameter',
    'Slot','SpecimenDefinition','StructureDefinition','StructureMap','Subscription',
    'Substance','SupplyDelivery','SupplyRequest','Task','TerminologyCapabilities',
    'TestReport','TestScript','ValueSet','VerificationResult','VisionPrescription'];
  // Deduplicate and sort
  const uniqueTypes = [...new Set(FHIR_R4_TYPES)].sort();
  const blankOpt = document.createElement('option');
  blankOpt.value = ''; blankOpt.textContent = '— Any (unrestricted) —';
  if (!node.referenceResource) blankOpt.selected = true;
  refResSel.appendChild(blankOpt);
  for (const t of uniqueTypes) {
    const o = document.createElement('option');
    o.value = t; o.textContent = t;
    if (node.referenceResource === t) o.selected = true;
    refResSel.appendChild(o);
  }
  refResSel.onchange = () => {
    node.referenceResource = refResSel.value || undefined;
  };
  refResDiv.appendChild(refResLbl);
  refResDiv.appendChild(refResSel);
  p.appendChild(refResDiv);

  // ── Quantity: default unit ──
  const BUILDER_UNITS = [
    'kg','g','mg','[lb_av]','[oz_av]',
    'cm','m','mm','[in_i]','[ft_i]',
    'mL','L','dL',
    'Cel','[degF]',
    'mm[Hg]','kPa',
    'kg/m2','%',
    '/min','{beats}/min','{breaths}/min',
    'min','h','d','wk','mo','a',
    'mg/dL','mmol/L','g/dL','meq/L','U/L','[iU]',
  ];
  const qUnitDiv = document.createElement('div');
  qUnitDiv.className = 'panel-sub-section';
  qUnitDiv.style.display = node.itemType === 'quantity' ? 'block' : 'none';
  const qUnitLbl = document.createElement('div');
  qUnitLbl.textContent = 'Default unit:';
  qUnitLbl.className = 'panel-sub-lbl';
  const qUnitSel = document.createElement('select');
  qUnitSel.className = 'panel-sub-sel';
  const qUnitBlank = document.createElement('option');
  qUnitBlank.value = ''; qUnitBlank.textContent = '— none —';
  if (!node.quantityUnit) qUnitBlank.selected = true;
  qUnitSel.appendChild(qUnitBlank);
  for (const u of BUILDER_UNITS) {
    const o = document.createElement('option');
    o.value = u; o.textContent = u;
    if (node.quantityUnit === u) o.selected = true;
    qUnitSel.appendChild(o);
  }
  qUnitSel.onchange = () => { node.quantityUnit = qUnitSel.value || undefined; };
  qUnitDiv.appendChild(qUnitLbl);
  qUnitDiv.appendChild(qUnitSel);
  p.appendChild(qUnitDiv);

  const successDiv = document.createElement('div');
  p.appendChild(successDiv);
  buildSuccessValueUI(node, successDiv);

  typeSelect.onchange = () => {
    node.itemType = typeSelect.value;
    optionsDiv.style.display = (node.itemType === 'select' || node.itemType === 'open-choice') ? 'block' : 'none';
    refResDiv.style.display  = node.itemType === 'reference' ? 'block' : 'none';
    qUnitDiv.style.display   = node.itemType === 'quantity'  ? 'block' : 'none';
    buildSuccessValueUI(node, successDiv);
  };
}

// ── Expression panel ──────────────────────────────────────────────────────────
export function buildExprPanel(node, p, exprLink, setActive) {
  const lbl = document.createElement('div');
  lbl.className = 'panel-expr-lbl';
  lbl.textContent = 'FHIRPath calculatedExpression:';
  p.appendChild(lbl);

  const ta = document.createElement('textarea');
  ta.rows = 4;
  ta.className = 'panel-ta';
  ta.value = node._calculatedExpr || '';
  ta.placeholder = '%resource.item.where(linkId=\'...\')';
  ta.oninput = () => {
    node._calculatedExpr = ta.value.trim() || undefined;
    setActive(exprLink, !!ta.value.trim());
    triggerCalcRecalc();
  };
  p.appendChild(ta);

  const roRow = document.createElement('label');
  roRow.className = 'panel-ro-row';
  const roCb = document.createElement('input');
  roCb.type = 'checkbox';
  roCb.checked = !!node._readOnly;
  roCb.onchange = () => { node._readOnly = roCb.checked; triggerCalcRecalc(); };
  roRow.appendChild(roCb);
  roRow.appendChild(document.createTextNode('readOnly (computed by expression, not user-editable)'));
  p.appendChild(roRow);
}

// ── Style / Appearance panel ──────────────────────────────────────────────────
export function buildStylePanel(node, p, styleLink, setActive, ctx) {
  const styleRow = (label, fn) => {
    const row = document.createElement('div');
    row.className = 'panel-style-row';
    const lbl = document.createElement('label');
    lbl.className = 'panel-style-lbl';
    lbl.textContent = label;
    row.appendChild(lbl);
    row.appendChild(fn());
    p.appendChild(row);
  };

  const parseStyle = () => {
    const s = node._renderStyle || '';
    return {
      bold:   /font-weight\s*:\s*bold/i.test(s),
      italic: /font-style\s*:\s*italic/i.test(s),
      color:  (s.match(/(?:^|;)\s*color\s*:\s*([^;]+)/i) || [])[1]?.trim() || '',
    };
  };

  const buildStyle = (bold, italic, color) => [
    'font-weight: ' + (bold   ? 'bold'   : 'normal'),
    'font-style: '  + (italic ? 'italic' : 'normal'),
    ...(color ? ['color: ' + color] : []),
  ].join('; ');

  const cur = parseStyle();
  const boldCb   = Object.assign(document.createElement('input'), { type: 'checkbox', checked: cur.bold });
  const italicCb = Object.assign(document.createElement('input'), { type: 'checkbox', checked: cur.italic });
  const colorInp = Object.assign(document.createElement('input'), {
    type: 'color',
    value: cur.color?.startsWith('#') ? cur.color : '#000000',
    className: 'panel-color-inp',
  });
  const colorClear = Object.assign(document.createElement('button'), {
    type: 'button', textContent: '\u2715',
    className: 'panel-color-clear',
    title: 'Remove color',
  });

  const rawInp = document.createElement('input');
  rawInp.type = 'text';
  rawInp.value = node._renderStyle || '';
  rawInp.placeholder = 'e.g. font-weight: bold; color: blue';
  rawInp.className = 'panel-raw-inp';

  const sync = () => {
    const color = colorClear._cleared ? '' : (cur.color || colorInp.value);
    const s = buildStyle(boldCb.checked, italicCb.checked, color);
    node._renderStyle = s;
    rawInp.value = s;
    ctx.formTick.value++;
  };
  const syncAndMark = () => { sync(); setActive(styleLink, !!node._renderStyle); };

  boldCb.onchange   = syncAndMark;
  italicCb.onchange = syncAndMark;
  colorInp.oninput  = () => { cur.color = colorInp.value; colorClear._cleared = false; syncAndMark(); };
  colorClear.onclick = () => { colorClear._cleared = true; cur.color = ''; colorInp.value = '#000000'; sync(); };
  rawInp.oninput = () => {
    node._renderStyle = rawInp.value;
    const p2 = parseStyle();
    boldCb.checked   = p2.bold;
    italicCb.checked = p2.italic;
    if (p2.color?.startsWith('#')) colorInp.value = p2.color;
    setActive(styleLink, !!rawInp.value);
    ctx.formTick.value++;
  };

  styleRow('Bold',   () => boldCb);
  styleRow('Italic', () => italicCb);

  const colorRow = document.createElement('div');
  colorRow.className = 'panel-style-row';
  const colorLbl = document.createElement('label');
  colorLbl.className = 'panel-style-lbl';
  colorLbl.textContent = 'Color';
  colorRow.appendChild(colorLbl);
  colorRow.appendChild(colorInp);
  colorRow.appendChild(colorClear);
  p.appendChild(colorRow);

  const rawLbl = document.createElement('div');
  rawLbl.className = 'panel-raw-lbl panel-raw-lbl--sm';
  rawLbl.textContent = 'raw CSS:';
  p.appendChild(rawLbl);
  p.appendChild(rawInp);
}

// ── Default value (item.initial[]) panel ─────────────────────────────────────
export function buildInitialPanel(node, p, initLink, setActive) {
  const hint = document.createElement('div');
  hint.className = 'panel-hint';
  hint.textContent = 'Pre-filled when the form loads. User can edit unless readOnly.';
  p.appendChild(hint);

  const wrap = document.createElement('div');
  wrap.className = 'panel-sub-section';
  p.appendChild(wrap);

  const render = () => {
    wrap.innerHTML = '';
    const itype = node.itemType;

    if (itype === 'display' || itype === 'attachment') {
      const na = document.createElement('span');
      na.className = 'panel-hint';
      na.textContent = 'Not applicable for this item type.';
      wrap.appendChild(na);
      return;
    }

    // Header row: label + clear link on the right
    const hdr = document.createElement('div');
    hdr.className = 'panel-initial-hdr';
    const hdrLbl = document.createElement('span');
    hdrLbl.textContent = 'Default value:';
    hdr.appendChild(hdrLbl);
    const clearLink = document.createElement('a');
    clearLink.href = '#';
    clearLink.className = 'panel-initial-clear';
    clearLink.textContent = '× clear';
    clearLink.style.display = (node._initialValue !== undefined && node._initialValue !== '') ? '' : 'none';
    clearLink.addEventListener('click', e => {
      e.preventDefault();
      delete node._initialValue;
      delete values[node.id];
      setActive(initLink, false);
      triggerCalcRecalc();
      render();
    });
    hdr.appendChild(clearLink);
    wrap.appendChild(hdr);

    let ctrl;
    if (itype === 'checkbox') {
      ctrl = document.createElement('select');
      ctrl.className = 'panel-type-sel';
      [['', '— none —'], ['true', 'Checked (Yes)'], ['false', 'Unchecked (No)']].forEach(([v, l]) => {
        const o = document.createElement('option');
        o.value = v; o.textContent = l;
        const cur = node._initialValue;
        if ((v === '' && cur === undefined) || String(cur) === v) o.selected = true;
        ctrl.appendChild(o);
      });
      ctrl.onchange = () => {
        if (!ctrl.value) { delete node._initialValue; delete values[node.id]; }
        else { node._initialValue = ctrl.value === 'true'; values[node.id] = node._initialValue; }
        setActive(initLink, node._initialValue !== undefined && node._initialValue !== '');
        clearLink.style.display = node._initialValue !== undefined ? '' : 'none';
        triggerCalcRecalc();
      };
    } else if (itype === 'select' || itype === 'radio' || itype === 'open-choice') {
      ctrl = document.createElement('select');
      ctrl.className = 'panel-type-sel';
      const blank = document.createElement('option'); blank.value = ''; blank.textContent = '— none —';
      if (!node._initialValue) blank.selected = true;
      ctrl.appendChild(blank);
      parseOptions(node.options || '').forEach(({ code, display }) => {
        const o = document.createElement('option'); o.value = code; o.textContent = display || code;
        if (node._initialValue === code) o.selected = true;
        ctrl.appendChild(o);
      });
      ctrl.onchange = () => {
        node._initialValue = ctrl.value || undefined;
        if (node._initialValue) values[node.id] = node._initialValue; else delete values[node.id];
        setActive(initLink, !!node._initialValue);
        clearLink.style.display = node._initialValue ? '' : 'none';
        triggerCalcRecalc();
      };
    } else if (itype === 'date') {
      ctrl = document.createElement('input');
      ctrl.type = 'date';
      ctrl.className = 'panel-inp-sm';
      ctrl.value = node._initialValue || '';
      ctrl.onchange = () => {
        node._initialValue = ctrl.value || undefined;
        if (node._initialValue) values[node.id] = node._initialValue; else delete values[node.id];
        setActive(initLink, !!node._initialValue);
        clearLink.style.display = node._initialValue ? '' : 'none';
        triggerCalcRecalc();
      };
    } else if (itype === 'number' || itype === 'quantity') {
      ctrl = document.createElement('input');
      ctrl.type = 'number';
      ctrl.className = 'panel-inp-sm';
      ctrl.value = node._initialValue !== undefined ? node._initialValue : '';
      ctrl.oninput = () => {
        node._initialValue = ctrl.value !== '' ? ctrl.value : undefined;
        if (node._initialValue !== undefined) values[node.id] = node._initialValue; else delete values[node.id];
        setActive(initLink, node._initialValue !== undefined);
        clearLink.style.display = node._initialValue !== undefined ? '' : 'none';
        triggerCalcRecalc();
      };
    } else {
      // text, url, reference, open-choice freetext fallback
      ctrl = document.createElement('input');
      ctrl.type = 'text';
      ctrl.className = 'panel-inp-sm';
      ctrl.value = node._initialValue !== undefined ? String(node._initialValue) : '';
      ctrl.oninput = () => {
        node._initialValue = ctrl.value || undefined;
        if (node._initialValue) values[node.id] = node._initialValue; else delete values[node.id];
        setActive(initLink, !!node._initialValue);
        clearLink.style.display = node._initialValue ? '' : 'none';
        triggerCalcRecalc();
      };
    }

    wrap.appendChild(ctrl);
  };

  render();

  // Re-render the control when itemType changes (via Type panel → typeSelect.onchange fires renderItem)
  // We simply watch: if the panel is open and itemType differs, re-render.
  // Since the whole node card is rebuilt on type change, this is handled automatically.
}
