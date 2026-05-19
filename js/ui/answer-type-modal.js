// ── Answer Type edit modal ────────────────────────────────────────────────────
// Centered modal for editing item type, options, and answerValueSet.
// For choice types (select / radio / open-choice) the user picks the answer
// source: either a plain "options list" or a ValueSet reference.  When a local
// #vs-id is chosen the resolved concepts are stored in node.options so the
// preview can render real answers; export.js skips answerOption when
// _answerValueSet is present.
//
// Uses draft pattern — changes are only committed on Apply. Cancel discards.
//
// init(elements)                       — wire DOM once at startup
// open(node, typeLink, setActive)      — populate body + show

import { questContained, values, deleteValue } from '../state.js';
import { resolveContainedValueSet } from '../fhir/import.js';
import { triggerCalcRecalc } from '../builder/_shared.js';
import { createCustomSelect } from './custom-select.js';

const CHOICE_TYPES = new Set(['select', 'radio', 'open-choice']);

const ITEM_TYPES = [
  'text','integer','decimal','date','dateTime','time','url','attachment',
  'checkbox','select','open-choice','radio',
  'reference','quantity','display',
];

const FHIR_R4_TYPES = [
  'Patient','Practitioner','PractitionerRole','RelatedPerson','Organization',
  'Encounter','EpisodeOfCare','Condition','Observation','DiagnosticReport','Procedure',
  'MedicationRequest','MedicationStatement','Medication','AllergyIntolerance','Immunization',
  'CarePlan','CareTeam','Goal','ServiceRequest','Appointment','Slot','Schedule',
  'HealthcareService','Location','Device','Specimen','ImagingStudy','Media',
  'DocumentReference','Composition','QuestionnaireResponse','Questionnaire',
  'Coverage','Claim','ExplanationOfBenefit','Account','Invoice','ChargeItem',
  'ResearchStudy','ResearchSubject','Group','Person',
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
  'SpecimenDefinition','StructureDefinition','StructureMap','Subscription',
  'Substance','SupplyDelivery','SupplyRequest','Task','TerminologyCapabilities',
  'TestReport','TestScript','ValueSet','VerificationResult','VisionPrescription',
];

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

let _el      = null;
let _pending = null;

// ── module API ────────────────────────────────────────────────────────────────

export function init(elements) {
  _el = elements;
  _el.closeBtn.addEventListener('click', _cancel);
  _el.cancelBtn.addEventListener('click', _cancel);
  _el.applyBtn.addEventListener('click', _apply);
  _el.modal.addEventListener('click', e => { if (e.target === _el.modal) _cancel(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && _el.modal.style.display !== 'none') _cancel();
  });
}

export function open(node, typeLink, setActive) {
  _pending = {
    node, typeLink, setActive,
    draftType:    node.itemType,
    draftOptions: node.options || '',
    draftAVS:     node._answerValueSet || '',
    draftRefRes:  node.referenceResource || '',
    draftUnit:    node.quantityUnit || '',
  };

  _el.title.innerHTML = '';
  const labelEl = document.createElement('span');
  labelEl.className   = 'modal-title-label';
  labelEl.textContent = 'Answer Type';
  const subjectEl = document.createElement('span');
  subjectEl.className   = 'modal-title-subject';
  subjectEl.textContent = ' \u2014 ' + (node.title || node.id || 'Item');
  _el.title.appendChild(labelEl);
  _el.title.appendChild(subjectEl);

  _el.body.innerHTML = '';
  _renderBody(_el.body);
  _el.modal.style.display = 'flex';
}

// ── internals ─────────────────────────────────────────────────────────────────

function _apply() {
  if (!_pending) return;
  const { node, typeLink, setActive } = _pending;

  // Clear stored answers when type changes
  if (node.itemType !== _pending.draftType) {
    const id = node.id;
    deleteValue(id);
    const n = values[id + '$$n'] || 0;
    for (let i = 1; i <= n; i++) deleteValue(id + '$$' + i);
    delete values[id + '$$n'];
  }

  node.itemType = _pending.draftType;

  // checkbox / display cannot be repeatable
  if ((node.itemType === 'checkbox' || node.itemType === 'display') && node.repeats) {
    node.repeats = false;
    delete node._minOccurs;
    delete node._maxOccurs;
  }

  if (CHOICE_TYPES.has(node.itemType)) {
    if (_pending.draftAVS) {
      node._answerValueSet = _pending.draftAVS;
      // Resolve local #vs-id → options string for preview rendering
      node.options = resolveContainedValueSet(questContained, _pending.draftAVS);
    } else {
      delete node._answerValueSet;
      node.options = _pending.draftOptions;
    }
  } else {
    // Non-choice type: clear choice-specific state
    delete node._answerValueSet;
    node.options = '';
  }

  node.referenceResource = (node.itemType === 'reference' && _pending.draftRefRes) ? _pending.draftRefRes : undefined;
  node.quantityUnit      = (node.itemType === 'quantity'  && _pending.draftUnit)   ? _pending.draftUnit   : undefined;

  // Keep the repeatable link visible/hidden correctly
  const nodeEl = document.querySelector(`[data-node-id="${node.id}"]`);
  const rl = nodeEl?.querySelector('[data-testid="action-repeatable"]');
  if (rl) {
    const noRepeats = node.itemType === 'checkbox' || node.itemType === 'display';
    rl.style.display = noRepeats ? 'none' : '';
  }

  setActive(typeLink, true);
  triggerCalcRecalc();
  _close();
}

