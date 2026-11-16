# Expression-builder block library

Block kinds that live outside the core model (`../model.js`): a conditional value, a combination of values, "no
value", a power, a negation, a calendar duration, today's date, text conversions. Each block is one file that registers a definition; `parse.js`, `emit.js` and `describe.js` ask the
registry (`registry.js`) about any kind they don't know, so they never change when a block is added.

## Adding a block

1. Create `<name>.js` here. Export a kind constant and a builder (`export const KIND = 'name'`,
   `export const name = (...) => ({ kind: KIND, ... })`) and call `registerBlock({ ... })`.
2. Import it in `index.js` (and re-export its builder and constant).
3. Add tests to `tests/expr-blocks.test.js`: parse → emit round trip, the plain-words description, and that the
   calculation gives the same result after being written back from its blocks.
4. If the block should be editable visually, add its editor to `js/ui/modals/expr-blocks/` (see its README).

## Definition

```js
registerBlock({
  kind,                                  // block.kind
  emit(block, { emit }),                 // → FHIRPath text
  describe(block, { describe, title }),  // → plain words, or null when a part cannot be described
  describeExists?(block, negate, ctx),   // wording for "<block> has / has no an answer"
  parseNode?(node, { toBlock, kids, identText }),  // a CST node (e.g. an operator) → block | null
  parseTerm?(term, { toBlock, kids, identText }),  // a CST term (literal, function call) → block | null
  parsePath?({ head, steps, receiver }, ctx),      // a member/function chain → block | null; receiver() = the chain minus its last step
});
```

A hook returns `null` for anything that is not its own shape; the expression then stays text. A block must never
change what the expression calculates: `emit(parse(text))` has to evaluate like `text`.
