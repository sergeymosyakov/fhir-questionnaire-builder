import { formatRegistry, setBuilderVersion } from '../format-registry.js';

/** Recursively convert open-choice items to R5 native representation. */
function _convertItems(items) {
  if (!Array.isArray(items)) return;
  for (const item of items) {
    if (item.type === 'open-choice') {
      item.type = 'choice';
      if (!item.answerConstraint) item.answerConstraint = 'optionsOrString';
    }
    if (item.item) _convertItems(item.item);
  }
}

formatRegistry.register({
  id:               'R5',
  label:            'FHIR R5 JSON (.json)',
  selectorLabel:    'FHIR R5',
  isBuilderVersion: true,
  metaVersion:      '5.0.0',
  ext:              'json',
  mimeType:         'application/json',
  reportTitle:      'Export \u2014 Validation Report',
  build(baseQ) {
    const q = JSON.parse(JSON.stringify(baseQ));
    if (q.item) _convertItems(q.item);
    q.meta = q.meta ?? { lastUpdated: new Date().toISOString() };
    setBuilderVersion(q, '5.0.0');
    return q;
  },
});
