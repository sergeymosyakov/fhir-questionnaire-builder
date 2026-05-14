// ── FHIR Questionnaire tree validator ─────────────────────────────────────────
// Pure function — no DOM, no side effects.
// Returns an array of { severity: 'error'|'warning', nodeId, message }.

// Known FHIR R4 resource types (common subset used in Questionnaire references)
const FHIR_R4_RESOURCES = new Set([
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
]);

function _collectNodes(nodes, out = []) {
  for (const n of nodes) {
    out.push(n);
    if (n.type === 'group' && n.children) _collectNodes(n.children, out);
  }
  return out;
}

// Attempt to compile a JS rule expression. Returns error message or null.
// Attempt to parse a FHIRPath expression (syntax check only). Returns error message or null.
function _checkFhirPath(expr) {
  if (!expr || !expr.trim()) return null;
  const fp = window.fhirpath;
  if (!fp || typeof fp.compile !== 'function') return null;
  try {
    fp.compile(expr);
    return null;
  } catch (e) {
    return e.message;
  }
}

export function validateTree(tree, values = {}) {
  const issues = [];
  const all    = _collectNodes(tree);
  const allIds = all.map(n => n.id);

  // Pre-compute duplicate IDs
  const idCount = {};
  for (const id of allIds) idCount[id] = (idCount[id] || 0) + 1;
  const dupIds = new Set(Object.keys(idCount).filter(k => idCount[k] > 1));

  for (const node of all) {
    const id = node.id;

    // ── Errors ────────────────────────────────────────────────────────────────
    if (!id || !id.trim()) {
      issues.push({ severity: 'error', nodeId: '(empty)', message: 'Node has an empty linkId — linkId is required in FHIR R4.' });
    } else if (dupIds.has(id)) {
      issues.push({ severity: 'error', nodeId: id, message: `Duplicate linkId "${id}" — linkIds must be unique within a Questionnaire.` });
    }

    // FHIRPath expression errors
    const fhirPathErr = _checkFhirPath(node._calculatedExpr);
    if (fhirPathErr) issues.push({ severity: 'error', nodeId: id, message: `Calculated expression error: ${fhirPathErr}` });

    // ── Warnings ──────────────────────────────────────────────────────────────
    if (!node.title || !node.title.trim()) {
      issues.push({ severity: 'warning', nodeId: id || '(empty)', message: 'Empty item text (title) — FHIR R4 requires text on every item.' });
    }

    if (node.type === 'item' &&
        (node.itemType === 'select' || node.itemType === 'radio' || node.itemType === 'open-choice') &&
        (!node.options || !node.options.trim())) {
      issues.push({ severity: 'warning', nodeId: id, message: `Item type "${node.itemType}" has no answer options — answerOption will be empty in the export.` });
    }

    // reference type: validate referenceResource definition
    if (node.type === 'item' && node.itemType === 'reference') {
      if (!node.referenceResource || !node.referenceResource.trim()) {
        issues.push({ severity: 'warning', nodeId: id, message: 'Reference item has no allowed resource type — add a referenceResource (e.g. Patient, Practitioner).' });
      } else if (!FHIR_R4_RESOURCES.has(node.referenceResource.trim())) {
        issues.push({ severity: 'warning', nodeId: id, message: `referenceResource "${node.referenceResource}" is not a known FHIR R4 resource type.` });
      }
    }

  }

  return issues;
}
