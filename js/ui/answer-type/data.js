// ── Answer Type modal: static data & pure helpers ────────────────────────────
// Pure constants and helpers with no side-effects or module state.
// Imported by modal.js.
import { parseOptions } from '../../utils.js';

// Choice item types — drive answer-source visibility in the modal.
export const CHOICE_TYPES = new Set(['select', 'radio', 'open-choice']);

// Types that support an entry-format (placeholder hint) extension.
export const ENTRY_FORMAT_TYPES = new Set(['text', 'integer', 'decimal', 'date', 'dateTime', 'time', 'url', 'quantity']);

// Numeric types that support min/max/sliderStep constraints.
export const NUMERIC_TYPES = new Set(['integer', 'decimal']);

// All item types the builder supports, in UI display order.
export const ITEM_TYPES = [
  'text','integer','decimal','date','dateTime','time','url','attachment',
  'checkbox','select','open-choice','radio',
  'reference','quantity','display',
];

// FHIR R4 resource types for the reference type picker.
export const FHIR_R4_TYPES = [
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

// Common clinical units for the quantity unit picker.
export const BUILDER_UNITS = [
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

// Build textarea string with optional ordinal suffix: "code=Label=0,code2=Label2=1"
export function _optsWithOrdinals(node) {
  if (!node.options) return '';
  const ords = node._optionOrdinals || {};
  return parseOptions(node.options)
    .map(({ code, display }) => {
      const o = ords[code];
      return o !== undefined ? `${code}=${display}=${o}` : `${code}=${display}`;
    })
    .join(',');
}

// Parse "code=Label=N" entries; returns [{ code, display, ordinal? }]
export function _parseOptsWithOrdinals(str) {
  return (str || '').split(',').map(s => s.trim()).filter(Boolean).map(s => {
    const eq = s.indexOf('=');
    if (eq === -1) return { code: s, display: s };
    const code = s.slice(0, eq).trim();
    const rest = s.slice(eq + 1);
    const lastEq = rest.lastIndexOf('=');
    if (lastEq !== -1) {
      const maybeOrd = rest.slice(lastEq + 1).trim();
      const ordVal = Number(maybeOrd);
      if (maybeOrd !== '' && !isNaN(ordVal)) {
        return { code, display: rest.slice(0, lastEq).trim(), ordinal: ordVal };
      }
    }
    return { code, display: rest.trim() };
  });
}
