// A small keyed registry of definitions: one definition per key, registered once. Backs the
// expression-builder libraries (blocks, operand kinds, leaf kinds) so each only names what it stores.
export class Registry {
  /** @param {{ name: string, key?: string }} opts  name = what is stored ("block"), key = the property that identifies it */
  constructor({ name, key = 'id' }) {
    this._name = name;
    this._key = key;
    this._defs = new Map();
  }

  register(def) {
    const id = def?.[this._key];
    if (!id) throw new Error(`A ${this._name} definition needs "${this._key}"`);
    if (this._defs.has(id)) throw new Error(`${this._name} "${id}" is already registered`);
    this._defs.set(id, def);
    return def;
  }

  get(id) { return this._defs.get(id) || null; }
  has(id) { return this._defs.has(id); }
  all() { return [...this._defs.values()]; }

  /** First non-null result of `fn(def)` over the definitions, in registration order. */
  first(fn) {
    for (const def of this._defs.values()) {
      const result = fn(def);
      if (result) return result;
    }
    return null;
  }
}
