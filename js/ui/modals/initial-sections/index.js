export { INITIAL_SECTIONS } from './registry.js';
import './init-value.js';
import { INITIAL_SECTIONS } from './registry.js';

export function renderInitialSections(container, pending) {
  container.innerHTML = '';
  for (const s of INITIAL_SECTIONS) container.appendChild(s.build(pending));
}
