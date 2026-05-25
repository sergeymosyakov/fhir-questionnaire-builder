// ── Answer Type sections — barrel ────────────────────────────────────────────
// Imports each section module (triggering self-registration into SECTION_REGISTRY)
// and re-exports the registry so modal.js has a single stable import path.

export { SECTION_REGISTRY } from './base-section.js';

import './sections/choice.js';
import './sections/reference.js';
import './sections/unit.js';
import './sections/numeric.js';
import './sections/placeholder.js';
import './sections/orientation.js';
import './sections/display-cat.js';
import './sections/attach.js';
