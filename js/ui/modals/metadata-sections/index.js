export { META_SECTIONS } from './registry.js';
import './hint.js';
import './core-fields.js';
import './narrative.js';
import './terminology-server.js';
import './advanced.js';
import './subject-type.js';
import './derived-from.js';
import './replaces.js';
import './identifiers.js';
import './contact.js';
import './jurisdiction.js';
import './resource-meta.js';
import './codes.js';
import { META_SECTIONS } from './registry.js';

export function renderMetaSections(container, pending, questMeta) {
  for (const s of META_SECTIONS) container.appendChild(s.build(pending, questMeta));
}
