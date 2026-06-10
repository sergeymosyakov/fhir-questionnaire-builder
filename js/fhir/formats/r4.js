import { formatRegistry } from '../format-registry.js';

formatRegistry.register({
  id:               'R4',
  label:            'FHIR R4 JSON (.json)',
  selectorLabel:    'FHIR R4',
  isBuilderVersion: true,
  metaVersion:      '4.0.1',
  ext:              'json',
  mimeType:         'application/json',
  reportTitle:      'Export \u2014 Validation Report',
  build(baseQ) {
    const q = JSON.parse(JSON.stringify(baseQ));
    q.meta = q.meta ?? { lastUpdated: new Date().toISOString() };
    q.meta.fhirVersion = '4.0.1';
    return q;
  },
});
