// ── ItemNode ──────────────────────────────────────────────────────────────────
// Abstract base for all question item nodes (type: 'item').
// Concrete subclasses set `this.itemType` and may add type-specific defaults.
// Optional FHIR-imported properties set after construction (all item types):
//   _readOnly, _prefix, _definition, _codes, _hidden, _designNote,
//   _renderXhtml, _renderStyle, _supportLinks, _disabledDisplay,
//   _enableWhenText, _unknownExtensions, _answerValueSet,
//   _initialValue, _initialValues, _initialSelected
import { BaseNode } from './base-node.js';

export class ItemNode extends BaseNode {
  constructor(data = {}) {
    super(data);
    this.type       = 'item';
    this.repeats    = data.repeats    ?? false;
    this.options    = data.options    ?? '';
    this.constraint = data.constraint ?? [];
  }

  /** Build the interactive preview control element for this node.
   *  Overridden by every concrete subclass.
   *  @param {object} ctx  — { getValue, setValue, onChange, _reCalc, _formTick }
   *  @returns {HTMLElement} wrapper span */
  buildControl(_ctx) {
    throw new Error(`buildControl() not implemented on ${this.constructor.name} (itemType: ${this.itemType})`);
  }
}
