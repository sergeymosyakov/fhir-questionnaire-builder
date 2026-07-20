# Import & round-trip

The builder is designed to load existing questionnaires, let you edit them, and
export them again **without losing information** — including extensions it does
not render itself.

## Loading a questionnaire

Open the **Questionnaires ▾** menu (top of the left panel):

- **📂 From file…** — open a file from your computer. A small dialog first asks
  the format: **FHIR R4 JSON (.json)** or **REDCap CSV — Data Dictionary (.csv)**.
- **📚 From Library…** — pick one of the built-in sample questionnaires.
- **☁️ From Cloud…** — open a questionnaire you saved to the cloud (when signed
  in — see [Cloud save & sharing](cloud-save.md)).
- **🕒 Recent draft…** — restore your most recent auto-saved draft.

Loading replaces the current questionnaire; if you have unsaved changes you are
prompted first.

## FHIR versions

The target FHIR version — **R4**, **R4B** or **R5** — is chosen from the version
selector in the builder toolbar. On import the version is **auto-detected** from
the questionnaire's `meta.fhirVersion`. STU3 JSON is also accepted and adapted to
R4 on load, so older questionnaires still open.

On export, the questionnaire is written for the selected target version (for
example, R5-only fields are down-converted or moved to the appropriate extension
when exporting to R4/R4B).

## Round-trip fidelity

Importing and re-exporting a questionnaire should not silently change it:

- Extensions the builder understands are surfaced in the UI and written back.
- Extensions it does **not** specifically render are **preserved** and re-emitted
  on export (see [Extensions & SDC](extensions-sdc.md)).

This means you can safely bring a questionnaire in, make a targeted change, and
export it again.

## Exporting

Use the **Save ▾** menu to download FHIR JSON:

- **📄 Questionnaire · FHIR JSON** — the questionnaire itself.
- **📋 QuestionnaireResponse · FHIR JSON** — the current answers as a response.
- **🧪 Observations · FHIR JSON Bundle** and **🧩 Definition Extract · FHIR JSON
  Bundle** — extracted resources (see [Extraction](extraction.md)).

## Resuming a filled-in form

To continue a partially completed form, open **Answers ▾ → 📂 From file…** and
load a `QuestionnaireResponse`. The builder restores the saved answers into the
preview and re-runs all logic on top of them. You can also pull answers from a
FHIR server — see [Fill from a FHIR server](populate.md).

---

Next: [Answer types & options](answer-types.md).
