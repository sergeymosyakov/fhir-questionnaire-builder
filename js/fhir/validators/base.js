// ── Validator base class ──────────────────────────────────────────────────────
// All validators implement the same interface:
//   get name()                         → display name shown in the modal
//   get type()                         → 'local' | 'external' (informational)
//   async run(questJson, tree, values) → Issue[]
//
// Issue shape: { severity: 'error'|'warning', nodeId: string, message: string }

export class Validator {
  /** @returns {string} */
  get name() { throw new Error('Validator.name must be implemented'); }

  /** @returns {'local'|'external'} */
  get type() { return 'local'; }

  /**
   * @param {object}  questJson  Exported FHIR Questionnaire JSON
   * @param {Array}   tree       Internal node tree (for local validators)
   * @param {object}  values     Current form values (for local validators)
   * @returns {Promise<Array<{severity:string, nodeId:string, message:string}>>}
   */
  // eslint-disable-next-line no-unused-vars
  async run(questJson, tree, values) { return []; }
}
