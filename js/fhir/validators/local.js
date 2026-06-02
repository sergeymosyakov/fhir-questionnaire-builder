// ── LocalValidator ────────────────────────────────────────────────────────────
// Wraps the synchronous validateTree() function as a Validator.

import { Validator } from './base.js';
import { validateTree } from '../validate.js';

export class LocalValidator extends Validator {
  constructor({ name = 'Built-in' } = {}) {
    super();
    this._name = name;
  }

  get name() { return this._name; }
  get type() { return 'local'; }

  async run(_questJson, tree, values = {}) {
    return validateTree(tree, values);
  }
}
