// ── Action panel builders ─────────────────────────────────────────────────────
// buildXxxPanel(node, panelEl, linkEl, setActive, ctx: BuilderCtx)  — see ctx.js
//
// Each panel is keyed and toggled by the action links defined in node-item/group.
import { escAttr, parseOptions } from '../utils.js';
import { getAllItems, triggerCalcRecalc } from './_shared.js';

// ── Panel factory helper ──────────────────────────────────────────────────────
export function addPanel(key, buildFn, div, panels) {
  const p = document.createElement('div');
  p.className = 'hidden-panel';
  p.style.display = 'none';
  buildFn(p);
  panels[key] = p;
  div.appendChild(p);
}

// ── Custom question picker (styled dropdown, handles long titles) ────────────
function buildQuestionSelect(allItems, selectedId, onSelect) {
  const wrap = document.createElement('div');
  wrap.className = 'vis-q-sel';

  const trigger = document.createElement('div');
  trigger.className = 'vis-q-sel-trigger';
  const found = allItems.find(it => it.id === selectedId);
  trigger.textContent = found ? found.label : '\u2014 question \u2014';
  trigger.title = found ? found.id : '';

  let dropEl = null;

  const close = () => {
    if (dropEl) { dropEl.remove(); dropEl = null; }
    document.removeEventListener('mousedown', onOutside, true);
  };

  const onOutside = e => {
    if (!wrap.contains(e.target)) close();
  };

  trigger.addEventListener('click', e => {
    e.stopPropagation();
    if (dropEl) { close(); return; }

    dropEl = document.createElement('div');
    dropEl.className = 'vis-q-sel-drop';

    const blank = document.createElement('div');
    blank.className = 'vis-q-sel-opt' + (!selectedId ? ' vis-q-sel-opt--sel' : '');
    blank.textContent = '\u2014 question \u2014';
    blank.addEventListener('mousedown', () => {
      trigger.textContent = '\u2014 question \u2014';
      trigger.title = '';
      onSelect('', null);
      close();
    });
    dropEl.appendChild(blank);

    for (const it of allItems) {
      const opt = document.createElement('div');
      opt.className = 'vis-q-sel-opt' + (it.id === selectedId ? ' vis-q-sel-opt--sel' : '');
      opt.textContent = it.label;
      opt.title = it.id;
      opt.addEventListener('mousedown', () => {
        trigger.textContent = it.label;
        trigger.title = it.id;
        onSelect(it.id, it);
        close();
      });
      dropEl.appendChild(opt);
    }

    wrap.appendChild(dropEl);
    setTimeout(() => document.addEventListener('mousedown', onOutside, true), 0);
  });

  wrap.appendChild(trigger);
  return wrap;
}

