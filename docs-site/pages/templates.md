# Templates

A template is a ready-made group of questions — with the scale's original wording,
standard LOINC codes, scores and a working total — that you insert into your
questionnaire in one click. Use it when you need a well-known screening scale — or a standard intake section such as
demographics or allergies — and don't want to type it in and wire up the scoring yourself.

## What is available

- **PHQ-2** — the two-question depression screen; a total (0–6) and a positive/negative result that points to the PHQ-9.
- **GAD-2** — the two-question anxiety screen; a total (0–6) and a positive/negative result that points to the GAD-7.
- **PHQ-9** — depression screening; a total score (0–27) and its severity band (minimal to severe).
- **GAD-7** — anxiety screening; a total score (0–21) and its severity band.
- **AUDIT-C** — alcohol use screening; a total score (0–12) with the usual positive-screen thresholds noted.
- **Glasgow Coma Scale** — eye, verbal and motor responses; a total (3–15) and its severity band.
- **Apgar Score** — the five criteria at 1 and 5 minutes after birth; a total (0–10) and result band for each.
- **qSOFA Sepsis Screen**, **CHA₂DS₂-VASc Stroke Risk Score** and **Charlson Comorbidity Index** — yes/no criteria added up into a score (the Charlson index also uses the age). An unanswered criterion counts as No. qSOFA shows its result once you answer at least one criterion; CHA₂DS₂-VASc and Charlson need the age first.
- **Calculators** — a few related measurements with their formulas already wired in; each result stays empty until all of its inputs are answered:
  - **Body Measurements** — height, weight, sex, waist and hip give BMI and its WHO category, body surface area, ideal body weight and waist-to-hip ratio.
  - **Kidney Function** — creatinine, age, sex and weight give eGFR (CKD-EPI 2021) and creatinine clearance (Cockcroft–Gault).
  - **Cardiac Measurements** — blood pressure, QT interval and heart rate give mean arterial pressure and corrected QT (Bazett and Fridericia).
  - **Lipid Panel** — total cholesterol, HDL and triglycerides give calculated LDL (Friedewald).
  - **Chemistry Calculations** — electrolytes, calcium, albumin, glucose and insulin give the anion gap, albumin-corrected calcium and HOMA-IR.
  - **FIB-4 Liver Fibrosis Index** — age, AST, ALT and platelets give the FIB-4 index and its category.
  - **Pregnancy Dating** — last menstrual period and visit date give the expected delivery date and gestational age in weeks.
- **Intake fragments** — plain data-collection groups with no scoring: **Patient Demographics**, **Allergies** and **Current Medications** (both with a repeatable list, so a patient can add as many rows as needed), and **Pain Assessment** (0–10 severity, location, onset, description).

The list of templates, with each scale's questions, scoring, source and license, is
on the public [templates page](https://fhirbuilder.com/templates.html), and every
template also has its own page there (questions with their answer options, calculated
results, source and license, plus a download link for the FHIR Questionnaire JSON).

## Insert a template

- **At the top level:** in the left panel choose **+ Add → From template…**.
- **Inside a group or an item:** open its **⚙** menu and choose **Insert template…**.
  The template is added at the end of that group's or item's children.

In the window that opens, narrow the list with the category buttons (screening scales, calculators, intake sections) and the search box (by name or topic), select a template to see its
**source** and **license**, then press **Insert**.

The calculators use the same formulas as the [calculation gallery](calculation-gallery.md), and the public page of each template links to the matching gallery calculations (and back); the questions come with the template, so there is nothing to pick. Enter each value in the unit shown in its question.

The template arrives as one group titled with the scale's name. You can rename it,
move it, or edit any question like one you wrote yourself.

## What gets inserted

- In the scales, every question carries its LOINC code, and every answer its LOINC answer code and score. The calculators and intake fragments carry LOINC codes only where a standard one exists (for example height, creatinine, date of birth and pain severity).
- The **total** (and, for PHQ-9 and GAD-7, the **severity**; for PHQ-2 and GAD-2, the **screening result**) are read-only calculated
  fields. They stay empty until every scored question is answered, instead of
  showing a misleading partial score.
- If an id in the template would clash with an id already in your questionnaire, the
  builder renames the template's ids (adding a short suffix) and updates the
  calculations to match, so each inserted copy calculates from its own answers. When
  nothing clashes, the ids stay exactly as published.

## Sources and licenses

Templates keep the published wording of each scale and credit their authors; the
picker shows the source and license of each one before you insert it, and the
[license page](license.md) lists the credits. Templates save authoring effort and
are not medical advice — confirm a scale and its cut-offs for your use case.

---

Next: [Import & round-trip FHIR / REDCap](import-roundtrip.md).
