import { formatRegistry } from '../format-registry.js';
import { fromFHIR, redcapCompatValidator } from '../converters/redcap/index.js';

formatRegistry.register({
  id:               'redcap',
  label:            'REDCap CSV \u2014 Data Dictionary (.csv)',
  isBuilderVersion: false,
  metaVersion:      null,
  ext:              'csv',
  mimeType:         'text/csv;charset=utf-8;',
  reportTitle:      'REDCap Export \u2014 Compatibility Report',  // Exclude the FHIR server validator: it validates FHIR spec conformance, which
  // is irrelevant when the output is a REDCap CSV. Only local + redcap-compat run.
  validatorFilter:  v => v.type !== 'external',  /** Returns a CSV string from a base FHIR R4 Questionnaire object. */
  build(baseQ) { return fromFHIR(baseQ); },
  onBeforeReport() { redcapCompatValidator.enabled = true; },
  onAfterExport()  { redcapCompatValidator.enabled = false; },
  onCancel()       { redcapCompatValidator.enabled = false; },
});
