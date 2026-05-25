// ── Answer Type section base class + shared registry ─────────────────────────
// AnswerTypeSection is the base class for all type-specific panel sections.
// Each concrete subclass lives in sections/ and implements:
//   isVisible(type)       → boolean, controls top-level show/hide
//   build(pending)        → HTMLElement, builds section DOM (called each open)
//   onTypeChange(type)    → optional, reacts to type dropdown changes
//   commit(pending, node) → writes draft values back to the node on Apply
//
// Subclasses self-register via SECTION_REGISTRY.push() at module load time.

export const SECTION_REGISTRY = [];

export class AnswerTypeSection {
  isVisible(type)       { return false; }                          // eslint-disable-line no-unused-vars
  build(pending)        { return document.createElement('div'); }  // eslint-disable-line no-unused-vars
  onTypeChange(type)    {}                                         // eslint-disable-line no-unused-vars
  commit(pending, node) {}                                         // eslint-disable-line no-unused-vars
}
