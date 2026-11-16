// Base class of a library condition-leaf kind. A subclass is registered once (its statics describe the kind); each
// leaf in the condition tree that has this shape is an instance holding its own state.
export class LeafKind {
  static id = '';             // registry key
  static switchLabel = '';    // set when the author can start a leaf of this kind (offered as a link)
  static available() { return true; }          // (ctx) usable here? ctx = { createChain } when the host can nest value chains
  static create() { return null; }             // (items, from, ctx) → a fresh instance; `from` = the row being replaced
  static fromBlock() { return null; }          // (block, items, ctx) → instance | null; never claims an unknown question

  constructor(items) { this.items = items; }

  backLabel = '';                              // set to offer a link back to the single-question row
  _notify = null;                              // the host's change callback, set when the leaf is drawn
  changed() { this._notify?.(); }               // a nested editor (a calculation) reports its edits here
  firstItem() { return null; }                 // the question to carry over when going back
  render() {}                                  // (host, { notify, rerender }) fill with the editing controls
  toBlock() { return null; }                   // → block, or null while incomplete
}
