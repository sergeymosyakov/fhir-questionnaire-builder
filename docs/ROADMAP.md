# ROADMAP

**Audience:** Developers and FHIR integration engineers (Variant B).  
**Feature filter:** Does it support Scenario 1 (edit & round-trip), 2 (build from scratch), or 3 (logic testing)?  
See [CONTEXT.md](CONTEXT.md) for scenario definitions.

---

## Next

- [ ] **Copy / paste nodes** — duplicate a question or an entire group (with children) anywhere in the tree; Ctrl+C / Ctrl+V on a builder node
- [ ] **More sample data** — 2–3 additional questionnaires covering different complexity levels, with documented expected PASS/FAIL outcomes per patient profile

## Near-term

- [ ] **Cross-field semantic validation** — warn on logically invalid combinations: `required + hidden` (item can never be answered), `calculatedExpression + readOnly: false` (value will be overwritten), `repeats + initialValues` count mismatch, `answerExpression + answerOption[]` co-presence (mutually exclusive in SDC), `enableWhen + enableWhenExpression` conflict; surface as import warnings and a pre-export check panel; extend `js/fhir/validate.js`
- [ ] **answerOption non-Coding editing** — UI to edit `answerOption.valueString`, `valueInteger`, `valueDate`, `valueTime`, `valueReference` types; currently round-trip safe but locked to read-only display in Answer Type modal
- [ ] **Performance regression test** — automated test with 200–300 item questionnaire covering deep nesting (depth 6–8), heavy `enableWhen`, and multiple `calculatedExpression` chains; assert render time stays under threshold

## Technical Debt

*(No current items.)*

## Later

- [ ] **External validator integration** — link to HL7 / Simplifier validator or call a local FHIR validation API; surface results as item-level badges
- [ ] **Sub-questionnaire / modular questionnaires** — SDC `http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-subQuestionnaire`; requires FHIR server for resolution; out of scope until server integration exists
- [ ] **item.definition + StructureDefinition auto-population** — resolve `item.definition` URL against a FHIR server and auto-fill `text`, `type`, `baseType`, `fhirType` from the element; prerequisite: server integration

---
