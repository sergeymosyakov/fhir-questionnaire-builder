# Quick tour

Five minutes, end to end: load a questionnaire, edit it, test its logic, and export clean FHIR. Every button and menu name below matches the actual UI.

## 1. Open a questionnaire

Open the builder. Use the **Questionnaires ▾** menu in the toolbar:

- **📚 From Library…** — pick one of the built-in samples (e.g. *PHQ-9 Depression Screening* or *Annual Health Check*).
- **📂 From file…** — upload your own FHIR R4 (or STU3) `Questionnaire` JSON.

Or start empty with **+ Add Root Group** in the left panel.

The screen splits into two: the **builder tree** on the left and the **live preview** on the right.

## 2. Edit the structure

- **Add a group** at the top level with **+ Add Root Group**.
- On any node, open the **⚙** gear menu to **Add Group**, **Add Item**, **Copy**, **Paste before/after**, or delete.
- **Rename** an item by clicking its title and typing (Enter or click also works from the keyboard).

Switch the **⋯** menu between **Simple** (structure only) and **Advanced** (all per-item controls) depending on how much you want to see.

## 3. Configure an item

In **Advanced** view each item exposes action links — for example **Answer Type**, **States** (required / read-only / hidden), **Show When** (`enableWhen`), **Expression** (`calculatedExpression` and friends), **Constraint**, and **Codes**. Open the ones you need; the right-hand preview updates as you go.

## 4. Test the logic

- Pick a patient profile from the **👤 Patient ▾** menu (Adult Male, Pregnant Female, etc.). This populates the FHIRPath variables (`%age`, `%gender`, `%bmi`, …) used by expressions and re-evaluates `initialExpression` fields.
- Switch the preview mode from **👁️ Preview** to **👤 Patient View** for a clean form.
- Fill in answers and watch:
  - items appear/disappear as their **`enableWhen`** conditions change,
  - **`calculatedExpression`** values update,
  - the **PASS / FAIL** status badge in the preview header reflect validation (click it to see which items fail).
- Switch to **{} FHIR JSON** preview mode to see the live `Questionnaire` (or the `QuestionnaireResponse` built from your answers).

## 5. Export

Use the **Save ▾** menu:

- **📄 Questionnaire · FHIR JSON** — the questionnaire you built.
- **📋 QuestionnaireResponse · FHIR JSON** — the answers you entered.
- **🧪 Observations · FHIR JSON Bundle** — for `observationExtract` items.

That's the loop: load → edit → test → export. From here, dig into [Core Concepts](questionnaire-items.md) or the [How-to Guides](build-from-scratch.md).
