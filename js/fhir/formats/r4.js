import { formatRegistry, setBuilderVersion } from '../format-registry.js';
import { backportR5ItemFields } from './_downgrade.js';

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
    backportR5ItemFields(q);
    q.meta = q.meta ?? { lastUpdated: new Date().toISOString() };
    setBuilderVersion(q, '4.0.1');
    return q;
  },
});
