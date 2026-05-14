import { createWrap } from './_base.js';

// All FHIR R4 resource types (for the resource-type dropdown)
const FHIR_R4_RESOURCES = [
  'Account','ActivityDefinition','AdverseEvent','AllergyIntolerance','Appointment',
  'AppointmentResponse','AuditEvent','Basic','Binary','BiologicallyDerivedProduct',
  'BodyStructure','Bundle','CapabilityStatement','CarePlan','CareTeam','ChargeItem',
  'ChargeItemDefinition','Claim','ClaimResponse','ClinicalImpression','CodeSystem',
  'Communication','CommunicationRequest','CompartmentDefinition','Composition',
  'ConceptMap','Condition','Consent','Contract','Coverage',
  'CoverageEligibilityRequest','CoverageEligibilityResponse','DetectedIssue',
  'Device','DeviceDefinition','DeviceMetric','DeviceRequest','DeviceUseStatement',
  'DiagnosticReport','DocumentManifest','DocumentReference','Encounter','Endpoint',
  'EnrollmentRequest','EnrollmentResponse','EpisodeOfCare','EventDefinition',
  'ExplanationOfBenefit','FamilyMemberHistory','Flag','Goal','Group',
  'GuidanceResponse','HealthcareService','ImagingStudy','Immunization',
  'ImmunizationEvaluation','ImmunizationRecommendation','ImplementationGuide',
  'InsurancePlan','Invoice','Library','Linkage','List','Location','Measure',
  'MeasureReport','Media','Medication','MedicationAdministration',
  'MedicationDispense','MedicationKnowledge','MedicationRequest',
  'MedicationStatement','MessageDefinition','MessageHeader','MolecularSequence',
  'NamingSystem','NutritionOrder','Observation','ObservationDefinition',
  'OperationDefinition','OperationOutcome','Organization','OrganizationAffiliation',
  'Parameters','Patient','PaymentNotice','PaymentReconciliation','Person',
  'PlanDefinition','Practitioner','PractitionerRole','Procedure','Provenance',
  'Questionnaire','QuestionnaireResponse','RelatedPerson','RequestGroup',
  'ResearchStudy','ResearchSubject','RiskAssessment','Schedule','SearchParameter',
  'ServiceRequest','Slot','Specimen','SpecimenDefinition','StructureDefinition',
  'StructureMap','Subscription','Substance','SupplyDelivery','SupplyRequest',
  'Task','TerminologyCapabilities','TestReport','TestScript','ValueSet',
  'VerificationResult','VisionPrescription'
];

// FHIR R4 reference answer — dropdown (resource type) + text input (id).
// Stores { reference: "ResourceType/id" } in values[node.id].
// If node.referenceResource is set, the dropdown is pre-selected and locked.
export function build(node, ctx) {
  const { values, onChange, _reCalc, _formTick } = ctx;
  const wrap = createWrap();
  wrap.classList.add('ctrl-wrap--joined');

  // Parse existing value
  const current = values[node.id];
  const existing = current ? (current.reference || '') : '';
  const slashIdx = existing.indexOf('/');
  const initType = slashIdx > -1 ? existing.slice(0, slashIdx) : (node.referenceResource || '');
  const initId   = slashIdx > -1 ? existing.slice(slashIdx + 1) : '';

  // Resource type dropdown
  const sel = document.createElement('select');
  sel.className = 'ref-type-sel';

  // If referenceResource is set, show only that type; otherwise show all
  const options = node.referenceResource ? [node.referenceResource] : FHIR_R4_RESOURCES;
  for (const r of options) {
    const opt = document.createElement('option');
    opt.value = r;
    opt.textContent = r;
    if (r === initType) opt.selected = true;
    sel.appendChild(opt);
  }
  // If no referenceResource, add a blank "select type" placeholder at top
  if (!node.referenceResource) {
    const blank = document.createElement('option');
    blank.value = '';
    blank.textContent = '— type —';
    blank.disabled = true;
    if (!initType) blank.selected = true;
    sel.insertBefore(blank, sel.firstChild);
  }

  // Separator label
  const sep = document.createElement('span');
  sep.textContent = '/';
  sep.className = 'ref-sep';

  // ID input
  const idInput = document.createElement('input');
  idInput.type        = 'text';
  idInput.placeholder = 'id';
  idInput.value       = initId;
  idInput.className   = 'ref-id-input';

  // Required-id error
  const errMsg = document.createElement('span');
  errMsg.className    = 'ctrl-err ctrl-err--ml';
  errMsg.textContent  = 'id is required';

  const update = () => {
    const type = sel.value;
    const id   = idInput.value.trim();
    errMsg.style.display = (type && !id) ? 'inline' : 'none';
    values[node.id] = (type && id) ? { reference: type + '/' + id } : undefined;
    _reCalc(); onChange();
  };

  sel.onchange    = () => { update(); _formTick.value++; };
  idInput.oninput = update;
  idInput.onchange = () => { _formTick.value++; };

  wrap.appendChild(sel);
  wrap.appendChild(sep);
  wrap.appendChild(idInput);
  wrap.appendChild(errMsg);

  return wrap;
}
