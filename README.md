# QuestionaryPrototype — FHIR Questionnaire Logic Builder

A prototype **visual logic builder** for medical prior authorization questionnaires based on [FHIR R4 / R4B / R5 Questionnaire](https://hl7.org/fhir/R4/questionnaire.html).

Lets you build questionnaire logic visually, test it against patient data, and import/export FHIR R4/R4B/R5 JSON or REDCap CSV. The target version is set from a dropdown in the builder toolbar; version is auto-detected on import from `meta.fhirVersion`.

The right-side **preview panel is a live SDC-compliant runtime**: it executes FHIRPath expressions, resolves `enableWhen` / `enableWhenExpression`, evaluates `calculatedExpression` and `initialExpression` chains against an injected Patient resource, and produces a valid `QuestionnaireResponse`. Import an existing QR to resume a partially-filled session. The builder and the runtime are always in sync — edits to item logic are immediately reflected in the live form.

> © 2026 [Sergey Mosyakov](https://github.com/sergeymosyakov) / [Roko Labs Inc.](https://www.rokolabs.com) — Non-commercial use with attribution. Commercial use requires prior written permission.

---

## Documentation

| Doc | Contents |
|---|---|
| [docs/CONTEXT.md](docs/CONTEXT.md) | Architecture, file map, node model, UX features, build rules |
| [docs/FHIR-MAPPING.md](docs/FHIR-MAPPING.md) | FHIR R4 field mapping, supported extensions, known gaps |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Feature backlog |

---

## Running

> **Requires an HTTP server** — ES modules do not work over `file://`.

### Locally
```powershell
.\start.ps1
# or: npx serve .
# open http://localhost:3000
```

### GitHub Pages
https://sergeymosyakov.github.io/fhir-questionnaire-builder/

### Tests
```powershell
npm test             # unit tests — single run (Vitest, 1178 tests)
npm run test:watch   # unit tests — watch mode
npm run test:e2e     # e2e tests — Playwright/Chromium
npm run test:e2e:ui  # e2e tests — Playwright UI mode
```
Vitest and Playwright CI run automatically on every push via GitHub Actions.
Playwright HTML report: https://sergeymosyakov.github.io/fhir-questionnaire-builder/playwright-report/
Coverage report: https://sergeymosyakov.github.io/fhir-questionnaire-builder/coverage/

> **One-time setup**: in the repo go to **Settings → Pages → Source** and select **GitHub Actions**.

---

## Sample Questionnaires

All samples live in `sampledata/` and can be loaded via the **Load** button.

| File | Items | What to look for |
|---|---|---|
| `example-bariatric.fhir.json` | ~25 | Default on startup. BMI calc, radio, attachment, open-choice, `contained[]` ValueSets, constraints. |
| `bariatric-extended.fhir.json` | 87 | Stress-test: all item types, 32 enableWhen, diabetes/hypertension/sleep apnea sub-sections. |
| `ussg-fht.fhir.json` | 49 | Deep nesting (depth 5). Good for tree collapse/expand. |
| `prowl-ss.fhir.json` | 44 | Flat structure (depth 1). Likert-scale radios. |
| `phq-9.fhir.json` | 11 | Minimal — fast baseline test. |
| `annual-health-check.fhir.json` | 18 | Full-feature reference: prefix, LOINC codes, sliders, ordinalValue, repeats, rendering-style, BMI calc, constraint. |
| `reference-example.fhir.json` | 7 | `reference` item type with `questionnaire-referenceResource`. |
| `sdc-variables-demo.fhir.json` | 4 | SDC questionnaire-level variables + `calculatedExpression`. |
| `valueset-demo.fhir.json` | 4 | Contained ValueSets, local `#vs-id` refs, external URL, rendering-style. |
| `slider-disabled-demo.fhir.json` | ~12 | Sliders, `disabledDisplay` (hidden/protected), ordinalValue radios. |
| `patient-scenario-*.fhir.json` | — | Load + select preset + Re-init to test `initialExpression` / `enableWhenExpression` pipelines. |
| `redcap-clinical-demo.fhir.json` | 30 | Converted from REDCap Data Dictionary. Includes branching logic, calc expressions (BMI via FHIRPath), slider, radio, checkbox fields. |
| `r4b-demo.fhir.json` | ~10 | FHIR R4B — `answerConstraint`, native `disabledDisplay`; auto-detected as R4B on import. |
| `r5-demo.fhir.json` | ~10 | FHIR R5 — `answerConstraint`, native `disabledDisplay`; exported with `meta.fhirVersion: 5.0.0`. |

---

## Tech Stack

- **ES Modules** — `import/export` between files; requires HTTP server; no build step, no bundler
- **Vanilla JS DOM** — builder and preview rendered imperatively via OOP node classes; state propagated through `AppEvents` custom events
- **FHIRPath** — `lib/fhirpath.min.js` (global); powers calc, visibility, and constraint expressions
- **DOMPurify** — `lib/dompurify.min.js`; sanitizes XHTML content before rendering
- **Vitest** — 1197 unit tests across 26 files; CI via GitHub Actions (`npm test`)
- **Playwright** — e2e tests (Chromium); CI + HTML report on GitHub Pages

---

## Third-party content notices

This project includes sample questionnaire files that contain LOINC-coded content.

This material contains content from LOINC (http://loinc.org). LOINC is copyright © Regenstrief Institute, Inc. and the Logical Observation Identifiers Names and Codes (LOINC) Committee and is available at no cost under the license at http://loinc.org/license. LOINC® is a registered United States trademark of Regenstrief Institute, Inc.

Sample files sourced from HL7 Implementation Guides are published under Creative Commons Attribution 4.0 (CC BY 4.0). Source URLs are preserved in each file's `url` field.

---

## Feedback welcome

I built this to solve a real problem — we needed to edit FHIR R4 Questionnaires without a full EHR stack.
Not sure if others have the same need. If you've stumbled on this:

- Does the UX make sense for your workflow?
- Are there FHIR fields you'd expect that are missing?
- Any opinion on offline ValueSet resolution?

Open an issue or drop a comment — even a "this isn't useful because X" is helpful.
