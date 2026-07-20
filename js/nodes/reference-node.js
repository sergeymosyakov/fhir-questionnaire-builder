// ── ReferenceNode ─────────────────────────────────────────────────────────────
// FHIR resource reference input. itemType: 'reference'
// Optional FHIR-imported: referenceResource (allowed type, e.g. 'Patient')
import { ItemNode } from './item-node.js';
import { NODE_REGISTRY } from './registry.js';
import { BaseNode, createWrap } from './base-node.js';
import { createCustomSelect } from '../ui/custom-select.js';
import { serverConfig, CONFIG_KEYS } from '../fhir/server-config.js';
import { searchFhir, displayName as _displayName } from '../fhir/fhir-search.js';
import { refTypeMismatch } from '../fhir/form-checks.js';

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

// ── FHIR resource search ──────────────────────────────────────────────────────




export class ReferenceNode extends ItemNode {
  constructor(data = {}) {
    super(data);
    this.itemType = 'reference';
  }

  buildControl(ctx) {
    const node = this;
    const { getValue, setValue, onChange, _reCalc } = ctx;
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
      onChange:  () => { update(); BaseNode.notifyChanged(); },
    });

    const sep = document.createElement('span');
    sep.textContent = '/';
    sep.className = 'ref-sep';

    const idInput = document.createElement('input');
    idInput.type        = 'text';
    idInput.placeholder = serverConfig.get(CONFIG_KEYS.FHIR_BASE) ? 'search or enter id' : 'id';
    idInput.value       = initId;
    idInput.className   = 'ref-id-input';

    const errMsg = document.createElement('span');
    errMsg.className   = 'ctrl-err ctrl-err--ml';
    errMsg.textContent = 'id is required';

    // Type-mismatch error — shown when the current reference points at a resource
    // type other than the item's allowed type (e.g. from import or an expression).
    const typeErr = document.createElement('span');
    typeErr.className = 'ctrl-err ctrl-err--ml';
    typeErr.dataset.testid = 'ref-type-error';
    typeErr.style.display = 'none';
    const refreshTypeErr = () => {
      const cur = getValue(node.id);
      const mismatch = !!node.referenceResource && refTypeMismatch(cur, node.referenceResource);
      typeErr.textContent  = mismatch ? `Expected ${node.referenceResource}` : '';
      typeErr.style.display = mismatch ? 'inline' : 'none';
    };

    const update = () => {
      const type = sel.getValue();
      const id   = idInput.value.trim();
      errMsg.style.display = (type && !id) ? 'inline' : 'none';
      setValue(node.id, (type && id) ? { reference: type + '/' + id } : undefined);
      refreshTypeErr();
      _reCalc(); onChange();
    };

    idInput.oninput  = update;
    idInput.onchange = () => { BaseNode.notifyChanged(); };

    // ── Search autocomplete (when fhirBaseUrl is configured) ─────────────────
    if (serverConfig.get(CONFIG_KEYS.FHIR_BASE)) {
      const searchWrap = document.createElement('div');
      searchWrap.className = 'ref-search-wrap';

      // Portal: mount dropdown on body to escape overflow:hidden parents
      const dropdown = document.createElement('div');
      dropdown.className = 'ref-search-drop';
      dropdown.style.display = 'none';
      document.body.appendChild(dropdown);

      const positionDrop = () => {
        const r = idInput.getBoundingClientRect();
        const dropW = 240;
        dropdown.style.position = 'fixed';
        dropdown.style.top  = (r.bottom + 4) + 'px';
        dropdown.style.width = dropW + 'px';
        dropdown.style.maxHeight = '220px';
        // flip left if would overflow viewport
        const left = r.right - dropW;
        dropdown.style.left = Math.max(4, left) + 'px';
      };

      let _debounceTimer = null;

      const closeDropdown = () => { dropdown.style.display = 'none'; };
      const openDropdown  = () => { positionDrop(); dropdown.style.display = 'block'; };

      const showResults = (results, query) => {
        dropdown.innerHTML = '';
        if (results.length === 0) {
          const empty = document.createElement('div');
          empty.className = 'ref-search-empty';
          empty.textContent = query.trim() ? 'No results' : 'Type to search…';
          dropdown.appendChild(empty);
        } else {
          results.forEach(r => {
            const item = document.createElement('button');
            item.type = 'button';
            item.className = 'ref-search-item';
            const nameSpan = document.createElement('span');
            nameSpan.className = 'ref-search-name';
            nameSpan.textContent = r.display;
            const idSpan = document.createElement('span');
            idSpan.className = 'ref-search-id';
            idSpan.textContent = r.id;
            item.append(nameSpan, idSpan);
            item.addEventListener('mousedown', e => {
              e.preventDefault();
              idInput.value = r.id;
              update();
              BaseNode.notifyChanged();
              closeDropdown();
            });
            dropdown.appendChild(item);
          });
        }
        openDropdown();
      };

      const doSearch = async (query) => {
        const resourceType = sel.getValue();
        if (!resourceType) { closeDropdown(); return; }
        const loading = document.createElement('div');
        loading.className = 'ref-search-empty';
        loading.textContent = 'Searching…';
        dropdown.innerHTML = '';
        dropdown.appendChild(loading);
        openDropdown();
        try {
          const results = await searchFhir(resourceType, query);
          showResults(results, query);
        } catch (e) {
          const err = document.createElement('div');
          err.className = 'ref-search-empty ref-search-error';
          err.textContent = e.message || 'Search failed';
          dropdown.innerHTML = '';
          dropdown.appendChild(err);
        }
      };

      idInput.addEventListener('input', () => {
        clearTimeout(_debounceTimer);
        const q = idInput.value.trim();
        if (!q) { closeDropdown(); return; }
        _debounceTimer = setTimeout(() => doSearch(q), 350);
      });

      idInput.addEventListener('focus', () => {
        if (idInput.value.trim()) doSearch(idInput.value.trim());
      });

      idInput.addEventListener('blur', () => {
        setTimeout(closeDropdown, 150);
      });

      // Clean up portal element when node is destroyed (AbortController signal)
      if (node._ac?.signal) {
        node._ac.signal.addEventListener('abort', () => { dropdown.remove(); }, { once: true });
      }

      searchWrap.appendChild(idInput);
      wrap.appendChild(sel.el);
      wrap.appendChild(sep);
      wrap.appendChild(searchWrap);
    } else {
      wrap.appendChild(sel.el);
      wrap.appendChild(sep);
      wrap.appendChild(idInput);
    }

    wrap.appendChild(errMsg);
    wrap.appendChild(typeErr);
    refreshTypeErr();

    if (node._referenceProfiles?.length) {
      const info = document.createElement('span');
      info.className = 'ctrl-ref-info';
      info.textContent = 'Profile: ' + node._referenceProfiles.join(', ');
      info.dataset.tipTitle = 'questionnaire-referenceProfile';
      info.dataset.tipBody  = 'Allowed profiles:\n' + node._referenceProfiles.join('\n');
      info.dataset.tipFhir  = 'item.extension[questionnaire-referenceProfile].valueCanonical';
      info.dataset.tipSpec  = 'R4';
      wrap.appendChild(info);
    }

    if (node._referenceFilter) {
      const info = document.createElement('span');
      info.className = 'ctrl-ref-info';
      info.textContent = 'Filter: ' + node._referenceFilter;
      info.dataset.tipTitle = 'questionnaire-referenceFilter';
      info.dataset.tipBody  = 'Server-side filter expression:\n' + node._referenceFilter;
      info.dataset.tipFhir  = 'item.extension[questionnaire-referenceFilter].valueString';
      info.dataset.tipSpec  = 'R4';
      wrap.appendChild(info);
    }

    return wrap;
  }
}

NODE_REGISTRY.set('reference',   ReferenceNode);
