# ROADMAP

**Audience:** Developers and FHIR integration engineers (Variant B).  
**Feature filter:** Does it support Scenario 1 (edit & round-trip), 2 (build from scratch), or 3 (logic testing)?  
See [CONTEXT.md](CONTEXT.md) for scenario definitions.

---

## Next

- [ ] **More sample data** — 2–3 additional questionnaires covering different complexity levels, with documented expected PASS/FAIL outcomes per patient profile
- [ ] **`sdc-questionnaire-answerExpression`** — dynamic answer options derived from FHIRPath over current form values (no server required); SDC extension
- [ ] **tx.fhir.org ValueSet expansion** — call HL7's public terminology server directly from the browser (`$expand` operation); user pastes an external ValueSet URL and gets live answer options without any backend; biggest UX gap vs. commercial tools
- [ ] **Undo / redo** — Ctrl+Z / Ctrl+Y over the node tree; store snapshots in a fixed-size history stack
- [ ] **Copy / paste nodes** — duplicate a question or an entire group (with children) anywhere in the tree

## Later

- [x] **FHIR STU3 import compatibility shim** — `js/fhir/stu3-shim.js` normalises STU3 fields to R4 on load: `option[]`→`answerOption[]`, `options`→`answerValueSet`, `enableWhen.hasAnswer`→`operator:exists`, `initial<Type>`→`initial[{value<Type>}]`; export always produces R4
- [ ] **External validator integration** — link to HL7 / Simplifier validator or call a local FHIR validation API; surface results as item-level badges
