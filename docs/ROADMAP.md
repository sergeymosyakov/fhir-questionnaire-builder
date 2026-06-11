# ROADMAP

**Audience:** Developers and FHIR integration engineers (Variant B).  
**Feature filter:** Does it support Scenario 1 (edit & round-trip), 2 (build from scratch), or 3 (logic testing)?  
See [CONTEXT.md](CONTEXT.md) for scenario definitions.

---

## Next

### Horizon 2 — SDC completeness (extraction & population)

Supports Scenario 1 (round-trip) and Scenario 3 (logic testing). This is where most industrial-grade SDC complexity lives.

- [ ] **Extraction** — SDC observation-based extraction (`sdc-questionnaire-observationExtract`) and definition-based extraction; generate target FHIR resources (Observation, Condition, etc.) from a completed QuestionnaireResponse
- [ ] **Population** — populate item values from external FHIR resources via `launchContext` + `itemPopulationContext`; prerequisite: FHIR server integration
- [ ] **`item.definition` resolution** — resolve `item.definition` against a StructureDefinition to auto-fill `text`, `type`, and value constraints; prerequisite: FHIR server integration

## Near-term

- [ ] **Performance regression test** — automated test with 200–300 item questionnaire covering deep nesting (depth 6–8), heavy `enableWhen`, and multiple `calculatedExpression` chains; assert render time stays under threshold

## Technical Debt

*(No current items.)*

## Later

- [ ] **Sub-questionnaire / modular questionnaires** — SDC `http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-subQuestionnaire`; requires FHIR server for resolution; out of scope until server integration exists
- [ ] **item.definition + StructureDefinition auto-population** — resolve `item.definition` URL against a FHIR server and auto-fill `text`, `type`, `baseType`, `fhirType` from the element; prerequisite: server integration

---
