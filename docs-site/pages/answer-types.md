# Answer types & options

Every question has an **answer type** that decides what the user can enter and
which control renders. For choice questions you also decide **where the options
come from**. Both are configured in the item's **Answer Type** editor.

## Choosing the answer type

The answer type maps directly to a FHIR `item.type`: text, integer, decimal,
quantity, boolean, choice, open-choice, date, dateTime, time, URL, attachment or
reference. See [Questionnaire & items](questionnaire-items.md) for the full list
and how each maps to FHIR.

Choice questions can be shown as **radio buttons**, a **drop-down**, or
**check-boxes** (a multi-select "checklist"); the underlying FHIR type stays
`choice` either way. The Answer Type editor also offers three display options:
**Autocomplete** (a searchable drop-down, so people can type to filter a long
list), **Lookup** (live search against a server, for a drop-down that uses an
external value set) and **Answer table** (shows the options as table columns, for
radio and check-box questions).

## Where choice options come from

A choice/open-choice question can get its options from one of four sources,
selected at the top of the Answer Type editor:

- **Options list** — a fixed list you build row by row, each row with a code and a
  label (e.g. `M` / `Male`), plus optional score, prefix and weight. Rows can also
  be marked as exclusive (picking it clears the other choices).
- **A bound value set** — reference a `ValueSet` by canonical URL
  (`answerValueSet`). External value sets are expanded through the configured
  terminology server, and the editor has a **Test expansion** action so you can
  check the URL resolves. A value set contained inside the questionnaire is used
  directly.
- **Expression** — generate the options at run time with FHIRPath
  (`answerExpression`), instead of a fixed list. See
  [FHIRPath in the builder](fhirpath.md).
- **Candidate** — like an expression, but it produces suggested answers for the
  respondent to choose from (`candidateExpression`). It cannot be combined with an
  expression or a fixed options list on the same question.

## Scoring options

Options can carry numeric scores — an **ordinal value** or an **item weight** —
which are useful for questionnaires that sum answers into a total (risk scores,
screening tools). Options can also show a short **prefix** before each label.

## Layout of options

For inline choice lists you can control the presentation:

- **Column count** — lay the options out across several columns.
- **Orientation** — arrange them horizontally or vertically.

These are rendering recommendations applied to the inline radio / check-box
layouts in the preview.

## Numbers with units

Integer and decimal questions can declare a **unit** (e.g. `kg`, `mmHg`), and a
quantity question can offer a **unit drop-down** bound to a units value set.

---

Next: [Validation](validation.md).
