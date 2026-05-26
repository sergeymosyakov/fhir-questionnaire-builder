export { EXPR_SECTIONS } from './registry.js';
export { makeExprField } from './helpers.js';
import './calc.js';
import './init.js';
import { EXPR_SECTIONS } from './registry.js';

export function renderExprSections(container, pending) {
  container.innerHTML = '';
  EXPR_SECTIONS.forEach((s, i) => {
    if (i > 0) {
      const sep = document.createElement('div');
      sep.className = 'expr-modal-sep';
      container.appendChild(sep);
    }
    container.appendChild(s.build(pending));
  });
}
