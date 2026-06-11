import { formatRegistry, setBuilderVersion } from '../format-registry.js';

formatRegistry.register({
  id:               'R4B',
  label:            'FHIR R4B JSON (.json)',
  selectorLabel:    'FHIR R4B',
  isBuilderVersion: true,
  metaVersion:      '4.3.0',
  ext:              'json',
  mimeType:         'application/json',
  reportTitle:      'Export \u2014 Validation Report',
  build(baseQ) {
    const q = JSON.parse(JSON.stringify(baseQ));
    q.meta = q.meta ?? { lastUpdated: new Date().toISOString() };
    setBuilderVersion(q, '4.3.0');
    return q;
  },
});
