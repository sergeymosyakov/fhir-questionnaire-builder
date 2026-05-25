// ── Generic modal section base class ─────────────────────────────────────────
// Any modal that composes its body from self-registering sections should have
// its section classes extend Section (directly or via a modal-specific subclass
// such as AnswerTypeSection).
//
// Minimum contract:  build(pending) → HTMLElement | DocumentFragment
// Modal-specific subclasses add lifecycle methods as needed.

export class Section {
  /** Build and return the DOM element (or fragment) for this section.
   *  @param {object} _pending — the modal's shared draft/data object
   *  @returns {HTMLElement | DocumentFragment} */
  build(_pending) { return document.createElement('div'); }
}
