# Build a questionnaire from scratch

This walkthrough builds a small questionnaire from an empty canvas and exports it
as FHIR. It assumes you have the app open (see [Running locally](running-locally.md)
or use the hosted version).

## 1. Start an empty questionnaire

If a sample is loaded, clear it, then click **+ Add Root Group** in the left
panel. Every questionnaire starts with at least one top-level group — this is the
first section of your form.

## 2. Build the structure

Each item in the tree has a **⚙ gear** menu. On a group, use it to add children:

- **Add Group** — a nested sub-section.
- **Add Item** — a question.

The gear menu also has **Copy**, **Paste before**, **Paste after** and **Delete**
so you can duplicate and rearrange whole branches. New items are created as a
plain text question that you then configure.

You can also **drag and drop** items in the tree to reorder them or move them
between groups.

## 3. Name items and set identifiers

Click an item's **title** to edit it in place. Each item also has:

- a **prefix** — an optional label shown before the text (e.g. `1.`, `Q3`);
- a **linkId** — the item's unique identifier, generated automatically but
  editable.

See [Questionnaire & items](questionnaire-items.md) for how these map to FHIR.

## 4. Choose the answer type

For a question, set its **answer type** (text, integer, choice, date, …) from the
item's `type:` control. This decides which input renders in the preview. For
choice questions you then define the options — inline, from a value set, or from
an expression. Details: [Answer types & value sets](answer-types.md).

## 5. Add logic and rules

Each question exposes a row of controls for its behaviour:

- **States** — mark it *Required*, *Read-only*, or *Hidden*.
- **Show When** — show or hide it based on other answers
  ([enableWhen & visibility](enablewhen.md)).
- **Expression** — compute a value or a starting value with FHIRPath
  ([FHIRPath in the builder](fhirpath.md)).
- **Repeatable** — allow more than one answer, with optional min/max counts.
- **Default** — a starting value for the answer.

## 6. Test it live

The right-hand panel renders your form as you build. Switch to **👤 Patient View**
to see what a respondent sees, feed in test data with the **👤 Patient** presets,
and check the generated FHIR in **{} FHIR JSON** mode. See
[Preview, Patient View & FHIR JSON](preview-modes.md).

## 7. Export

When you're happy, open **Save ▾** and choose **📄 Questionnaire · FHIR JSON** to
download the `Questionnaire`. The same menu can also export a filled-in
`QuestionnaireResponse` and extracted resource bundles.

---

Next: [Import & round-trip FHIR / REDCap](import-roundtrip.md).
