# enableWhen & visibility

Any item — a question, a display note or a whole group — can be shown or hidden
based on the answers to other questions. This is configured in the item's
**Show When** editor and maps to FHIR's `item.enableWhen` / `enableBehavior`,
with an optional SDC `enableWhenExpression` for advanced cases.

## Opening the editor

Each item in the builder tree has a **Show When** control. Opening it shows the
"Show When" dialog with three parts: a behaviour selector, a list of conditions,
and an advanced FHIRPath field.

## Conditions

Click **+ Add condition** to add a rule. Each condition row has three parts:

1. **Question** — the item whose answer to test (referenced by its `linkId`).
2. **Operator** — the comparison, which adapts to the selected question's answer
   type.
3. **Value** — the value to compare against (an option, number, date, etc.).

Use the **✕** button to remove a condition.

### Operators by answer type

The operators offered depend on the type of the question you pick:

| Question type | Operators offered |
|---|---|
| Boolean (checkbox) | *is Yes (checked)*, *is No (unchecked)*, *has answer*, *has no answer* |
| Choice (radio, drop-down, checklist, open-choice) | `=`, `≠`, *has answer*, *has no answer* — value picked from the question's options |
| Integer / decimal / number | `=`, `≠`, `>`, `<`, `>=`, `<=` with a numeric value |
| Quantity | numeric comparison plus a unit |
| Date / dateTime / time | comparison operators with a date/time picker |

*has answer* / *has no answer* map to the FHIR `exists` operator.

## ALL vs ANY

The **Show when … conditions are met** selector at the top sets
`item.enableBehavior`:

- **ALL (AND)** — every condition must be true.
- **ANY (OR)** — at least one condition must be true.

For a question that repeats, a condition is considered met if **any** of its
answers satisfies it (per the FHIR R4 rule).

## When not visible

The **When not visible** selector controls what happens to an item whose
condition is not met. It maps to the SDC `disabledDisplay` extension:

- **Show grayed (protected)** — the item stays on screen, greyed out and
  read-only.
- **Remove from view (hidden)** — the item is removed from the form entirely.

## FHIRPath expression (advanced)

Below the condition list is an **enableWhenExpression (SDC)** field. Instead of
(or in addition to) the simple condition rows, you can supply a FHIRPath
expression that returns a boolean, for example:

```
%age > 18 and %gender = 'male'
```

The expression is evaluated against the live `QuestionnaireResponse` with the
same variable environment used elsewhere in the runtime. If an
`enableWhen` list is present it takes precedence; the expression is used when no
simple conditions are defined.

### Build it visually

You don't have to write the FHIRPath by hand. Next to the field is a **🧩 Build…**
button that opens a condition builder. It shows the condition as a **tree**: nested
**ALL (AND)** / **ANY (OR)** groups, each leaf a single rule (pick a question, a
comparison or "has answer" / "has no answer", and a value — or edit that one leaf as
text). Every node shows a live ✓/✗ result. Add conditions and sub-groups, and press
**Apply** to drop the generated expression into the field. Opening the builder on an
existing expression reads it back into the tree, so even complex conditions stay
visible and editable.

## Copying to other items

The **Show When** dialog can copy the current visibility setup — conditions,
behaviour, disabled-display and expression — onto other items in one step, so a
group of questions can share the same rule.

## Live preview

The right-hand preview evaluates visibility on every edit. Items whose condition
is not met are hidden or greyed according to your **When not visible** choice.
Note that a hidden item still participates in `calculatedExpression` and
`enableWhen` logic — it is only removed from what the user sees.

---

Next: [FHIRPath expressions](fhirpath.md).
