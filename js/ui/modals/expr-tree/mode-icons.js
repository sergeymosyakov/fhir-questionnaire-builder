// The pencil that switches a condition between its controls and its FHIRPath text (tip down-left, as a right-hander holds it).
const NS = 'http://www.w3.org/2000/svg';

export function pencilIcon() {
  const el = document.createElementNS(NS, 'svg');
  el.setAttribute('viewBox', '0 0 16 16');
  el.setAttribute('width', '14');
  el.setAttribute('height', '14');
  el.setAttribute('fill', 'none');
  el.setAttribute('stroke', 'currentColor');
  el.setAttribute('stroke-width', '1.5');
  el.setAttribute('stroke-linejoin', 'round');
  el.setAttribute('stroke-linecap', 'round');
  el.setAttribute('aria-hidden', 'true');
  for (const d of ['M11 2.5l2.5 2.5L5.5 13 2 14l1-3.5z', 'M9.5 4l2.5 2.5']) {
    const path = document.createElementNS(NS, 'path');
    path.setAttribute('d', d);
    el.appendChild(path);
  }
  return el;
}
