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

- [x] **Translation of `rendering-xhtml` / `rendering-markdown`** — XHTML translations stored per-language in `questDoc.translations[lang].xhtml` and in a custom `http://fhir-qb.app/StructureDefinition/xhtml-translations` FHIR extension. Google Translate preserves HTML tags. `_applyLabelContent` checks `xhtml[linkId]` first (rendered via `innerHTML + DOMPurify`), then plain `items[linkId]`.
- [ ] **Configurable translation API** — currently hard-wired to Google `gtx` (unofficial endpoint). Add a Settings toggle to choose between `gtx` (free, no key), DeepL free tier (requires key), LibreTranslate (self-hosted URL), or OpenAI. Store the choice in `serverConfig`.
- [ ] **`Questionnaire.title` in the language switcher** — when a translation language is active, the preview panel title should also switch to the translated title. Currently only `item.text` (question labels) switch.
- [x] **`_renderStyle` inheritance in translated view** — verified non-issue: `applyRenderStyle` is called after `_applyLabelContent` in `_buildRowContent`, so CSS styles are applied to the label element regardless of translation state.
- [ ] **Partial translation badge** — when a translation exists for only some items (e.g. only 3 of 9 PHQ-9 questions are translated), the language switcher should indicate incomplete coverage. Consider a warning indicator or per-item "missing translation" fallback marker.
- [x] **Edit existing translations outside the translate modal** — implemented: "Edit existing" button in the Translate modal picker pre-fills the review table from stored translations without calling the API.
- [ ] **`atable` itemControl support for translated answer option labels** — the `atable` renderer (when implemented) needs to read `rc.translations[lang].opts` for column headers.

## Later

- [ ] **Sub-questionnaire / modular questionnaires** — SDC `http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-subQuestionnaire`; requires FHIR server for resolution; out of scope until server integration exists
- [ ] **item.definition + StructureDefinition auto-population** — resolve `item.definition` URL against a FHIR server and auto-fill `text`, `type`, `baseType`, `fhirType` from the element; prerequisite: server integration

---
