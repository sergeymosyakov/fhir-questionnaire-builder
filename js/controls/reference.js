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
  const { values, onChange } = ctx;
  const wrap = createWrap();
  wrap.style.flexDirection = 'row';
  wrap.style.alignItems    = 'center';
  wrap.style.gap           = '0';

  // Parse existing value
  const current = values[node.id];
  const existing = current ? (current.reference || '') : '';
  const slashIdx = existing.indexOf('/');
  const initType = slashIdx > -1 ? existing.slice(0, slashIdx) : (node.referenceResource || '');
  const initId   = slashIdx > -1 ? existing.slice(slashIdx + 1) : '';

  // Resource type dropdown
  const sel = document.createElement('select');
  sel.style.cssText = 'height:28px;padding:0 4px;border:1px solid var(--c-border);border-right:none;border-radius:var(--r-sm) 0 0 var(--r-sm);font-size:12px;color:var(--c-text);background:var(--c-surface);max-width:160px;';

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
  sep.style.cssText = 'padding:0 2px;height:28px;line-height:28px;border-top:1px solid var(--c-border);border-bottom:1px solid var(--c-border);background:var(--c-surface);font-size:13px;color:var(--c-text-2);flex-shrink:0;';

  // ID input
  const idInput = document.createElement('input');
  idInput.type        = 'text';
  idInput.placeholder = 'id';
  idInput.value       = initId;
  idInput.style.cssText = 'height:28px;width:110px;padding:0 6px;border:1px solid var(--c-border);border-left:none;border-radius:0 var(--r-sm) var(--r-sm) 0;font-size:12px;color:var(--c-text);';

  // Required-id error
  const errMsg = document.createElement('span');
  errMsg.style.cssText = 'font-size:10px;color:var(--c-err);margin-left:6px;display:none;';
  errMsg.textContent = 'id is required';

  const update = () => {
    const type = sel.value;
    const id   = idInput.value.trim();
    errMsg.style.display = (type && !id) ? 'inline' : 'none';
    values[node.id] = (type && id) ? { reference: type + '/' + id } : undefined;
    onChange();
  };

  sel.oninput    = update;
  idInput.oninput = update;

  wrap.appendChild(sel);
  wrap.appendChild(sep);
  wrap.appendChild(idInput);
  wrap.appendChild(errMsg);

  return wrap;
}
