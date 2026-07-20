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

- [x] **Translation of `rendering-xhtml` / `rendering-markdown`** — XHTML and Markdown translations stored per-language in `questDoc.translations[lang].xhtml` / `.markdown` and in custom FHIR extensions. Google Translate preserves HTML tags and Markdown syntax. `_applyLabelContent` checks `xhtml[linkId]` first, then `markdown[linkId]` (via `marked + DOMPurify`), then plain `items[linkId]`.
- [ ] **Configurable translation provider** — the endpoint **URL** is now configurable in Settings (**Translation API → Endpoint URL**, stored under `serverConfig` key `translateApiUrl`, falling back to Google `gtx`). Still deferred: a full **provider picker** to switch protocol/auth between `gtx` (free, no key), DeepL free tier (requires key), LibreTranslate (self-hosted), or OpenAI — currently only `gtx`-compatible endpoints (same query params/response shape) are supported, so a custom URL must speak the `gtx` protocol.
- [x] **`_renderStyle` inheritance in translated view** — verified non-issue: `applyRenderStyle` is called after `_applyLabelContent` in `_buildRowContent`, so CSS styles are applied to the label element regardless of translation state.
- [x] **Partial translation badge / Edit existing** — already handled: "Edit existing" in the Translate modal shows all items, new/untranslated ones appear with empty fields making it clear what's missing.
- [x] **Edit existing translations outside the translate modal** — implemented: "Edit existing" button in the Translate modal picker pre-fills the review table from stored translations without calling the API.
- [ ] **`atable` itemControl support for translated answer option labels** — the `atable` renderer (when implemented) needs to read `rc.translations[lang].opts` for column headers.

## Later

- [ ] **Sub-questionnaire / modular questionnaires** — SDC `http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-subQuestionnaire`; requires FHIR server for resolution; out of scope until server integration exists
- [ ] **item.definition + StructureDefinition auto-population** — resolve `item.definition` URL against a FHIR server and auto-fill `text`, `type`, `baseType`, `fhirType` from the element; prerequisite: server integration

---
