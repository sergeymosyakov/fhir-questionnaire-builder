// ── LocalValidator ────────────────────────────────────────────────────────────
// Wraps the synchronous validateTree() function as a Validator.

import { Validator } from './base.js';
import { validateTree } from '../validate.js';

export class LocalValidator extends Validator {
  constructor({ name = 'Built-in' } = {}) {
    super();
    this._name = name;
  }

  get id()   { return 'local'; }
  get name() { return this._name; }
  get type() { return 'local'; }

  async _run(questJson, tree, values = {}) {
    // Pass questMeta-like object from questJson root for que-0 name check
    const questMeta = questJson ? { name: questJson.name } : null;
    return validateTree(tree, values, questMeta);
  }
}