// ── Visibility panel (FHIR enableWhen) ───────────────────────────────────────
export function buildVisPanel(node, p, visLink, setActive, ctx) {
  if (!Array.isArray(node.enableWhen)) node.enableWhen = [];
  if (!node.enableBehavior) node.enableBehavior = 'all';
  if (node.enableWhenExpression === undefined) node.enableWhenExpression = '';

  const allItems = getAllItems(ctx.tree).filter(it => it.id !== node.id);

  const syncActive = () => {
    setActive(visLink, node.enableWhen.length > 0 || !!node.enableWhenExpression);
  };

  // ── AND / ANY behavior selector ──────────────────────────────────────────
  const behaviorRow = document.createElement('div');
  behaviorRow.className = 'vis-behavior-row';
  behaviorRow.appendChild(Object.assign(document.createElement('span'), { textContent: 'Show when ' }));
  const behaviorSel = document.createElement('select');
  behaviorSel.className = 'vis-behavior-sel';
  [['all', 'ALL (AND)'], ['any', 'ANY (OR)']].forEach(([v, l]) => {
    const o = document.createElement('option');
    o.value = v; o.textContent = l;
    if (node.enableBehavior === v) o.selected = true;
    behaviorSel.appendChild(o);
  });
  behaviorSel.onchange = () => { node.enableBehavior = behaviorSel.value; };
  behaviorRow.appendChild(behaviorSel);
  behaviorRow.appendChild(Object.assign(document.createElement('span'), { textContent: ' conditions are met:' }));
  p.appendChild(behaviorRow);

  // ── Condition list ────────────────────────────────────────────────────────
  const condList = document.createElement('div');
  condList.className = 'vis-cond-list';
  p.appendChild(condList);

  const renderCondRow = (ew, idx) => {
    const row = document.createElement('div');
    row.className = 'vis-cond-row';

    const qWidget = buildQuestionSelect(allItems, ew.question || '', (id, it) => {
      ew.question = id;
      delete ew.answerBoolean; delete ew.answerString; delete ew.answerCoding;
      delete ew.answerDecimal; delete ew.answerInteger; delete ew.answerDate;
      ew.operator = '=';
      if (it) buildOpVal(it.itemType || '', it.options || '');
      else opSel.innerHTML = '<option value="">\u2014</option>';
      syncActive();
    });

    const opSel = document.createElement('select');
    opSel.className = 'vis-cond-op';

    const valWrap = document.createElement('span');
    valWrap.className = 'vis-cond-val';

    const rmBtn = document.createElement('button');
    rmBtn.type = 'button';
    rmBtn.className = 'vis-cond-rm';
    rmBtn.textContent = '\u2715';
    rmBtn.onclick = () => {
      node.enableWhen.splice(idx, 1);
      condList.innerHTML = '';
      node.enableWhen.forEach((e, i) => condList.appendChild(renderCondRow(e, i)));
      syncActive();
    };

    const buildOpVal = (itype, opts) => {
      opSel.innerHTML = '';
      valWrap.innerHTML = '';

      // Adds "has answer" / "has no answer" to any operator dropdown
      const _addExistsOpts = () => {
        [['exists|true', 'has answer'], ['exists|false', 'has no answer']].forEach(([v, l]) => {
          const o = document.createElement('option'); o.value = v; o.textContent = l;
          opSel.appendChild(o);
        });
      };

      // Wraps opSel.onchange: if user picks exists, clears valWrap and writes to ew;
      // if user switches away from exists, rebuilds the full row via buildOpVal.
      const _wrapChange = () => {
        opSel.onchange = () => {
          if (opSel.value.startsWith('exists|')) {
            ew.operator = 'exists';
            ew.answerBoolean = opSel.value.endsWith('|true');
            delete ew.answerString; delete ew.answerCoding;
            delete ew.answerDecimal; delete ew.answerInteger; delete ew.answerDate;
            valWrap.innerHTML = '';
          } else {
            const sel = opSel.value;
            ew.operator = sel;
            delete ew.answerBoolean;
            buildOpVal(itype, opts);
            opSel.value = sel;
          }
        };
      };

      if (itype === 'checkbox') {
        [['=|true', 'is Yes (checked)'], ['=|false', 'is No (unchecked)'],
         ['exists|true', 'has answer'], ['exists|false', 'has no answer']].forEach(([v, l]) => {
          const o = document.createElement('option'); o.value = v; o.textContent = l;
          opSel.appendChild(o);
        });
        opSel.value = ew.operator + '|' + (ew.answerBoolean === false ? 'false' : 'true');
        opSel.onchange = () => {
          const [op, boolStr] = opSel.value.split('|');
          ew.operator = op;
          ew.answerBoolean = boolStr === 'true';
          delete ew.answerString; delete ew.answerCoding; delete ew.answerDecimal; delete ew.answerInteger; delete ew.answerDate;
        };
      } else if (itype === 'select' || itype === 'radio' || itype === 'open-choice') {
        [['=', '='], ['!=', '\u2260']].forEach(([v, l]) => {
          const o = document.createElement('option'); o.value = v; o.textContent = l;
          opSel.appendChild(o);
        });
        _addExistsOpts();
        if (ew.operator === 'exists') {
          opSel.value = 'exists|' + (ew.answerBoolean === false ? 'false' : 'true');
        } else {
          opSel.value = ew.operator || '=';
          if (opts) {
            const valSel = document.createElement('select');
            valSel.className = 'vis-cond-val-inp';
            parseOptions(opts).forEach(({ code, display }) => {
              const o = document.createElement('option');
              o.value = code; o.textContent = display || code;
              if (ew.answerCoding && ew.answerCoding.code === code) o.selected = true;
              valSel.appendChild(o);
            });
            valSel.onchange = () => {
              const selOpt = valSel.options[valSel.selectedIndex];
              ew.answerCoding = { code: valSel.value, display: selOpt.textContent };
            };
            valWrap.appendChild(valSel);
          } else {
            const inp = document.createElement('input');
            inp.type = 'text'; inp.className = 'vis-cond-val-inp';
            inp.value = ew.answerCoding?.code || ew.answerString || '';
            inp.oninput = () => { ew.answerCoding = { code: inp.value }; delete ew.answerString; };
            valWrap.appendChild(inp);
          }
        }
        _wrapChange();
      } else if (itype === 'number' || itype === 'quantity') {
        [['=','='],['!=','\u2260'],['>','>'],['<','<'],['>=','\u2265'],['<=','\u2264']].forEach(([v, l]) => {
          const o = document.createElement('option'); o.value = v; o.textContent = l;
          opSel.appendChild(o);
        });
        _addExistsOpts();
        if (ew.operator === 'exists') {
          opSel.value = 'exists|' + (ew.answerBoolean === false ? 'false' : 'true');
        } else {
          opSel.value = ew.operator || '=';
          const inp = document.createElement('input');
          inp.type = 'number'; inp.className = 'vis-cond-val-inp';
          inp.value = ew.answerDecimal !== undefined ? ew.answerDecimal
            : ew.answerInteger !== undefined ? ew.answerInteger : '';
          inp.oninput = () => {
            const n = parseFloat(inp.value);
            if (!isNaN(n)) {
              if (Number.isInteger(n)) { ew.answerInteger = n; delete ew.answerDecimal; }
              else { ew.answerDecimal = n; delete ew.answerInteger; }
            }
          };
          valWrap.appendChild(inp);
        }
        _wrapChange();
      } else if (itype === 'date') {
        [['=','='],['!=','\u2260'],['>','>'],['<','<'],['>=','\u2265'],['<=','\u2264']].forEach(([v, l]) => {
          const o = document.createElement('option'); o.value = v; o.textContent = l;
          opSel.appendChild(o);
        });
        _addExistsOpts();
        if (ew.operator === 'exists') {
          opSel.value = 'exists|' + (ew.answerBoolean === false ? 'false' : 'true');
        } else {
          opSel.value = ew.operator || '=';
          const inp = document.createElement('input');
          inp.type = 'date'; inp.className = 'vis-cond-val-inp';
          inp.value = ew.answerDate || '';
          inp.oninput = () => { ew.answerDate = inp.value; };
          valWrap.appendChild(inp);
        }
        _wrapChange();
      } else {
        [['=','='],['!=','\u2260']].forEach(([v, l]) => {
          const o = document.createElement('option'); o.value = v; o.textContent = l;
          opSel.appendChild(o);
        });
        _addExistsOpts();
        if (ew.operator === 'exists') {
          opSel.value = 'exists|' + (ew.answerBoolean === false ? 'false' : 'true');
        } else {
          opSel.value = ew.operator || '=';
          const inp = document.createElement('input');
          inp.type = 'text'; inp.className = 'vis-cond-val-inp';
          inp.value = ew.answerString || '';
          inp.oninput = () => { ew.answerString = inp.value; delete ew.answerCoding; delete ew.answerDecimal; };
          valWrap.appendChild(inp);
        }
        _wrapChange();
      }
    };

    const selItem = allItems.find(it => it.id === ew.question);
    if (selItem) buildOpVal(selItem.itemType || '', selItem.options || '');
    else opSel.innerHTML = '<option value="">\u2014</option>';

    row.appendChild(qWidget);
    row.appendChild(opSel);
    row.appendChild(valWrap);
    row.appendChild(rmBtn);
    return row;
  };

  node.enableWhen.forEach((ew, i) => condList.appendChild(renderCondRow(ew, i)));

  // ── Add condition ─────────────────────────────────────────────────────────
  const addBtn = document.createElement('button');
  addBtn.type = 'button';
  addBtn.className = 'vis-add-btn';
  addBtn.textContent = '+ Add condition';
  addBtn.onclick = () => {
    const newEw = { question: '', operator: '=', answerBoolean: true };
    node.enableWhen.push(newEw);
    condList.appendChild(renderCondRow(newEw, node.enableWhen.length - 1));
    syncActive();
  };
  p.appendChild(addBtn);

  // ── FHIRPath expression (advanced) ────────────────────────────────────────
  const exprSep = document.createElement('div');
  exprSep.className = 'vis-expr-sep';
  exprSep.textContent = '\u2014 or FHIRPath expression (advanced) \u2014';
  p.appendChild(exprSep);

  const exprLbl = document.createElement('div');
  exprLbl.className = 'panel-raw-lbl panel-raw-lbl--sm';
  exprLbl.textContent = 'enableWhenExpression (SDC):';
  p.appendChild(exprLbl);

  const exprInp = document.createElement('input');
  exprInp.type = 'text';
  exprInp.className = 'panel-inp-sm';
  exprInp.style.width = '100%';
  exprInp.value = node.enableWhenExpression || '';
  exprInp.placeholder = "e.g. %age > 18 and %gender = 'male'";
  exprInp.oninput = () => { node.enableWhenExpression = exprInp.value; syncActive(); };
  p.appendChild(exprInp);

  syncActive();
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
  optionsDiv.style.display = (node.itemType === 'select' || node.itemType === 'open-choice' || node.itemType === 'radio') ? 'block' : 'none';
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

  typeSelect.onchange = () => {
    node.itemType = typeSelect.value;
    optionsDiv.style.display = (node.itemType === 'select' || node.itemType === 'open-choice' || node.itemType === 'radio') ? 'block' : 'none';
    refResDiv.style.display  = node.itemType === 'reference' ? 'block' : 'none';
    qUnitDiv.style.display   = node.itemType === 'quantity'  ? 'block' : 'none';
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

}

// ── Initial expression panel (sdc-questionnaire-initialExpression) ────────────
export function buildInitialExprPanel(node, p, link, setActive) {
  const hint = document.createElement('div');
  hint.className = 'panel-hint';
  hint.textContent = 'FHIRPath expression evaluated once to populate this field. Click \u21BA Re-init in the Variables panel to apply.';
  p.appendChild(hint);

  const lbl = document.createElement('div');
  lbl.className = 'panel-expr-lbl';
  lbl.textContent = 'sdc-questionnaire-initialExpression:';
  p.appendChild(lbl);

  const ta = document.createElement('textarea');
  ta.rows = 3;
  ta.className = 'panel-ta';
  ta.value = node._initialExpr || '';
  ta.placeholder = "e.g. %age > 18 or %today";
  ta.oninput = () => {
    node._initialExpr = ta.value.trim() || undefined;
    setActive(link, !!ta.value.trim());
  };
  p.appendChild(ta);
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
      // text: auto-growing textarea
      if (itype === 'text') {
        ctrl = document.createElement('textarea');
        ctrl.className = 'panel-inp-textarea';
        ctrl.rows = 1;
        const autoResize = () => { ctrl.style.height = 'auto'; ctrl.style.height = ctrl.scrollHeight + 'px'; };
        ctrl.value = node._initialValue !== undefined ? String(node._initialValue) : '';
        ctrl.oninput = () => {
          node._initialValue = ctrl.value || undefined;
          if (node._initialValue) values[node.id] = node._initialValue; else delete values[node.id];
          setActive(initLink, !!node._initialValue);
          clearLink.style.display = node._initialValue ? '' : 'none';
          triggerCalcRecalc();
          autoResize();
        };
        if (ctrl.value) autoResize();
      } else {
        // url, reference, open-choice freetext fallback
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
    }

    wrap.appendChild(ctrl);
  };

  render();

  // Re-render the control when itemType changes (via Type panel → typeSelect.onchange fires renderItem)
  // We simply watch: if the panel is open and itemType differs, re-render.
  // Since the whole node card is rebuilt on type change, this is handled automatically.
}

