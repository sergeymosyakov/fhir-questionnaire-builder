# FHIRPath in the builder

[FHIRPath](https://hl7.org/fhirpath/) is the expression language the builder uses
for everything dynamic: computed answers, initial values, conditional visibility,
dynamic option lists and validation. Expressions run in the browser through the
bundled FHIRPath engine, evaluated live against the current form state.

## What expressions run against

Every expression is evaluated against the questionnaire's live
**`QuestionnaireResponse`**. That resource is exposed as `%resource`, so you read
answers with normal FHIRPath, for example:

```
%resource.item.where(linkId='weight').answer.value
```

Alongside `%resource`, expressions can use:

- **`%questionnaire`** — the `Questionnaire` itself (used, for example, in
  constraint expressions).
- **`%varName`** — any questionnaire-level variable you have defined (see below).
- **Launch-context variables** — `%patient`, `%user`, `%encounter`, etc. when
  declared as launch contexts.

## Questionnaire variables

The **Variables** card above the builder tree defines reusable, questionnaire-level
FHIRPath variables (the SDC `sdc-questionnaire-variable` extension). Each variable
has a **name** and an **expression** and is referenced elsewhere as `%name`.

Variables are evaluated **in order**, and a later variable may reference an earlier
one. They are imported and exported as `sdc-questionnaire-variable` extensions. The
card's **↺ Re-init** button re-evaluates all variables and item `initialExpression`
fields.

## Launch contexts

Launch contexts declare named resources a questionnaire expects at run time —
`%patient`, `%user`, `%encounter` and so on (the SDC
`sdc-questionnaire-launchContext` extension). They are configured in the
Questionnaire properties and are what an SDC server uses to pre-populate the form
via `$populate`.

## Where FHIRPath is used

The same engine powers several features, each backed by a different FHIR field:

| Feature | FHIR field | Purpose |
|---|---|---|
| Calculated answer | `calculatedExpression` (SDC) | Compute a read-only value from other answers |
| Initial value | `initialExpression` (SDC) | Seed an answer when the form loads |
| Visibility | `enableWhenExpression` (SDC) | Show/hide an item — see [enableWhen & visibility](enablewhen.md) |
| Dynamic options | `answerExpression` (SDC) | Produce choice options at render time |
| Validation | `questionnaire-constraint` expression | Must return `true` to pass — uses `%resource` and `%questionnaire` |

## Evaluation order

Calculated fields often depend on one another (A → B → C). The runtime builds a
dependency graph from the expressions and evaluates calculated nodes in
**topological order**, so a chain resolves correctly no matter how the items are
arranged in the tree. Each computed value is written back into the
`QuestionnaireResponse` within the same pass, so downstream expressions read the
fresh value. Circular dependencies are evaluated best-effort in tree order.

## Live and safe to experiment

Expressions are re-evaluated on every edit, and the preview updates immediately.
An expression that fails to parse or throws is skipped rather than breaking the
form, so you can iterate on a formula and watch the result change as you type. A
short example of the kind of expression you might write:

```
%age > 18 and %gender = 'male'
```

---

Next: [Extensions & SDC](extensions-sdc.md).
