# ROADMAP

**Audience:** Developers and FHIR integration engineers (Variant B).  
**Feature filter:** Does it support Scenario 1 (edit & round-trip), 2 (build from scratch), or 3 (logic testing)?  
See [CONTEXT.md](CONTEXT.md) for scenario definitions.

---

## Next

*(No current items.)*

## Near-term

- [ ] **Performance regression test** — automated test with 200–300 item questionnaire covering deep nesting (depth 6–8), heavy `enableWhen`, and multiple `calculatedExpression` chains; assert render time stays under threshold

## Technical Debt

*(No current items.)*

## Later

- [x] **External validator integration** — `ValidatorRegistry` + `LocalValidator` + `ExternalValidator` (HAPI FHIR `$validate`); async per-validator sections with spinners in validate modal; Local/Server validation toggles in Settings menu (server off by default)
- [ ] **Sub-questionnaire / modular questionnaires** — SDC `http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-subQuestionnaire`; requires FHIR server for resolution; out of scope until server integration exists
- [ ] **item.definition + StructureDefinition auto-population** — resolve `item.definition` URL against a FHIR server and auto-fill `text`, `type`, `baseType`, `fhirType` from the element; prerequisite: server integration

---
