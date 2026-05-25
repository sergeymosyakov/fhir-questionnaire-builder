// ── ReferenceNode ─────────────────────────────────────────────────────────────
// FHIR resource reference input. itemType: 'reference'
// Optional FHIR-imported: referenceResource (allowed type, e.g. 'Patient')
import { ItemNode } from './item-node.js';
import { NODE_REGISTRY } from './registry.js';
import { createWrap } from './base-node.js';
import { createCustomSelect } from '../ui/custom-select.js';

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
  'VerificationResult','VisionPrescription',
];

export class ReferenceNode extends ItemNode {
  constructor(data = {}) {
    super(data);
    this.itemType = 'reference';
  }

  buildControl(ctx) {
    const node = this;
    const { getValue, setValue, onChange, _reCalc, _formTick } = ctx;
    const wrap = createWrap();
    wrap.classList.add('ctrl-wrap--joined');

    const current  = getValue(node.id);
    const existing = current ? (current.reference || '') : '';
    const slashIdx = existing.indexOf('/');
    const initType = slashIdx > -1 ? existing.slice(0, slashIdx) : (node.referenceResource || '');
    const initId   = slashIdx > -1 ? existing.slice(slashIdx + 1) : '';

    const typeItems = node.referenceResource
      ? [{ value: node.referenceResource, label: node.referenceResource }]
      : [{ value: '', label: '\u2014 type \u2014' }, ...FHIR_R4_RESOURCES.map(r => ({ value: r, label: r }))];

    const sel = createCustomSelect({
      items:     typeItems,
      value:     initType || '',
      className: 'ref-type-sel',
      onChange:  () => { update(); _formTick.value++; },
    });

    const sep = document.createElement('span');
    sep.textContent = '/';
    sep.className = 'ref-sep';

    const idInput = document.createElement('input');
    idInput.type        = 'text';
    idInput.placeholder = 'id';
    idInput.value       = initId;
    idInput.className   = 'ref-id-input';

    const errMsg = document.createElement('span');
    errMsg.className   = 'ctrl-err ctrl-err--ml';
    errMsg.textContent = 'id is required';

    const update = () => {
      const type = sel.getValue();
      const id   = idInput.value.trim();
      errMsg.style.display = (type && !id) ? 'inline' : 'none';
      setValue(node.id, (type && id) ? { reference: type + '/' + id } : undefined);
      _reCalc(); onChange();
    };

    idInput.oninput  = update;
    idInput.onchange = () => { _formTick.value++; };

    wrap.appendChild(sel.el);
    wrap.appendChild(sep);
    wrap.appendChild(idInput);
    wrap.appendChild(errMsg);
    return wrap;
  }
}

NODE_REGISTRY.set('reference',   ReferenceNode);
