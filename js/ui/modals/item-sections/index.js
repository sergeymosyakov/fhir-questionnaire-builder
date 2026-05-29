export { ITEM_SECTIONS } from './registry.js';
import './definition.js';
import './short-text.js';
import './codes.js';
import './support-links.js';
import './extensions.js';
import { ITEM_SECTIONS } from './registry.js';

export function renderItemSections(container, pending) {
  container.innerHTML = '';
  for (const s of ITEM_SECTIONS) container.appendChild(s.build(pending));
}
