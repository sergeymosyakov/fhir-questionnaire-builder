# Expression-builder editors for library blocks

The visual editors for the blocks in `js/fhir/expr-builder/blocks/`, plus condition shapes of their own. Two
libraries, one file per kind; importing a file registers it (`js/registry.js` keeps the registered kinds).

- `operands/` — kinds of operand in the value editor's chain: subclasses of `OperandKind` (`operand-kind.js`).
  `group.js` (Group, nests to any depth), `if.js` (If … then … otherwise, with a flat "Otherwise if" list),
  `empty.js` (No value), `math.js` (Round / square root / … of), `power.js` (… to the power of …), `negate.js` (Minus), `duration.js` (Duration: an amount and a calendar unit), `today.js` (Today's date), `text-fn.js` (text / part of text / whole number of), `text.js` (Text), `score.js` (sum/count of answer scores), `scale-total.js` (the `iif(count = N, sum, {})` scale total; imported before `if.js` so it claims that exact shape first). The class statics describe the kind (`id`,
  `label`, `block`, `solo`, `available(ctx)`, `fromBlock(block, ctx)`); each operand in a chain is an instance holding its own state
  and implementing `render(host)` and `toBlock()`. `ctx.createChain()` makes a nested operand chain (a branch).
- `leaves/` — kinds of condition leaf in the condition tree: subclasses of `LeafKind` (`leaf-kind.js`).
  `any-answered.js`, `is-yes.js`, `value-compare.js`, `value-exists.js`. Statics: `id`, `switchLabel`, `available(ctx)`, `create(items, from, ctx)`, `fromBlock(block, items, ctx)` (`ctx.createChain` is present when the host can nest value chains);
  instances implement `render(host, { notify, rerender })` and `toBlock()`. Set `switchLabel` and `create` to let
  the author start a leaf of that kind, and `backLabel` + `firstItem()` to offer the way back.
- `question-select.js` — the question picker every editor shares.

## Adding a kind

1. Subclass `OperandKind` or `LeafKind` in a new file in `operands/` or `leaves/`, register it
   (`registerOperand` / `registerLeafKind`) and import the file in that folder's `index.js`.
2. A `fromBlock` must only claim blocks it can write back exactly (an unknown question is not claimed), so an
   expression is never silently changed when it is opened and applied.
3. Give every control a `data-testid`, register it in the registry comment of the e2e spec, and cover the kind in
   `tests/e2e/expression-builder-conditional.spec.js` (or a spec of its own) including keyboard use.