// ── Constraint panel (questionnaire-constraint, read-only display + expression editing) ────────
export function buildConstraintPanel(node, p, constraintLink, setActive) {
  if (!Array.isArray(node.constraint)) node.constraint = [];

  const syncActive = () => setActive(constraintLink, node.constraint.length > 0);

  const render = () => {
    p.innerHTML = '';

    if (node.constraint.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'panel-raw-lbl';
      empty.style.color = 'var(--c-text-2)';
      empty.textContent = 'No constraints. Add one below.';
      p.appendChild(empty);
    }

    node.constraint.forEach((c, idx) => {
      const card = document.createElement('div');
      card.className = 'constraint-card';

      const hdr = document.createElement('div');
      hdr.className = 'constraint-card-hdr';

      const keyLbl = document.createElement('span');
      keyLbl.className = 'constraint-key';
      keyLbl.textContent = c.key || '(no key)';
      hdr.appendChild(keyLbl);

      const sevSel = document.createElement('select');
      sevSel.className = 'constraint-sev-sel';
      [['error', 'error ❌'], ['warning', 'warning ⚠️']].forEach(([v, l]) => {
        const o = document.createElement('option');
        o.value = v; o.textContent = l;
        if (c.severity === v) o.selected = true;
        sevSel.appendChild(o);
      });
      sevSel.onchange = () => { c.severity = sevSel.value; };
      hdr.appendChild(sevSel);

      const rmBtn = document.createElement('button');
      rmBtn.type = 'button'; rmBtn.className = 'vis-cond-rm'; rmBtn.textContent = '\u2715';
      rmBtn.onclick = () => { node.constraint.splice(idx, 1); render(); syncActive(); };
      hdr.appendChild(rmBtn);
      card.appendChild(hdr);

      // key
      const keyInp = document.createElement('input');
      keyInp.type = 'text'; keyInp.className = 'panel-inp-sm constraint-inp';
      keyInp.placeholder = 'key (e.g. consent-required)';
      keyInp.value = c.key || '';
      keyInp.oninput = () => { c.key = keyInp.value; keyLbl.textContent = keyInp.value || '(no key)'; };
      card.appendChild(_lbl('Key:', keyInp));

      // human message
      const humanInp = document.createElement('input');
      humanInp.type = 'text'; humanInp.className = 'panel-inp-sm constraint-inp';
      humanInp.placeholder = 'Human-readable message';
      humanInp.value = c.human || '';
      humanInp.oninput = () => { c.human = humanInp.value; };
      card.appendChild(_lbl('Message:', humanInp));

      // expression
      const exprInp = document.createElement('input');
      exprInp.type = 'text'; exprInp.className = 'panel-inp-sm constraint-inp';
      exprInp.placeholder = 'FHIRPath expression (must return true to pass)';
      exprInp.value = c.expression || '';
      exprInp.oninput = () => { c.expression = exprInp.value; };
      card.appendChild(_lbl('Expression:', exprInp));

      p.appendChild(card);
    });

    const addBtn = document.createElement('button');
    addBtn.type = 'button'; addBtn.className = 'vis-add-btn'; addBtn.textContent = '+ Add constraint';
    addBtn.style.marginTop = '6px';
    addBtn.onclick = () => {
      node.constraint.push({ key: '', severity: 'error', human: '', expression: '' });
      render(); syncActive();
    };
    p.appendChild(addBtn);
  };

  function _lbl(text, input) {
    const row = document.createElement('div');
    row.className = 'constraint-field-row';
    const lbl = document.createElement('label');
    lbl.className = 'constraint-field-lbl';
    lbl.textContent = text;
    row.appendChild(lbl);
    row.appendChild(input);
    return row;
  }

  render();
  syncActive();
}
