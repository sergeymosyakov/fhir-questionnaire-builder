export { applyTip, makeCollapsible } from '../section.js';

export function parseStyle(s) {
  return {
    bold:   /font-weight\s*:\s*bold/i.test(s),
    italic: /font-style\s*:\s*italic/i.test(s),
    color:  (s.match(/(?:^|;)\s*color\s*:\s*([^;]+)/i) || [])[1]?.trim() || '',
  };
}

export function buildStyle(bold, italic, color) {
  const parts = [];
  if (bold)   parts.push('font-weight: bold');
  if (italic) parts.push('font-style: italic');
  if (color)  parts.push('color: ' + color);
  return parts.join('; ');
}

export function makeSectionHdr(title, tipTitle, tipBody, tipFhir, tipSpec) {
  const hdr = document.createElement('div');
  hdr.className = 'expr-section-hdr';
  const label = document.createElement('span');
  label.textContent = title;
  hdr.appendChild(label);
  const key = document.createElement('span');
  key.className = 'expr-section-key';
  key.textContent = tipFhir;
  hdr.appendChild(key);
  hdr.dataset.tipTitle = tipTitle;
  hdr.dataset.tipBody  = tipBody;
  hdr.dataset.tipFhir  = tipFhir;
  hdr.dataset.tipSpec  = tipSpec;
  return hdr;
}
