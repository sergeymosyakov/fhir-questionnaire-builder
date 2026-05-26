export { REPEATABLE_SECTIONS } from './registry.js';
import './repeat.js';
import { REPEATABLE_SECTIONS } from './registry.js';

export function renderRepeatableSections(container, pending) {
  container.innerHTML = '';
  for (const s of REPEATABLE_SECTIONS) container.appendChild(s.build(pending));
}
