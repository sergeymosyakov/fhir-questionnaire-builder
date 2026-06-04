# ROADMAP

**Audience:** Developers and FHIR integration engineers (Variant B).  
**Feature filter:** Does it support Scenario 1 (edit & round-trip), 2 (build from scratch), or 3 (logic testing)?  
See [CONTEXT.md](CONTEXT.md) for scenario definitions.

---

## Next

- [ ] **[HIGH CRITICAL] `questionnaire-sliderStepValue` R4 decimal constraint** — R4 extension definition only allows `valueInteger`; decimal step values (e.g. `0.1`, `0.5`) on `decimal`-type slider items are rejected by HAPI R4 validator. Options: (a) restrict slider step UI to integers when item type is decimal in R4 mode, (b) add a version-aware export (R4B/R5 uses `valueDecimal`), or (c) document as R5-only and warn in the local validator.
- [ ] **[HIGH CRITICAL] `questionnaire-displayCategory` R4 context restriction** — In R4, this extension is only valid on `group`-type items; on `display` items it is only allowed in R5. The builder currently exports it on display items without restriction. Fix: local validator should warn when displayCategory is set on a display item in R4 mode; export should be suppressed for display items until R5 mode is added.

## Near-term

- [ ] **Performance regression test** — automated test with 200–300 item questionnaire covering deep nesting (depth 6–8), heavy `enableWhen`, and multiple `calculatedExpression` chains; assert render time stays under threshold

## Technical Debt

*(No current items.)*

## Later

- [x] **External validator integration** — `ValidatorRegistry` + `LocalValidator` + `ExternalValidator` (HAPI FHIR `$validate`); async per-validator sections with spinners in validate modal; Local/Server validation toggles in Settings menu (server off by default)
- [ ] **Sub-questionnaire / modular questionnaires** — SDC `http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-subQuestionnaire`; requires FHIR server for resolution; out of scope until server integration exists
- [ ] **item.definition + StructureDefinition auto-population** — resolve `item.definition` URL against a FHIR server and auto-fill `text`, `type`, `baseType`, `fhirType` from the element; prerequisite: server integration

---
