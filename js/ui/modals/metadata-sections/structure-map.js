import { Section } from '../section.js';
import { META_SECTIONS } from './registry.js';
import { makeRow } from './helpers.js';
import { FHIR } from '../../../fhir/urls/fhir.js';

const TARGET_SM_URL = FHIR.targetStructureMap;
const SOURCE_SM_URL = FHIR.sourceStructureMap;

class StructureMapSection extends Section {
  build(pending) {
    const frag = document.createDocumentFragment();
    frag.appendChild(makeRow(
      pending,
      'targetStructureMap',
      'Target StructureMap',
      'text',
      '#structuremap1',
      'meta-target-structure-map',
      {
        title: 'sdc-questionnaire-targetStructureMap',
        body:  'Canonical reference to a StructureMap that transforms a QuestionnaireResponse into other FHIR resources. Use a "#id" reference to a StructureMap added via the Contained Resources panel — external URLs cannot be resolved without a server. Run it via Save \u25BE \u2192 StructureMap Extract. ' +
               `Extension URL: ${TARGET_SM_URL}`,
        fhir:  'Questionnaire.extension[sdc-questionnaire-targetStructureMap].valueCanonical',
        spec:  'SDC',
      }
    ));
    frag.appendChild(makeRow(
      pending,
      'sourceStructureMap',
      'Source StructureMap',
      'text',
      '#structuremap2',
      'meta-source-structure-map',
      {
        title: 'sdc-questionnaire-sourceStructureMap',
        body:  'Canonical reference to a StructureMap that transforms a resource fetched from the FHIR server (e.g. Patient) into a QuestionnaireResponse to pre-fill answers. Use a "#id" reference to a StructureMap added via the Contained Resources panel — external URLs cannot be resolved without a server. Run it via Answers \u25BE \u2192 Fill via StructureMap. ' +
               `Extension URL: ${SOURCE_SM_URL}`,
        fhir:  'Questionnaire.extension[sdc-questionnaire-sourceStructureMap].valueCanonical',
        spec:  'SDC',
      }
    ));
    return frag;
  }
}

META_SECTIONS.push(new StructureMapSection());
