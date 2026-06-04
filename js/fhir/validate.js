// ── FHIR Questionnaire tree validator ─────────────────────────────────────────
// Pure function — no DOM, no side effects.
// Returns an array of { severity: 'error'|'warning', nodeId, message }.

// System-generated constraint key (must match ITLH_KEY_GROUP_OR in utils.js)
const _ITLH_KEY_GROUP_OR = 'e3a8c2f1-6b4d-4e9a-87c5:group-or';

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

export function validateTree(tree, _values = {}) {
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

    const fhirPathAeErr = _checkFhirPath(node._answerExpression);
    if (fhirPathAeErr) issues.push({ severity: 'error', nodeId: id, message: `Answer expression error: ${fhirPathAeErr}` });

    const fhirPathEwErr = _checkFhirPath(node.enableWhenExpression);
    if (fhirPathEwErr) issues.push({ severity: 'error', nodeId: id, message: `enableWhenExpression error: ${fhirPathEwErr}` });

    if (Array.isArray(node.enableWhen)) {
      for (const ew of node.enableWhen) {
        if (ew.question && !allIds.includes(ew.question)) {
          issues.push({ severity: 'error', nodeId: id, message: `Show When references unknown linkId "${ew.question}" — the target question does not exist.` });
        }
      }
    }

    if (Array.isArray(node.constraint)) {
      for (const c of node.constraint) {
        const cLabel = `Constraint "${c.key || '?'}"`;
        if (!c.key || !c.key.trim()) {
          issues.push({ severity: 'error', nodeId: id, message: `A constraint has an empty key — key is required by FHIR R4 (questionnaire-constraint).` });
        } else if (c.key === _ITLH_KEY_GROUP_OR) {
          // system-generated key — skip user-facing validation
        }
        if (!c.human || !c.human.trim()) {
          issues.push({ severity: 'warning', nodeId: id, message: `${cLabel} has no human-readable message — the "human" field is required by FHIR R4.` });
        }
        const cErr = _checkFhirPath(c.expression);
        if (cErr) issues.push({ severity: 'error', nodeId: id, message: `${cLabel} expression error: ${cErr}` });
        if (!c.expression || !c.expression.trim()) {
          issues.push({ severity: 'warning', nodeId: id, message: `${cLabel} has an empty expression — it will never be evaluated.` });
        }
      }
    }

    // ── Cross-field semantic validation ──────────────────────────────────────

    // required + hidden — item can never be answered
    if (node.mandatory === true && node._hidden === true) {
      issues.push({ severity: 'warning', nodeId: id, message: 'Item is both required and hidden — a hidden item can never receive an answer, so the required constraint can never be satisfied.' });
    }

    // calculatedExpression + readOnly: false — computed value will be overwritten
    if (node._calculatedExpr && node._calculatedExpr.trim() && node._readOnly !== true) {
      issues.push({ severity: 'warning', nodeId: id, message: 'Item has a calculatedExpression but is not read-only — the user can overwrite the computed value. Consider setting read-only.' });
    }

    // answerExpression + answerOption[] co-presence — mutually exclusive in SDC
    const hasAnswerOptions = (node._rawAnswerOptions && node._rawAnswerOptions.length > 0) ||
                             (node.options && node.options.trim());
    if (node._answerExpression && node._answerExpression.trim() && hasAnswerOptions) {
      issues.push({ severity: 'warning', nodeId: id, message: 'Item has both answerExpression and answerOption[] — these are mutually exclusive in SDC. answerOption[] will be ignored at runtime.' });
    }

    // enableWhen + enableWhenExpression conflict — only one should control visibility
    const hasEnableWhen = Array.isArray(node.enableWhen) && node.enableWhen.length > 0;
    if (hasEnableWhen && node.enableWhenExpression && node.enableWhenExpression.trim()) {
      issues.push({ severity: 'warning', nodeId: id, message: 'Item has both enableWhen[] conditions and an enableWhenExpression — only one should control visibility. enableWhenExpression takes precedence in SDC.' });
    }

    // repeats: false + initial[] count > 1 — extra initial values will be ignored
    if (!node.repeats && node._initialValues && node._initialValues.length > 1) {
      issues.push({ severity: 'warning', nodeId: id, message: `Item has ${node._initialValues.length} initial values but repeats is not set — only the first initial value will be used.` });
    }

    // minOccurs without required=true — R4 context invariant (que-minoccurs-1): extension is only valid when required=true
    if (node.repeats && node._minOccurs !== undefined && !node.required) {
      issues.push({ severity: 'warning', nodeId: id, message: 'Min answers (questionnaire-minOccurs) is set but the item is not marked required — R4 context invariant requires required=true. The extension will be omitted from the export.' });
    }

    // que-11: initial[x] must be absent when answerOption[] is present
    // Exception: _initialValue derived solely from answerOption[].initialSelected is NOT a violation —
    // it IS the correct R4 pattern. Only warn when _initialValue comes from item.initial[].
    const hasInitial = node.type === 'item' && (
      (node._initialValue !== undefined && node._initialValue !== node._initialSelected) ||
      (node._initialValues && node._initialValues.length > 0)
    );
    if (hasInitial && (node.options || node._rawAnswerOptions || node._answerValueSet || node._answerExpression)) {
      issues.push({ severity: 'warning', nodeId: id, message: 'Initial value is set but the item has answer options — R4 invariant que-11 forbids initial[x] when answerOption[] is present. Use the answer option\'s "Initially selected" setting instead. The initial value will be omitted from the export.' });
    }

    // questionnaire-unit not allowed on quantity type (R4 invariant: type='integer' or type='decimal')
    if (node.type === 'item' && node.itemType === 'quantity' && node.quantityUnit
        && !node._unitOptions?.length && !node._unitValueSet) {
      // This is auto-fixed on export (converted to unitOption) — no warning needed, handled transparently
    }

    // questionnaire-sliderStepValue: R4 only allows valueInteger
    // decimal step values require R5/R4B; warn and note the export will round
    if (node._sliderStep !== undefined && !Number.isInteger(node._sliderStep)) {
      issues.push({ severity: 'warning', nodeId: id, message: `Slider step value ${node._sliderStep} is a decimal — questionnaire-sliderStepValue only allows valueInteger in R4. The step will be rounded to ${Math.round(node._sliderStep)} on export. Use R5/R4B for decimal step values.` });
    }

    // questionnaire-displayCategory: in R4 this extension is only valid on group items
    // On display items it is R5-only; the export suppresses it in R4 mode
    if (node._displayCategory && node.itemType === 'display') {
      issues.push({ severity: 'warning', nodeId: id, message: `questionnaire-displayCategory is only valid on group items in R4. On display items it is R5-only and will be omitted from the export.` });
    }

    // ── Warnings ──────────────────────────────────────────────────────────────
    if (!node.title || !node.title.trim()) {
      issues.push({ severity: 'warning', nodeId: id || '(empty)', message: 'Empty item text (title) — FHIR R4 requires text on every item.' });
    }

    if (node.type === 'item' &&
        (node.itemType === 'select' || node.itemType === 'radio' || node.itemType === 'open-choice') &&
        (!node.options || !node.options.trim()) &&
        !node._rawAnswerOptions &&
        !node._answerValueSet &&
        !node._answerExpression) {
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
