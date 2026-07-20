# Extensions & SDC

Plain FHIR `Questionnaire` covers structure and basic answer types. Almost
everything richer — computed fields, dynamic options, rendering hints, extra
validation — comes from **extensions**, most of them defined by the
[Structured Data Capture (SDC)](https://hl7.org/fhir/uv/sdc/) implementation
guide. The builder imports, edits, previews and re-exports a broad set of them,
and round-trips the ones it does not render so nothing is lost.

For the exhaustive, field-by-field list of what is supported and where to set it
in the UI, use the built-in **FHIR Field Reference** (⋯ More → FHIR Reference).
This page explains, in plain terms, what each group of features does for you.

## Logic & expressions

These make a form *react* to what the user enters (all powered by
[FHIRPath](fhirpath.md)):

- **Calculated answers** — fill a read-only field automatically from other
  answers, e.g. compute BMI from height and weight (`calculatedExpression`).
- **Initial values from an expression** — pre-fill an answer when the form opens,
  e.g. today's date or a value pulled from the patient (`initialExpression`).
- **Expression-based visibility** — show or hide an item using a formula when the
  simple condition rows aren't enough (`enableWhenExpression`).
- **Dynamic option lists** — build the choices for a question at run time from a
  formula instead of a fixed list (`answerExpression` / `candidateExpression`).
- **Questionnaire variables** — named formulas defined once and reused across the
  form as `%name` (`sdc-questionnaire-variable`).
- **Launch contexts** — resources the form expects when it opens, such as the
  patient or current user, referenced as `%patient`, `%user`, …
  (`sdc-questionnaire-launchContext`).
- **Constraints** — custom validation rules that must hold true, with your own
  error message (`questionnaire-constraint`).

## Validation & limits

Rules that restrict what counts as a valid answer:

- **Minimum / maximum value** — bound a number or date to a range
  (`minValue` / `maxValue`).
- **Text length** — set a minimum and/or maximum number of characters
  (`minLength` / `maxLength`).
- **Repeat count** — for a repeating item, require at least / at most N entries
  (`minOccurs` / `maxOccurs`).
- **File rules** — for file-upload items, cap the file size and restrict the
  allowed file types (`maxSize` / `mimeType`).
- **Input format hint** — a placeholder showing the expected format
  (`entryFormat`).
- **Unit** — the unit label for a numeric quantity, e.g. `kg` or `mmHg`
  (`questionnaire-unit`).

## Presentation & rendering

How an item looks and how the user interacts with it:

- **Control type** — choose how a choice question appears: radio buttons, a
  drop-down, or check-boxes; render groups as headers/footers or as a table; show
  hover "flyover" help (`questionnaire-itemControl`).
- **Slider** — present a number as a drag slider with a fixed step
  (`sliderStepValue`).
- **Multi-column options** — lay a long list of choices out across several
  columns (`columnCount`), horizontally or vertically (`choiceOrientation`).
- **Rich item text** — format question text with XHTML or Markdown, or apply
  styling; the builder sanitizes this markup before showing it
  (`rendering-xhtml` / `rendering-markdown` / `rendering-style`).
- **Media** — attach an image or other media to a question or to individual
  answer options (`sdc-questionnaire-itemMedia` / `sdc-questionnaire-answerMedia`).
- **Option prefixes & help links** — show a short prefix before each option, and
  add "more info" links next to an item (`questionnaire-optionPrefix` /
  `questionnaire-supportLink`).

## Answers & terminology

How choice options are sourced and scored:

- **Value-set–bound options** — draw a question's choices from a coded value set;
  external value sets are expanded through the configured terminology server
  (`answerValueSet`).
- **Scores** — attach a numeric score to each option, used for sums and risk
  scoring (`ordinalValue` / `itemWeight`).
- **Subject item** — mark the one question whose answer identifies who the
  response is about (`sdc-questionnaire-isSubject`).

## Behaviour & typing

- **Hidden items** — keep an item off-screen for the patient while it still takes
  part in calculations and logic, e.g. a computed score you don't want shown
  (`sdc-questionnaire-hidden`).
- **Usage mode** — control whether an item is for data entry, display-only, or
  only shown when it has a value (`questionnaire-usageMode`).
- **Disabled display** — when a visibility condition fails, choose whether the
  item is greyed-out or removed entirely (`disabledDisplay`).
- **Data-element typing** — link an item to an external data-element definition
  and carry its underlying data type (`item.definition`,
  `questionnaire-baseType`, `questionnaire-fhirType`).

## Round-tripping

Extensions the builder understands are shown and editable in the UI. Extensions
it does not specifically render are still **preserved** on import and written back
on export, so importing and re-exporting a questionnaire never silently drops
information.

---

Next: [Extraction (definition & StructureMap)](extraction.md).
