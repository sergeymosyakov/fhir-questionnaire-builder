import { Section } from '../section.js';
import { META_SECTIONS } from './registry.js';
import { makeRow } from './helpers.js';
import { FHIR } from '../../../fhir/urls/fhir.js';

const PREF_TERM_URL = FHIR.preferredTerminologyServer;

class TerminologyServerSection extends Section {
  build(pending) {
    const frag = document.createDocumentFragment();
    frag.appendChild(makeRow(
      pending,
      'preferredTermServer',
      'Default Terminology Server',
      'text',
      'https://tx.fhir.org/r4',
      'meta-preferred-term-server',
      {
        title: 'sdc-questionnaire-preferredTerminologyServer',
        body:  'Questionnaire-level default FHIR terminology server URL for ValueSet expansion. ' +
               'Applied to all items that do not have their own per-item server override. ' +
               `Extension URL: ${PREF_TERM_URL}`,
        fhir:  'Questionnaire.extension[sdc-questionnaire-preferredTerminologyServer].valueUrl',
        spec:  'SDC',
      }
    ));
    return frag;
  }
}

META_SECTIONS.push(new TerminologyServerSection());