function _cancel() { _close(); }

function _close() {
  _pending = null;
  _el.modal.style.display = 'none';
}

// ── body renderer ─────────────────────────────────────────────────────────────

function _renderBody(container) {
  const hint = document.createElement('div');
  hint.className   = 'panel-hint';
  hint.textContent = 'Sets the FHIR item type. For coded-answer types you can supply a plain options list or link to a contained[] ValueSet.';
  container.appendChild(hint);

  // ── Type selector ─────────────────────────────────────────────────────────
  const typeRow = document.createElement('div');
  typeRow.className = 'at-modal-type-row';
  const typeLbl = document.createElement('label');
  typeLbl.className = 'at-modal-lbl';
  typeLbl.textContent = 'Type:';
  const typeSel = createCustomSelect({
    items:     ITEM_TYPES.map(t => ({ value: t, label: t })),
    value:     _pending.draftType,
    className: 'at-modal-type-sel sc-trigger--full',
    testid:    'type-select',
    onChange:  v => {
      _pending.draftType = v;
      choiceSection.style.display = CHOICE_TYPES.has(_pending.draftType) ? 'block' : 'none';
      refSection.style.display    = _pending.draftType === 'reference' ? 'block' : 'none';
      unitSection.style.display   = _pending.draftType === 'quantity'  ? 'block' : 'none';
    },
  });
  typeRow.appendChild(typeLbl);
  typeRow.appendChild(typeSel.el);
  container.appendChild(typeRow);

  // ── Choice-type: answer source section ────────────────────────────────────
  const choiceSection = document.createElement('div');
  choiceSection.style.display = CHOICE_TYPES.has(_pending.draftType) ? 'block' : 'none';
  container.appendChild(choiceSection);

  // "Answer source" radio toggle
  const sourceRow = document.createElement('div');
  sourceRow.className = 'at-modal-source-row';

  const optRadio = Object.assign(document.createElement('input'), { type: 'radio', name: '_at_src', id: '_at_src_opt', value: 'options', checked: !_pending.draftAVS });
  const avsRadio = Object.assign(document.createElement('input'), { type: 'radio', name: '_at_src', id: '_at_src_avs', value: 'valueset', checked: !!_pending.draftAVS });
  const optLbl   = Object.assign(document.createElement('label'), { htmlFor: '_at_src_opt', textContent: 'Options list', className: 'at-modal-src-lbl' });
  const avsLbl   = Object.assign(document.createElement('label'), { htmlFor: '_at_src_avs', textContent: 'ValueSet (answerValueSet)', className: 'at-modal-src-lbl' });

  sourceRow.append(optRadio, optLbl, avsRadio, avsLbl);
  choiceSection.appendChild(sourceRow);

  // ── Options sub-section ───────────────────────────────────────────────────
  const optSection = document.createElement('div');
  optSection.className = 'at-modal-sub';
  optSection.style.display = !_pending.draftAVS ? 'block' : 'none';

  const optSubLbl = document.createElement('div');
  optSubLbl.className   = 'at-modal-sub-lbl';
  optSubLbl.textContent = 'Options (code=Label, comma-separated):';

  const optInp = document.createElement('textarea');
  optInp.className   = 'at-modal-opt-inp';
  optInp.dataset.testid = 'options-input';
  optInp.value       = _pending.draftOptions;
  optInp.placeholder = 'e.g. yes=Yes,no=No,maybe=Maybe';
  optInp.rows        = 1;
  optInp.oninput = () => { _pending.draftOptions = optInp.value; };

  optSection.append(optSubLbl, optInp);
  choiceSection.appendChild(optSection);

  // ── ValueSet sub-section ──────────────────────────────────────────────────
  const avsSection = document.createElement('div');
  avsSection.className = 'at-modal-sub';
  avsSection.style.display = !!_pending.draftAVS ? 'block' : 'none';

  const avsSubLbl = document.createElement('div');
  avsSubLbl.className   = 'at-modal-sub-lbl';
  avsSubLbl.textContent = 'ValueSet — select from contained[] or enter an external URL:';

  // Dropdown of contained ValueSets
  const containedVS = [...questContained].filter(r => r.resourceType === 'ValueSet');

  const avsItems = [
    { value: '', label: '\u2014 none \u2014' },
    ...containedVS.map(vs => ({ value: '#' + vs.id, label: '#' + vs.id + (vs.title ? ' \u2014 ' + vs.title : '') })),
    { value: '__ext__', label: '\u2014 external URL \u2014' },
  ];
  const isExternalAVS = !!_pending.draftAVS && !_pending.draftAVS.startsWith('#');
  const avsInitVal = isExternalAVS ? '__ext__' : (_pending.draftAVS || '');

  const avsDrop = createCustomSelect({
    items:     avsItems,
    value:     avsInitVal,
    className: 'at-modal-avs-drop sc-trigger--full',
    testid:    'avs-select',
    onChange:  v => {
      if (v === '__ext__') {
        avsUrlInp.style.display = 'block';
        _pending.draftAVS = avsUrlInp.value.trim();
      } else {
        avsUrlInp.style.display = 'none';
        _pending.draftAVS = v;
      }
    },
  });

  // Free-text input for external URLs
  const avsUrlInp = document.createElement('input');
  avsUrlInp.type        = 'text';
  avsUrlInp.className   = 'at-modal-avs-url';
  avsUrlInp.dataset.testid = 'avs-url-input';
  avsUrlInp.value       = isExternalAVS ? _pending.draftAVS : '';
  avsUrlInp.placeholder = 'http://terminology.hl7.org/ValueSet/...';
  avsUrlInp.style.display = isExternalAVS ? 'block' : 'none';
  avsUrlInp.oninput = () => { _pending.draftAVS = avsUrlInp.value.trim(); };

  avsSection.append(avsSubLbl, avsDrop.el, avsUrlInp);
  choiceSection.appendChild(avsSection);

  // Wire radio toggles
  optRadio.onchange = () => {
    if (optRadio.checked) {
      optSection.style.display = 'block';
      avsSection.style.display = 'none';
      _pending.draftAVS = '';
    }
  };
  avsRadio.onchange = () => {
    if (avsRadio.checked) {
      optSection.style.display = 'none';
      avsSection.style.display = 'block';
      // Auto-select first contained ValueSet if nothing set yet
      if (!_pending.draftAVS) {
        if (containedVS.length) {
          _pending.draftAVS = '#' + containedVS[0].id;
          avsDrop.setValue('#' + containedVS[0].id);
        } else {
          avsDrop.setValue('__ext__');
          avsUrlInp.style.display = 'block';
          _pending.draftAVS = '';
        }
      }
    }
  };

  // ── Reference resource type ───────────────────────────────────────────────
  const refSection = document.createElement('div');
  refSection.className = 'at-modal-sub';
  refSection.style.display = _pending.draftType === 'reference' ? 'block' : 'none';

  const refLbl = document.createElement('div');
  refLbl.className   = 'at-modal-sub-lbl';
  refLbl.textContent = 'Allowed resource type:';

  const refSel = createCustomSelect({
    items:     [
      { value: '', label: '\u2014 Any (unrestricted) \u2014' },
      ...[...new Set(FHIR_R4_TYPES)].sort().map(t => ({ value: t, label: t })),
    ],
    value:     _pending.draftRefRes || '',
    className: 'at-modal-sub-sel sc-trigger--full',
    testid:    'ref-resource-sel',
    onChange:  v => { _pending.draftRefRes = v; },
  });

  refSection.append(refLbl, refSel.el);
  container.appendChild(refSection);

  // ── Quantity unit ─────────────────────────────────────────────────────────
  const unitSection = document.createElement('div');
  unitSection.className = 'at-modal-sub';
  unitSection.style.display = _pending.draftType === 'quantity' ? 'block' : 'none';

  const unitLbl = document.createElement('div');
  unitLbl.className   = 'at-modal-sub-lbl';
  unitLbl.textContent = 'Default unit:';

  const unitSel = createCustomSelect({
    items:     [
      { value: '', label: '\u2014 none \u2014' },
      ...BUILDER_UNITS.map(u => ({ value: u, label: u })),
    ],
    value:     _pending.draftUnit || '',
    className: 'at-modal-sub-sel sc-trigger--full',
    testid:    'unit-sel',
    onChange:  v => { _pending.draftUnit = v; },
  });

  unitSection.append(unitLbl, unitSel.el);
  container.appendChild(unitSection);
}
