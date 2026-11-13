# Calculation gallery

Writing a clinical calculation in FHIRPath by hand — item references, unit
conversions, edge cases — is slow and easy to get wrong. The calculation gallery is
a library of ready-made, source-referenced calculations you can insert in a few
clicks. It is a starting point, not a locked-in choice: what you insert is ordinary
FHIRPath that you can keep editing.

## Use it

1. On a value field, open the type chooser and pick **📐 Choose from gallery**.
2. Search the list and pick a calculation.
3. For each input, choose the questionnaire item whose answer supplies it (with an
   optional unit conversion where one applies).
4. Insert it. The resolved FHIRPath is dropped into the field as editable text.

Some calculations add rows (**+ Add item**) for a variable number of inputs, and some
resolve to a named category (for example a severity band) instead of a raw number.
Each one shows where its formula comes from. A calculation gives no result until all
of its inputs are answered; yes/no checklist calculations such as qSOFA count an
unanswered box as No, and date calculations need full dates.

## What is in the gallery

- **Body measurements:** BMI (metric and imperial) and its WHO category, body surface area (Mosteller), ideal body weight (Devine), waist-to-hip ratio.
- **Dates and age:** age from a birthdate, age at another date, age in months, days between two dates, expected delivery date and gestational age from the last menstrual period, a date plus an interval (for follow-up dates).
- **Kidney function:** eGFR (CKD-EPI 2021) and creatinine clearance (Cockcroft–Gault).
- **Laboratory and cardiology:** corrected calcium, LDL cholesterol (Friedewald), HOMA-IR, FIB-4, anion gap, mean arterial pressure, QTc (Bazett and Fridericia).
- **Scores and screens:** PHQ-9, PHQ-2, GAD-7, Glasgow Coma Scale, Apgar, qSOFA, CHA₂DS₂-VASc, Charlson Comorbidity Index.
- **General helpers:** unit conversion, sum of items, count of Yes answers, percent change.

## Calculations that depend on sex

eGFR, Cockcroft–Gault and ideal body weight need to know whether the person is
female. The **sex** item must be a single-choice question. The calculation compares
the item's answer *code* with the text in **Answer code for Female**, which starts as
`female`. If your answers use another code (for example `F` or `2`), type it there
before inserting. Matching is exact, including upper and lower case.

## Browse without the Builder

Every calculation — its inputs, result bands and where its formula comes from — is
listed on the public [calculation gallery page](https://fhirbuilder.com/gallery.html)
and in the
[gallery catalog](https://github.com/sergeymosyakov/fhir-questionnaire-builder/blob/master/docs/EXPRESSION-GALLERY.md)
in the repository. The gallery offers reference calculations to save authoring
effort; they are not medical advice, so check each formula against its source for
your use case.

Ready-made *questions* with their calculations already wired in are a separate
feature: see [Templates](templates.md). On the public gallery page, a calculation that a
template is built on links to that template.

---

Next: [Templates](templates.md).
