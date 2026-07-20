# Roadmap & limitations

An honest list of what the builder does **not** do yet. It is a focused tool, not
a full platform, and some FHIR/SDC capabilities are intentionally out of scope for
a zero-backend browser app.

## Known limitations

- **StructureMap execution** — questionnaires may *reference* a StructureMap for
  extraction or population, but the builder does **not execute** FHIR Mapping
  Language transforms in the browser (there is no mature, permissively-licensed,
  browser-capable engine). StructureMaps are round-tripped but not run. To apply
  one, use a server that supports `$transform`. See [Extraction](extraction.md).
- **`atable` answer-table rendering** — rendering a group as a repeating answer
  table (`itemControl = atable`) is not yet implemented.
- **Translation providers** — machine translation currently supports only
  Google-`gtx`-compatible endpoints; other providers (DeepL, LibreTranslate, …)
  are not yet selectable. See [Translate](translate.md).
- **Sub-questionnaires** — modular / sub-questionnaire resolution needs a FHIR
  server and is out of scope until server integration exists.
- **Instance-level profile conformance** — the builder can derive an item's type
  and constraints from a profile ([Resolve from profile](resolve-profile.md)) and
  check reference target types, but it does not validate a filled response against
  a profile the way a server validator would (that's what external
  [validators](validation.md) are for).

## Scope, honestly

This is a prototype-grade tool. It aims to make authoring, testing and
round-tripping FHIR questionnaires fast and dependency-free — not to replace a
FHIR server or a clinical data platform. Features that fundamentally require a
backend are either delegated to a server you configure, or left out.

If something you need is missing, it may be a deliberate gap listed here — or a bug
worth reporting.

---

Next: [License & attribution](license.md).
