// Open-choice answers: a picked option is { code, display, system? }; typed text is a plain string.
// A Quantity also has a code (its unit), so a value means "not a picked option"
export const isCoded = v => v !== null && typeof v === 'object' && v.code !== undefined && v.value === undefined;

/** Text shown in the control for a stored open-choice value. */
export const openChoiceText = v => (isCoded(v) ? (v.display || v.code) : (v === null || v === undefined ? '' : String(v)));

/** The picked option as the stored value (system comes from the option or its raw answerOption). */
export function pickedValue(opt, rawOpt) {
  const system = opt.system || rawOpt?.valueCoding?.system;
  return { code: opt.code, display: opt.display || opt.code, ...(system ? { system } : {}) };
}

/** True when typed text equals a listed option's display or code (exact match). */
export const matchesOption = (text, opts) => !!text && opts.some(o => o.display === text || o.code === text);

/** An initial answer for a node: an open-choice default that names a Coding (or a listed option) is a picked option, other text stays a string. */
export function initialAnswerValue(node, v) {
  if (node.itemType !== 'open-choice' || typeof v !== 'string') return v;
  if (node._initialTexts?.includes(v)) return v;
  const kept = node._initialCodings?.find(c => (c.code ?? c.display) === v);
  if (kept) return { code: kept.code ?? kept.display, ...(kept.display ? { display: kept.display } : {}), ...(kept.system ? { system: kept.system } : {}) };
  const raw = (node._rawAnswerOptions || []).find(o => o.valueCoding && (o.valueCoding.code || o.valueCoding.display) === v);
  return raw ? pickedValue({ code: v, display: raw.valueCoding.display || v }, raw) : v;
}

/** Text for any stored answer value (picked Coding, reference, quantity or plain value). */
export function answerText(v) {
  if (v === null || v === undefined || v === '') return '';
  if (typeof v !== 'object') return String(v);
  if (isCoded(v)) return v.display || v.code;
  if (v.reference !== undefined) return v.display || v.reference;
  if (v.value !== undefined) return v.value === '' ? '' : [v.value, v.unit].filter(x => x !== undefined && x !== '').join(' ');
  return v.name ? String(v.name) : '';
}
