# Preview, Patient View & FHIR JSON

The right-hand panel is a **live runtime**, not a static mock-up. As you edit the
questionnaire on the left, it re-renders immediately and runs the real logic —
expressions, `enableWhen`, calculations and validation. You can look at it in
three ways, chosen from the mode dropdown at the top of the panel.

## The three modes

Switch modes with the preview-mode selector (its label shows the active mode):

- **👁️ Preview** — the form as the *author* sees it, with design aids switched
  on. This is the default and the mode you build in.
- **👤 Patient View** — the form as the *patient* sees it: design aids are gone,
  items marked hidden are removed, and display/collapsible behaviour matches what
  a real client would show.
- **{} FHIR JSON** — the live `Questionnaire` resource as formatted,
  syntax-highlighted JSON. It updates as you edit, so you can watch the FHIR being
  produced. The search box highlights matches inside the JSON.

## Design aids in Preview

**👁️ Preview** shows extra information that helps while authoring but is not part
of the patient's form. A **View options** menu toggles each one:

- **Show id** — the `linkId` of each item.
- **Show prefix** — the item's prefix (e.g. `1.`, `Q3`).
- **Show badges** — small indicators on items that carry logic or validation
  (visibility conditions, calculations, required, etc.).
- **Show hidden** — reveal items marked hidden (greyed out) so you can inspect
  them; in Patient View these are always removed.

These toggles only affect the Preview display — they never change the underlying
questionnaire.

## Testing with patient data

Logic like calculations and `enableWhen` often depends on facts about the patient
(age, sex, BMI …). The **👤 Patient** preset selector lets you feed those in
without leaving the builder. Picking a preset populates the questionnaire
variables `%age`, `%gender`, `%bmi`, `%pregnant`, `%smoker`, `%proc` and
`%comorb`, and re-evaluates every `initialExpression` so the form reflects that
patient. Choose **✏ Custom…** to set the values by hand.

This is meant for **testing** the form's behaviour against different scenarios —
it is not a data-capture feature.

## Resuming a filled-in form

You can also load an existing `QuestionnaireResponse` to continue a partially
completed session — the preview restores the saved answers and re-runs all logic
on top of them.

## Everything stays in sync

There is no "refresh" step. Any change to an item — its type, text, options,
logic or validation — is reflected in the preview on the next render, so the form
you see always matches the questionnaire you are editing.

---

Next: [Build a questionnaire from scratch](build-from-scratch.md).
