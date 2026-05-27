// ── Questionnaire.subjectType — chip-based multi-select ──────────────────────
// Full R4 resource-types ValueSet + custom entry.
import { Section } from '../section.js';
import { META_SECTIONS } from './registry.js';
import { createCustomSelect } from '../../custom-select.js';
import { makeCollapsible } from './helpers.js';

// FHIR R4 resource-types ValueSet (alphabetical)
const R4_RESOURCE_TYPES = [
  'Account','ActivityDefinition','AdverseEvent','AllergyIntolerance','Appointment',
  'AppointmentResponse','AuditEvent','Basic','Binary','BiologicallyDerivedProduct',
  'BodyStructure','Bundle','CapabilityStatement','CarePlan','CareTeam','CatalogEntry',
  'ChargeItem','ChargeItemDefinition','Claim','ClaimResponse','ClinicalImpression',
  'CodeSystem','Communication','CommunicationRequest','CompartmentDefinition',
  'Composition','ConceptMap','Condition','Consent','Contract','Coverage',
  'CoverageEligibilityRequest','CoverageEligibilityResponse','DetectedIssue',
  'Device','DeviceDefinition','DeviceMetric','DeviceRequest','DeviceUseStatement',
  'DiagnosticReport','DocumentManifest','DocumentReference','EffectEvidenceSynthesis',
  'Encounter','Endpoint','EnrollmentRequest','EnrollmentResponse','EpisodeOfCare',
  'EventDefinition','Evidence','EvidenceVariable','ExampleScenario',
  'ExplanationOfBenefit','FamilyMemberHistory','Flag','Goal','GraphDefinition',
  'Group','GuidanceResponse','HealthcareService','ImagingStudy','Immunization',
  'ImmunizationEvaluation','ImmunizationRecommendation','ImplementationGuide',
  'InsurancePlan','Invoice','Library','Linkage','List','Location','Measure',
  'MeasureReport','Media','Medication','MedicationAdministration','MedicationDispense',
  'MedicationKnowledge','MedicationRequest','MedicationStatement','MedicinalProduct',
  'MedicinalProductAuthorization','MedicinalProductContraindication',
  'MedicinalProductIndication','MedicinalProductIngredient',
  'MedicinalProductInteraction','MedicinalProductManufactured',
  'MedicinalProductPackaged','MedicinalProductPharmaceutical',
  'MedicinalProductUndesirableEffect','MessageDefinition','MessageHeader',
  'MolecularSequence','NamingSystem','NutritionOrder','Observation',
  'ObservationDefinition','OperationDefinition','OperationOutcome','Organization',
  'OrganizationAffiliation','Parameters','Patient','PaymentNotice',
  'PaymentReconciliation','Person','PlanDefinition','Practitioner','PractitionerRole',
  'Procedure','Provenance','Questionnaire','QuestionnaireResponse','RelatedPerson',
  'RequestGroup','ResearchDefinition','ResearchElementDefinition','ResearchStudy',
  'ResearchSubject','RiskAssessment','RiskEvidenceSynthesis','Schedule',
  'SearchParameter','ServiceRequest','Slot','Specimen','SpecimenDefinition',
  'StructureDefinition','StructureMap','Subscription','Substance',
  'SubstanceNucleicAcid','SubstancePolymer','SubstanceProtein',
  'SubstanceReferenceInformation','SubstanceSourceMaterial','SubstanceSpecification',
  'SupplyDelivery','SupplyRequest','Task','TerminologyCapabilities','TestReport',
  'TestScript','VerificationResult','VisionPrescription',
];

class SubjectTypeSection extends Section {
  build(pending) {
    return makeCollapsible({
      testid:      'meta-subject-type-toggle',
      tip:         {
        title: 'Questionnaire.subjectType',
        body:  'Resource type(s) that can be the subject of a QuestionnaireResponse. If empty, no restriction is applied.',
        fhir:  'Questionnaire.subjectType',
        spec:  'R4',
      },
      label:       'Subject Type',
      countFn:     () => pending.subjectType.length,
      initialOpen: pending.subjectType.length > 0,
      buildBody:   ({ el, setLabel, expand }) => {
        const render = () => {
          el.innerHTML = '';

          // ── Chips ──────────────────────────────────────────────────────────
          const chipsEl = document.createElement('div');
          chipsEl.className = 'subtype-chips';
          chipsEl.dataset.testid = 'subject-type-chips';

          if (pending.subjectType.length === 0) {
            const empty = document.createElement('span');
            empty.className = 'subtype-chips-empty';
            empty.textContent = 'No subject types \u2014 questionnaire is unrestricted.';
            chipsEl.appendChild(empty);
          } else {
            pending.subjectType.forEach((type, idx) => {
              const chip = document.createElement('span');
              chip.className = 'subtype-chip';
              chip.dataset.testid = `subject-type-chip-${idx}`;
              chip.dataset.value = type;

              const txt = document.createElement('span');
              txt.textContent = type;

              const rm = document.createElement('button');
              rm.type = 'button';
              rm.className = 'subtype-chip-remove';
              rm.dataset.testid = `subject-type-remove-${idx}`;
              rm.textContent = '\u00D7';
              rm.setAttribute('data-tip-title', 'Remove ' + type);
              rm.setAttribute('data-tip-body', 'Click to remove this resource type.');
              rm.onclick = () => { pending.subjectType.splice(idx, 1); render(); setLabel(); };

              chip.append(txt, rm);
              chipsEl.appendChild(chip);
            });
          }
          el.appendChild(chipsEl);

          // ── Add from R4 list ───────────────────────────────────────────────
          const available = R4_RESOURCE_TYPES.filter(t => !pending.subjectType.includes(t));
          const dropItems = [
            { value: '', label: '\u2014 add type from list \u2014' },
            ...available.map(t => ({ value: t, label: t })),
          ];
          const sel = createCustomSelect({
            items:     dropItems,
            value:     '',
            searchable: true,
            onChange:  v => {
              if (!v || pending.subjectType.includes(v)) return;
              pending.subjectType.push(v);
              expand();
              setLabel();
              render();
            },
            className: 'sc-trigger--full',
            testid:    'subject-type-sel',
          });
          el.appendChild(sel.el);

          // ── Custom type input ──────────────────────────────────────────────
          const customRow = document.createElement('div');
          customRow.className = 'subtype-custom-row';

          const inp = document.createElement('input');
          inp.type = 'text';
          inp.className = 'codes-inp';
          inp.placeholder = 'Or enter a custom resource type\u2026';
          inp.dataset.testid = 'subject-type-custom-inp';

          const addBtn = document.createElement('button');
          addBtn.type = 'button';
          addBtn.className = 'codes-add-btn';
          addBtn.textContent = '+ Add';
          addBtn.dataset.testid = 'subject-type-custom-add';

          const doAdd = () => {
            const val = inp.value.trim();
            if (!val || pending.subjectType.includes(val)) { inp.value = ''; return; }
            pending.subjectType.push(val);
            inp.value = '';
            expand();
            setLabel();
            render();
          };
          addBtn.onclick = doAdd;
          inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); doAdd(); } });

          customRow.append(inp, addBtn);
          el.appendChild(customRow);
        };
        render();
      },
    });
  }
}

META_SECTIONS.push(new SubjectTypeSection());
