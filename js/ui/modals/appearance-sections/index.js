export { APPEARANCE_SECTIONS } from './registry.js';
import './style.js';
import './xhtml.js';
import './markdown.js';
import './group-layout.js';
import { APPEARANCE_SECTIONS } from './registry.js';

export function renderAppearanceSections(container, pending) {
  container.innerHTML = '';
  for (const s of APPEARANCE_SECTIONS) container.appendChild(s.build(pending));
}
