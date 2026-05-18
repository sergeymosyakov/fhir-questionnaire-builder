// ── Action panel builders ─────────────────────────────────────────────────────
// buildXxxPanel(node, panelEl, linkEl, setActive, ctx: BuilderCtx)  — see ctx.js
//
// Each panel is keyed and toggled by the action links defined in node-item/group.
import { escAttr, parseOptions } from '../utils.js';
import { getAllItems, triggerCalcRecalc } from './_shared.js';
import { refreshExprIcons } from '../render-preview.js';
import { values, deleteValue } from '../state.js';

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
    if (!wrap.contains(e.target) && !dropEl?.contains(e.target)) close();
  };

  trigger.addEventListener('click', e => {
    e.stopPropagation();
    if (dropEl) { close(); return; }

    dropEl = document.createElement('div');
    dropEl.className = 'vis-q-sel-drop';

    // ── Search input ─────────────────────────────────────────────────────
    const searchInp = document.createElement('input');
    searchInp.type = 'text';
    searchInp.className = 'vis-q-sel-search';
    searchInp.placeholder = 'Search id or title\u2026';
    searchInp.addEventListener('mousedown', ev => ev.stopPropagation());
    dropEl.appendChild(searchInp);

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

    const optDivs = [];
    for (const it of allItems) {
      const opt = document.createElement('div');
      opt.className = 'vis-q-sel-opt' + (it.id === selectedId ? ' vis-q-sel-opt--sel' : '');
      opt.textContent = it.label;
      opt.title = it.id;
      opt.dataset.id = it.id;
      opt.addEventListener('mousedown', () => {
        trigger.textContent = it.label;
        trigger.title = it.id;
        onSelect(it.id, it);
        close();
      });
      dropEl.appendChild(opt);
      optDivs.push(opt);
    }

    searchInp.addEventListener('input', () => {
      const q = searchInp.value.toLowerCase();
      for (const opt of optDivs) {
        const match = !q
          || opt.dataset.id.toLowerCase().includes(q)
          || opt.textContent.toLowerCase().includes(q);
        opt.style.display = match ? '' : 'none';
      }
    });

    // Render as portal so it escapes any overflow:hidden/auto ancestor
    const rect = trigger.getBoundingClientRect();
    dropEl.style.top      = (rect.bottom + 2) + 'px';
    dropEl.style.left     = rect.left + 'px';
    dropEl.style.minWidth = rect.width + 'px';
    document.body.appendChild(dropEl);

    setTimeout(() => {
      // Flip upward if dropdown would extend below the viewport
      const dRect = dropEl.getBoundingClientRect();
      if (dRect.bottom > window.innerHeight - 8) {
        dropEl.style.top = Math.max(4, rect.top - dRect.height - 2) + 'px';
      }
      document.addEventListener('mousedown', onOutside, true);
      searchInp.focus();
    }, 0);
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
      } else if (itype === 'number' || itype === 'integer' || itype === 'decimal' || itype === 'quantity') {
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
  exprLbl.className = 'panel-raw-lbl panel-raw-lbl--sm panel-lbl-row';
  const exprLblTxt = document.createElement('span');
  exprLblTxt.textContent = 'enableWhenExpression (SDC):';
  const exprIcon = document.createElement('span');
  exprIcon.className = 'expr-live-icon';
  exprIcon.dataset.exprIcon = node.enableWhenExpression || '';
  exprLbl.appendChild(exprLblTxt);
  exprLbl.appendChild(exprIcon);
  p.appendChild(exprLbl);

  const exprInp = document.createElement('textarea');
  exprInp.rows = 2;
  exprInp.className = 'expr-textarea';
  exprInp.value = node.enableWhenExpression || '';
  exprInp.placeholder = "e.g. %age > 18 and %gender = 'male'";
  const _resizeExpr = () => { exprInp.style.height = 'auto'; exprInp.style.height = exprInp.scrollHeight + 'px'; };
  exprInp.addEventListener('input', _resizeExpr);
  setTimeout(_resizeExpr, 0);
  exprInp.oninput = () => {
    node.enableWhenExpression = exprInp.value;
    exprIcon.dataset.exprIcon = exprInp.value.trim();
    syncActive();
    clearTimeout(exprInp._d);
    exprInp._d = setTimeout(refreshExprIcons, 400);
  };
  exprInp.onblur = () => { triggerCalcRecalc(); };
  p.appendChild(exprInp);

  syncActive();
}



// ── Type + Options panel (item only) ─────────────────────────────────────────
export function buildTypePanel(node, p) {
  const typeRow = document.createElement('div');
  typeRow.textContent = 'Type: ';
  const typeSelect = document.createElement('select');
  typeSelect.className = 'panel-type-sel';
  typeSelect.dataset.testid = 'type-select';
  for (const t of ['text', 'integer', 'decimal', 'date', 'url', 'attachment', 'checkbox', 'select', 'open-choice', 'radio', 'reference', 'quantity', 'display']) {
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
    // Clear all stored answers for this item (primary + repeat rows)
    const id = node.id;
    deleteValue(id);
    const n = values[id + '$$n'] || 0;
    for (let i = 1; i <= n; i++) deleteValue(id + '$$' + i);
    delete values[id + '$$n'];

    node.itemType = typeSelect.value;

    // checkbox and display cannot be repeatable
    const noRepeats = node.itemType === 'checkbox' || node.itemType === 'display';
    if (noRepeats && node.repeats) node.repeats = false;
    const rl = p.closest('[data-node-id]')?.querySelector('[data-testid="action-repeatable"]');
    if (rl) rl.style.display = noRepeats ? 'none' : '';

    optionsDiv.style.display = (node.itemType === 'select' || node.itemType === 'open-choice' || node.itemType === 'radio') ? 'block' : 'none';
    refResDiv.style.display  = node.itemType === 'reference' ? 'block' : 'none';
    qUnitDiv.style.display   = node.itemType === 'quantity'  ? 'block' : 'none';
    triggerCalcRecalc();
  };
}

// ── Expression panel ──────────────────────────────────────────────────────────
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
