# ROADMAP

**Audience:** Developers and FHIR integration engineers (Variant B).  
**Feature filter:** Does it support Scenario 1 (edit & round-trip), 2 (build from scratch), or 3 (logic testing)?  
See [CONTEXT.md](CONTEXT.md) for scenario definitions.

---

## Next

- [ ] **More sample data** — 2–3 additional questionnaires covering different complexity levels, with documented expected PASS/FAIL outcomes per patient profile
- [ ] **Copy / paste nodes** — duplicate a question or an entire group (with children) anywhere in the tree

## Technical Debt

- [ ] **Remove remaining `@vue/reactivity` usage** — `MetadataCard` still uses `effect()` to watch `questMeta.status/experimental`; replace with a named `AppEvents.QUEST_META_CHANGED` event dispatched from the metadata modal on apply. Once done, `effect` can be dropped from `app.js` imports entirely and `@vue/reactivity` reduced to `ref`/`reactive` for core state only (or replaced with plain objects + events).

## Later

- [ ] **External validator integration** — link to HL7 / Simplifier validator or call a local FHIR validation API; surface results as item-level badges

---
