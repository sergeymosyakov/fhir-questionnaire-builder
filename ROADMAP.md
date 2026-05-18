# ROADMAP

**Audience:** Developers and FHIR integration engineers (Variant B).  
**Feature filter:** Does it support Scenario 1 (edit & round-trip), 2 (build from scratch), or 3 (logic testing)?  
See [docs/CONTEXT.md](docs/CONTEXT.md) for scenario definitions.

---

## Now

- [x] **Multi-condition visual builder** — `enableWhen[]` panel with AND/ALL vs OR/ANY toggle, per-condition rows (question picker + operator + value), FHIRPath `enableWhenExpression` for advanced expressions

## Next

- [ ] **Patient presets** — 3–4 quick-switch patient buttons (e.g. Child, Adult F, Obese M); replaces manual field-by-field editing for faster Scenario 3 testing
- [x] **`open-choice` free-text rendering** — text input + `<datalist>` suggestions from `answerOption[]`; free-text allowed
- [ ] **`answerValueSet` warning** — show import warning when `answerValueSet` is used (currently silently dropped)
- [ ] **More sample data** — 2–3 additional questionnaires covering different complexity levels, with documented expected PASS/FAIL outcomes per patient profile

## Later

- [x] Unit tests for `eval.js` and `fhir/import.js`
- [x] `item.prefix` support (numbered questions, e.g. `"1.1"`)
- [x] Repeating items (`item.repeats: true` / `maxOccurs`) — modal configures repeats + min/max cardinality; QR round-trip safe
- [x] SDC `variable` extension support (questionnaire-level variables, `%varName` in FHIRPath)
- [x] SDC `initialExpression` extension support — evaluated once on import + Re-init; result pre-fills `values[]`
- [ ] FHIR STU3 import compatibility shim
- [ ] External validator integration (link to HL7 / Simplifier validator, or local FHIR validation API call)
