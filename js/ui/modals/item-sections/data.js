// Extension value-type constants and draft ↔ FHIR converters.

export const EXT_VALUE_TYPES = [
  'valueString', 'valueBoolean', 'valueInteger', 'valueDecimal',
  'valueCode', 'valueUri', 'valueUrl', 'valueDate', 'valueDateTime', 'valueTime',
  'valueCoding', 'valueCodeableConcept', 'valueQuantity',
  'valueExpression', 'valueReference',
];

export const EXT_COMPLEX = new Set([
  'valueCoding', 'valueCodeableConcept', 'valueQuantity',
  'valueExpression', 'valueReference',
]);
export const EXT_BOOL = new Set(['valueBoolean']);
export const EXT_INT  = new Set(['valueInteger', 'valueUnsignedInt', 'valuePositiveInt']);
export const EXT_DEC  = new Set(['valueDecimal']);

/** Convert a raw FHIR extension object → mutable draft {url, valueType, valueRaw}. */
export function extToDraft(ext) {
  const url      = ext.url || '';
  const valueKey = Object.keys(ext).find(k => k !== 'url');
  if (!valueKey) return { url, valueType: 'valueString', valueRaw: '' };
  const val      = ext[valueKey];
  const valueRaw = (val !== null && typeof val === 'object')
    ? JSON.stringify(val, null, 2)
    : String(val ?? '');
  return { url, valueType: valueKey, valueRaw };
}

/** Reconstruct a FHIR extension object from a draft; returns null for blank/invalid. */
export function draftToExt({ url, valueType, valueRaw }) {
  if (!url.trim() || !valueType) return null;
  let value;
  if (EXT_COMPLEX.has(valueType)) {
    try { value = JSON.parse(valueRaw); } catch { return null; }
  } else if (EXT_BOOL.has(valueType)) {
    value = valueRaw === 'true';
  } else if (EXT_INT.has(valueType)) {
    const n = parseInt(valueRaw, 10);
    if (isNaN(n)) return null;
    value = n;
  } else if (EXT_DEC.has(valueType)) {
    const n = parseFloat(valueRaw);
    if (isNaN(n)) return null;
    value = n;
  } else {
    value = valueRaw;
  }
  return { url: url.trim(), [valueType]: value };
}
