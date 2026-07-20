# Settings

The **Settings** page (⋯ More → Settings) configures the external servers and
services the builder can talk to. Everything here is **optional** — the builder
works offline without any of it; these settings only enable features that need a
server (terminology expansion, `$populate`, external validation, translation).

Settings are saved in your browser, and synced to your account when you are signed
in (see [Cloud save](cloud-save.md)). Each field has a **Reset** to return it to
its default.

## Servers & services

- **Terminology Server** — a FHIR `$expand` endpoint used to resolve `ValueSet`
  bindings so choice options can be pulled from a value set.
- **FHIR Base Server** — a FHIR server used for searching resources (e.g. finding
  a patient) and as the fallback for SDC operations.
- **SDC Server** — a server that implements the SDC operations such as
  `$populate`; falls back to the FHIR Base Server when blank.
- **CORS Proxy** — a proxy that forwards requests to FHIR servers that don't send
  CORS headers, which browsers otherwise block. Needed for browser-based calls to
  some external servers.
- **NLM Clinical Tables API** — an endpoint for searching clinical terminology
  (LOINC, SNOMED, ICD); it is CORS-enabled so no proxy is required.
- **Translation API** — the endpoint used by [Translate](translate.md). Defaults
  to the free, key-less Google `gtx` endpoint; can point at a compatible
  self-hosted proxy.

## Validators

The **Validators** section manages the validation pipeline. A built-in validator
always runs; you can add **external validators** that send the questionnaire to a
FHIR server's `$validate` endpoint. See [Validation](validation.md).

## Active configuration sources

Because a setting can come from a default, your browser, or your cloud account,
the **Active Configuration Sources** section shows how each value is resolved —
higher-priority sources override lower ones — so you can tell where a given value
is coming from.

---

Next: [Comparison with other tools](comparison.md).
