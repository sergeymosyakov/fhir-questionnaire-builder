# FHIR mapping & round-trip fidelity

This page describes, at a high level, what FHIR the builder speaks and how
faithfully it preserves a questionnaire through import and export.

## What it targets

The builder authors **FHIR `Questionnaire`** resources and can target **R4**,
**R4B** or **R5**, selected from the toolbar version selector. On import the
version is auto-detected from `meta.fhirVersion`, and STU3 input is adapted to R4.
See [Import & round-trip](import-roundtrip.md).

On top of base FHIR it supports a broad set of **SDC** (Structured Data Capture)
extensions — expressions, dynamic options, rendering hints, extra validation and
more. Those are grouped and explained in [Extensions & SDC](extensions-sdc.md),
and listed field-by-field in the [FHIR field reference](field-reference.md).

## The runtime is real FHIR

The preview is a working SDC runtime, not a mock-up: it evaluates FHIRPath,
resolves `enableWhen` / `enableWhenExpression`, runs `calculatedExpression` and
`initialExpression`, and produces a valid `QuestionnaireResponse`. So what you see
in the preview reflects how a conformant SDC client would behave.

## Round-trip fidelity

The builder is built to avoid silently changing questionnaires:

- Fields and extensions it understands are surfaced in the UI and written back on
  export.
- Extensions it does **not** specifically render are **preserved** on import and
  re-emitted on export, rather than dropped.

This means you can import a questionnaire, make a focused edit, and export it
again with confidence. Where a conversion is inherently lossy — most notably
[REDCap](redcap.md) import/export, since REDCap and FHIR are different models — the
builder tells you what doesn't map cleanly instead of hiding it.

## Where the authoritative list lives

For the exhaustive, current list of supported fields and extensions, use the
in-app [FHIR field reference](field-reference.md); the project also maintains a
detailed FHIR mapping document in its source repository.

---

Next: [Keyboard & accessibility](keyboard-a11y.md).
