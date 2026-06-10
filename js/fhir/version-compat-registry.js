// ── FHIR Version Compatibility Registry ──────────────────────────────────────
// Collects self-registering checkers that produce human-readable warning
// messages when the user switches between FHIR versions.
//
// Checker interface (implement in js/fhir/version-compat/*.js):
//   class MyChecker extends VersionCompatChecker {
//     // Return true when this checker applies to the given transition.
//     applies(fromId, toId) { ... }
//     // Walk `tree` and return 0..N warning strings (sync or async).
//     check(fromId, toId, tree) { return []; }
//   }
//   versionCompatRegistry.register(new MyChecker());
//
// Usage (in builder/index.js):
//   const msgs = await versionCompatRegistry.runAll(fromId, toId, tree);
//   // msgs is a flat string[] of all warnings from all applicable checkers.

export class VersionCompatChecker {
  /**
   * Return true when this checker is relevant for the given transition.
   * @param {string} fromId  e.g. 'R4'
   * @param {string} toId    e.g. 'R5'
   * @returns {boolean}
   */
  applies(_fromId, _toId) { return false; }

  /**
   * Inspect the tree and return zero or more warning strings.
   * May be async (e.g. for future server-side checks).
   * @param {string} fromId
   * @param {string} toId
   * @param {object[]} tree  internal node tree
   * @returns {string[] | Promise<string[]>}
   */
  check(_fromId, _toId, _tree) { return []; }
}

class VersionCompatRegistry {
  /** @type {VersionCompatChecker[]} */
  _checkers = [];

  /** @param {VersionCompatChecker} checker */
  register(checker) {
    this._checkers.push(checker);
  }

  /**
   * Run all applicable checkers and return a flat list of warning messages.
   * @param {string} fromId
   * @param {string} toId
   * @param {object[]} tree
   * @returns {Promise<string[]>}
   */
  async runAll(fromId, toId, tree) {
    const active = this._checkers.filter(c => c.applies(fromId, toId));
    const results = await Promise.all(active.map(c => Promise.resolve(c.check(fromId, toId, tree))));
    return results.flat();
  }
}

export const versionCompatRegistry = new VersionCompatRegistry();
