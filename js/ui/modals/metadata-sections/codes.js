import { Section } from '../section.js';
import { META_SECTIONS } from './registry.js';
import { makeCollapsible } from './helpers.js';
import { renderCodesEditor } from '../codes-modal.js';

class CodesSection extends Section {
  build(pending) {
    return makeCollapsible({
      testid:      'meta-codes-toggle',
      tip:         { title: 'Questionnaire.code', body: 'Structured clinical codes classifying this questionnaire. Enables discovery by clinical terminology browsers and EHR systems.', fhir: 'Questionnaire.code', spec: 'R4' },
      label:       'Codes',
      countFn:     () => pending.codes.filter(c => c.code.trim()).length,
      initialOpen: false,
      liveUpdate:  true,
      buildBody:   ({ el }) => {
        renderCodesEditor(pending.codes, el, 'meta-code', 'code');
      },
    });
  }
}

META_SECTIONS.push(new CodesSection());
