// Base class of a library operand kind in the value editor's chain. A subclass is registered once (its statics
// describe the kind); each operand in a chain is an instance holding its own state.
export class OperandKind {
  static id = '';             // operand.kind
  static label = '';          // entry in the kind picker
  static block = false;       // true: the operand needs a row of its own
  static solo = false;        // true: it only makes sense as a chain's single value (no "add operand" beside it)
  static available() { return true; }          // ctx = { branch, alone, items, allItems, variables, fp }
  static fromBlock() { return null; }          // (block, ctx) → instance | null (not this kind's shape)

  /** @param ctx { items, allItems, variables, fp, branch, onChange, createChain(opts) } */
  constructor(ctx) { this.ctx = ctx; }

  get kind() { return this.constructor.id; }
  render() {}                                  // (host) fill it with the editing controls
  toBlock() { return null; }                   // → block, or null while incomplete
}
