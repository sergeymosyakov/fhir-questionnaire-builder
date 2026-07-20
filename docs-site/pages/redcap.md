# REDCap import/export

The builder can convert between a **REDCap Data Dictionary** (the CSV that defines
a REDCap instrument) and a FHIR `Questionnaire`, in **both directions**. This lets
you bring existing REDCap instruments into FHIR, or hand a FHIR questionnaire to a
REDCap user.

## Importing a REDCap Data Dictionary

Open **Questionnaires ▾ → 📂 From file…**, choose the format **REDCap CSV — Data
Dictionary (.csv)**, and pick your file. The converter maps REDCap concepts to
FHIR:

- **Field types** (text, notes, radio, dropdown, checkbox, yes/no, calc, …) →
  the matching questionnaire item types.
- **Choices** → answer options.
- **Branching logic** → `enableWhen` visibility conditions.
- **Calculated fields** → FHIRPath `calculatedExpression` where the formula can be
  translated.

The file is checked as it loads, and any rows that can't be represented are
reported so you know what to review.

## Exporting to a REDCap Data Dictionary

Open **Save ▾**, choose the export format **REDCap CSV — Data Dictionary (.csv)**,
and download. Before the file is produced, a **compatibility report** runs and
warns about anything in the FHIR questionnaire that REDCap cannot represent
exactly — so you can decide whether to adjust the form or accept the loss.

## Round-tripping

To make REDCap ↔ FHIR conversions reversible, the converter stores REDCap-specific
details that have no FHIR equivalent in private extensions (under a
`fhir-qb.app/redcap/` namespace). Because of differences between the two formats,
treat a round-trip as **high-fidelity but not always byte-identical** — the
compatibility report tells you where the two models diverge.

---

Next: [Cloud save & sharing](cloud-save.md).
