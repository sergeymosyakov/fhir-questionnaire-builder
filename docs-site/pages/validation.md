# Validation

The builder validates two different things: the **questionnaire** you are
authoring (is it well-formed FHIR?) and the **answers** entered in the preview
(are they complete and valid?).

## Live answer validation

As you fill in the preview, each control checks its own value and shows an inline
error when something is wrong. A status indicator summarises whether the whole
response is currently valid (a ✓ / ✗ badge). The checks include:

- **Required** — a mandatory item must be answered.
- **Format** — text must match a regular expression / expected format when one is
  set.
- **Text length** — respect the minimum and maximum character counts.
- **Numeric range** — a number must fall within its minimum / maximum value.
- **Reference type** — a reference answer must point at an allowed resource type.
- **Repeat count** — a repeating item must have an allowed number of entries.
- **File rules** — an uploaded file must satisfy the size and type limits.

An inline error and the overall ✓/✗ badge always agree — if a field is invalid,
the response is marked invalid.

## Custom constraints

Beyond the built-in checks you can add your own rules with a
**constraint** — a FHIRPath expression that must evaluate to `true`, paired with
your own error message (`questionnaire-constraint`). Constraints can reference
other answers via `%resource`, so you can express cross-field rules (e.g. "end
date must be after start date"). See [FHIRPath in the builder](fhirpath.md).

## Questionnaire validation on import

When you load a questionnaire, the builder checks its structure and reports any
problems it finds — malformed items, invalid references between items, and
similar issues — so you know what you're working with before you start editing.

Among the things it reports: a **Show When** condition with no operator or no value
to compare with, a question or display item with **no text** (FHIR does not require
text, so this is a warning and the item is exported without it), and a **group with
no items** (exported without an item list, because FHIR does not allow an empty one).

## External FHIR validators (optional)

For authoritative validation against the FHIR specification and profiles, you can
configure one or more **validator servers** in [Settings](settings.md). When set
up, the builder can send the questionnaire (or response) to a validator and show
the returned issues. This is optional — the live checks above work entirely in the
browser with no server.

## Check my form (calculated results)

Scores and calculators can hide mistakes that no single answer reveals — for example a
severity band that can never be reached because a threshold was mistyped. Open
**⚙ Settings ▾ → ✅ Check my form…** and the builder tries many answer combinations
(everything at the lowest and highest answer, one question at a time, questions left
unanswered, and so on) on every calculation in the form. It then lists:

- **Some results can never appear** — the text results (such as "Moderate depression") that
  the calculation is written to give but that no combination of answers produces. Fix the
  thresholds or conditions of that calculation.
- **Never shown** — a question whose Show When rule none of the tried answers satisfies, so nobody could answer it. Check the rule.
- **Never produces a result** — no combination of answers gives the calculation a value.
- **Not checked** — the calculation reads a question that cannot be tried automatically,
  such as a number with no minimum and maximum, or a date. Setting a minimum and maximum
  on number questions lets them be checked.

Each row has a ↗ button that jumps to the calculation in the builder. **Open full report** opens a separate page with the questionnaire that was checked (JSON, collapsed), a summary per calculation with its formula, and one table of every answer combination that was tried: a row per combination, the answers given, and a column with the result of each calculated field. Use **Print summary** to keep a short printed report (per calculation: verdict, formula, the results that appeared and the ones that never did); the long table of answer combinations and the questionnaire JSON stay on screen so a large form still prints. **Download answer sets (CSV)** gives every answer of every combination, with a column per calculation, for a spreadsheet. The check runs
entirely in your browser and changes nothing in the questionnaire.

### Example: the PHQ-9 depression questionnaire

Load the **PHQ-9** template (Add ▾ → templates). It has two calculated fields: *PHQ-9 total score*
(the sum of the nine answers) and *Depression severity* (a text chosen from the total). Check my form
reports "All 2 calculations behave as expected". The full report's table of answer combinations
includes rows such as these (the answers column is shortened here):

| Answers | PHQ-9 total score | Depression severity |
|---------|-------------------|---------------------|
| no answers | — | — |
| every question "Not at all" | 0 | Minimal depression |
| every question "Nearly every day" | 27 | Severe depression |
| the first question "Nearly every day", the rest "Not at all" | 3 | Minimal depression |
| the first two questions "Nearly every day", the rest "Not at all" | 6 | Mild depression |
| the first question left unanswered, the rest "Not at all" | — | — |

A dash means the calculation gave no result: the total is only worked out when all nine questions are
answered. The whole table, a few dozen combinations in all, reaches every band up to
"Moderately severe depression".

Now suppose the threshold for "Moderate depression" is mistyped, so the formula reads `< 10` where it
should read `< 15`. The report then shows, for *Depression severity*, "Some results can never appear"
and the line **Never appeared: "Moderate depression" — given when PHQ-9 total score < 10**: every total
below 10 is already caught by the "Mild depression" condition above it, so that band can never be reached.
The table of combinations has no row with "Moderate depression".

Treat the list as a pointer to review, not a verdict:

- It only looks at questions outside repeating groups.
- It follows Show When rules: an answer to a question that is switched off is left out, as a person could not give it. A rule that reads a question it cannot try (a number without a minimum and maximum, or a date) is not judged.
- It reads the results a calculation is written to give from its `iif(...)` branches, so a
  result produced another way is not checked.
- On a very large form not every combination is tried, and the list says so.

## Quality audit (advisory, separate from validation)

Alongside validation there's a separate **Quality audit** — a set of advisory
checks that flag things which aren't strictly invalid FHIR but are usually
authoring mistakes, e.g. an `enableWhen` condition that can never be true, or a
choice item that would benefit from an `answerValueSet` binding it doesn't have.
Unlike validation, the audit **never blocks import or export** — it's purely
informational and only runs when you explicitly ask for it (**⚙ Settings ▾ → Validate**,
with the **Quality audit** checkbox ticked in that menu). Its findings show up alongside
the validation results but are visually distinct so they're never mistaken for
errors that must be fixed before exporting.

---

Next: [Generate a documentation report](generate-docs.md).
