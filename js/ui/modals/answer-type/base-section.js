// ── Answer Type section base class ───────────────────────────────────────────
// AnswerTypeSection is the base class for all type-specific panel sections.
// Each concrete subclass lives in sections/ and implements:
//   isVisible(type)        → boolean, controls top-level show/hide
//   build(pending)         → HTMLElement, builds section DOM (called each open)
//   onTypeChange(type)     → optional, reacts to type dropdown changes
//   commit(pending, node)  → writes draft values back to the node on Apply
//   initPending(node)      → returns object of draft fields to merge into _pending
//
// Subclasses self-register via ANSWER_TYPE_SECTIONS.push() at module load time.

import { Section } from '../section.js';

export class AnswerTypeSection extends Section {
  isVisible(_type)        { return false; }
  onTypeChange(_type)     {}
  commit(_pending, _node) {}
  initPending(_node)      { return {}; }
}
