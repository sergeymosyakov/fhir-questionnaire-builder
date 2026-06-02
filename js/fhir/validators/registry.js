// ── ValidatorRegistry ─────────────────────────────────────────────────────────
// Holds all registered Validator instances and runs them in parallel.
//
// Usage:
//   import { validatorRegistry } from './registry.js';
//   validatorRegistry.register(new LocalValidator());
//   validatorRegistry.register(new ExternalValidator({ ... }));
//
//   const results = await validatorRegistry.runAll(questJson, tree, values);
//   // results: [{ validator, issues, error }]

export class ValidatorRegistry {
  constructor() {
    this._validators = [];
  }

  /** @param {import('./base.js').Validator} validator */
  register(validator) {
    this._validators.push(validator);
  }

  /** @returns {import('./base.js').Validator[]} */
  getAll() { return [...this._validators]; }

  /**
   * Run all validators in parallel.
   * Each result: { validator, issues: Issue[], error: Error|null }
   *
   * Never rejects — errors are captured per-validator in the result.
   *
   * @param {object} questJson
   * @param {Array}  tree
   * @param {object} values
   * @returns {Promise<Array<{validator, issues, error}>>}
   */
  async runAll(questJson, tree, values = {}) {
    return Promise.all(
      this._validators.map(v =>
        v.run(questJson, tree, values)
          .then(issues => ({ validator: v, issues, error: null }))
          .catch(err   => ({ validator: v, issues: [],    error: err }))
      )
    );
  }
}

export const validatorRegistry = new ValidatorRegistry();
