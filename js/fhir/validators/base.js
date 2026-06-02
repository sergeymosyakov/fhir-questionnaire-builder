// ── Validator base class ──────────────────────────────────────────────────────
// All validators implement the same interface:
//   get id()                            → unique string identifier ('local', 'external', …)
//   get name()                          → display name shown in the modal
//   get type()                          → 'local' | 'external' (informational badge)
//   async _run(questJson, tree, values) → Issue[]  ← subclasses override this
//
// Base class handles the enabled flag automatically:
//   - listens to AppEvents.VALIDATOR_TOGGLE { id, enabled }
//   - if !this.enabled, run() returns [] without calling _run()
//
// Issue shape: { severity: 'error'|'warning', nodeId: string, message: string }

import { AppEvents } from '../../events.js';

export class Validator {
  constructor() {
    this.enabled = true;
    // Guard for test/node environments where document is not available
    if (typeof document !== 'undefined') {
      document.addEventListener(AppEvents.VALIDATOR_TOGGLE, e => {
        if (e.detail?.id === this.id) this.enabled = e.detail.enabled;
      });
    }
  }

  /** @returns {string} unique identifier — must match the id used in VALIDATOR_TOGGLE events */
  get id() { return ''; }

  /** @returns {string} */
  get name() { throw new Error('Validator.name must be implemented'); }

  /** @returns {'local'|'external'} */
  get type() { return 'local'; }

  /**
   * Entry point. Returns [] immediately if disabled.
   * Subclasses override _run(), not this method.
   *
   * @param {object}  questJson  Exported FHIR Questionnaire JSON
   * @param {Array}   tree       Internal node tree (for local validators)
   * @param {object}  values     Current form values (for local validators)
   * @returns {Promise<Array<{severity:string, nodeId:string, message:string}>>}
   */
  async run(questJson, tree, values) {
    if (!this.enabled) return [];
    return this._run(questJson, tree, values);
  }

  // eslint-disable-next-line no-unused-vars
  async _run(questJson, tree, values) { return []; }
}

