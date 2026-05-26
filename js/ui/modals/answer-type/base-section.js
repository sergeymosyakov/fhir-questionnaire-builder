// ── Answer Type section base class + shared registry ─────────────────────────
// AnswerTypeSection is the base class for all type-specific panel sections.
// Each concrete subclass lives in sections/ and implements:
//   isVisible(type)       → boolean, controls top-level show/hide
//   build(pending)        → HTMLElement, builds section DOM (called each open)
//   onTypeChange(type)    → optional, reacts to type dropdown changes
//   commit(pending, node) → writes draft values back to the node on Apply
//   initDraft(node)       → returns object of draft fields to merge into _pending
//
// Subclasses self-register via SECTION_REGISTRY.push() at module load time.

import { Section } from '../section.js';

export const SECTION_REGISTRY = [];

export class AnswerTypeSection extends Section {
  isVisible(type)       { return false; }                          // eslint-disable-line no-unused-vars
  onTypeChange(type)    {}                                         // eslint-disable-line no-unused-vars
  commit(pending, node) {}                                         // eslint-disable-line no-unused-vars
  initDraft(node)       { return {}; }                             // eslint-disable-line no-unused-vars
}
