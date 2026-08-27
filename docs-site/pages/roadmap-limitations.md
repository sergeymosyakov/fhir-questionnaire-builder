# Roadmap & limitations

An honest list of what the builder does **not** do yet. It is a focused tool, not
a full platform, and some FHIR/SDC capabilities are intentionally out of scope for
a zero-backend browser app.

## Known limitations

- **Translation providers** — machine translation supports Google `gtx` (free,
  no key), DeepL, LibreTranslate and OpenAI, selectable in
  [Settings](settings.md). Caveats for a browser-only app: provider API keys are
  stored client-side, and DeepL has no browser CORS so it needs a configured CORS
  proxy. See [Translate](translate.md).
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
