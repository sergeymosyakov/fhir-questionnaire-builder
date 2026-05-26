// ── Answer Type sections — barrel ────────────────────────────────────────────
// Imports each section module (triggering self-registration into ANSWER_TYPE_SECTIONS)
// and re-exports the registry so modal.js has a single stable import path.

export { ANSWER_TYPE_SECTIONS } from './registry.js';

import './sections/choice.js';
import './sections/reference.js';
import './sections/unit.js';
import './sections/numeric.js';
import './sections/placeholder.js';
import './sections/orientation.js';
import './sections/display-cat.js';
import './sections/attach.js';
import { ANSWER_TYPE_SECTIONS } from './registry.js';

export function renderAnswerTypeSections(container, pending, type) {
  container.innerHTML = '';
  for (const s of ANSWER_TYPE_SECTIONS) {
    if (s.isVisible(type)) container.appendChild(s.build(pending));
  }
}

