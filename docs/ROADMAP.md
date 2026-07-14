# ROADMAP

**Audience:** Developers and FHIR integration engineers (Variant B).  
**Feature filter:** Does it support Scenario 1 (edit & round-trip), 2 (build from scratch), or 3 (logic testing)?  
See [CONTEXT.md](CONTEXT.md) for scenario definitions.

---

## Next

### Horizon 2 — SDC completeness (extraction & population)

Supports Scenario 1 (round-trip) and Scenario 3 (logic testing). This is where most industrial-grade SDC complexity lives.

- [ ] **`item.definition` resolution** — resolve `item.definition` against a StructureDefinition to auto-fill `text`, `type`, and value constraints; prerequisite: FHIR server integration

## Near-term

- [ ] **Performance regression test** — automated test with 200–300 item questionnaire covering deep nesting (depth 6–8), heavy `enableWhen`, and multiple `calculatedExpression` chains; assert render time stays under threshold

## Technical Debt

### Translation feature — known gaps and planned improvements

The initial translation implementation (v1) covers the MVP flow: auto-translate via Google Translate → review table → FHIR `_text.extension[translation]` round-trip. The following improvements are deferred:

- [ ] **Translation of `rendering-xhtml` / `rendering-markdown`** — currently translations are always plain text. Items that use XHTML/Markdown formatting lose that formatting in translated view. Fix: store translated XHTML in `_text.extension[translation]` (requires the translate modal to post-process the API result back into markup, or a separate "rich translation" field). XSS risk must be mitigated via DOMPurify before any innerHTML assignment.
- [ ] **Configurable translation API** — currently hard-wired to Google `gtx` (unofficial endpoint). Add a Settings toggle to choose between `gtx` (free, no key), DeepL free tier (requires key), LibreTranslate (self-hosted URL), or OpenAI. Store the choice in `serverConfig`.
- [ ] **`Questionnaire.title` in the language switcher** — when a translation language is active, the preview panel title should also switch to the translated title. Currently only `item.text` (question labels) switch.
- [ ] **`_renderStyle` inheritance in translated view** — `rendering-style` CSS (bold, color, etc.) is currently applied before the translation check, so it may be lost when a translation renders as plain text. Fix: apply `_renderStyle` to the translated label element as well.
- [ ] **Partial translation badge** — when a translation exists for only some items (e.g. only 3 of 9 PHQ-9 questions are translated), the language switcher should indicate incomplete coverage. Consider a warning indicator or per-item "missing translation" fallback marker.
- [ ] **Edit existing translations outside the translate modal** — currently translations can only be edited in the Translate modal. A per-item inline edit (e.g. a small tooltip or side panel) would improve workflow for incremental corrections.
- [ ] **`atable` itemControl support for translated answer option labels** — the `atable` renderer (when implemented) needs to read `rc.translations[lang].opts` for column headers.

## Later

- [ ] **Sub-questionnaire / modular questionnaires** — SDC `http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-subQuestionnaire`; requires FHIR server for resolution; out of scope until server integration exists
- [ ] **item.definition + StructureDefinition auto-population** — resolve `item.definition` URL against a FHIR server and auto-fill `text`, `type`, `baseType`, `fhirType` from the element; prerequisite: server integration

---
