export { STATES_SECTIONS } from './registry.js';
import './required.js';
import './read-only.js';
import './hidden.js';
import './collapsible.js';
import './usage-mode.js';
import { STATES_SECTIONS } from './registry.js';

export function renderStatesSections(container, pending) {
  container.innerHTML = '';
  const node = pending.node;
  for (const s of STATES_SECTIONS) {
    if (s.isVisible(node)) container.appendChild(s.build(pending));
  }
}
