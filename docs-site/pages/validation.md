# Validation

The builder validates two different things: the **questionnaire** you are
authoring (is it well-formed FHIR?) and the **answers** entered in the preview
(are they complete and valid?).

## Live answer validation

As you fill in the preview, each control checks its own value and shows an inline
error when something is wrong. A status indicator summarises whether the whole
response is currently valid (a ✓ / ✗ badge). The checks include:

- **Required** — a mandatory item must be answered.
- **Format** — text must match a regular expression / expected format when one is
  set.
- **Text length** — respect the minimum and maximum character counts.
- **Numeric range** — a number must fall within its minimum / maximum value.
- **Reference type** — a reference answer must point at an allowed resource type.
- **Repeat count** — a repeating item must have an allowed number of entries.
- **File rules** — an uploaded file must satisfy the size and type limits.

An inline error and the overall ✓/✗ badge always agree — if a field is invalid,
the response is marked invalid.

## Custom constraints

Beyond the built-in checks you can add your own rules with a
**constraint** — a FHIRPath expression that must evaluate to `true`, paired with
your own error message (`questionnaire-constraint`). Constraints can reference
other answers via `%resource`, so you can express cross-field rules (e.g. "end
date must be after start date"). See [FHIRPath in the builder](fhirpath.md).

## Questionnaire validation on import

When you load a questionnaire, the builder checks its structure and reports any
problems it finds — malformed items, invalid references between items, and
similar issues — so you know what you're working with before you start editing.

## External FHIR validators (optional)

For authoritative validation against the FHIR specification and profiles, you can
configure one or more **validator servers** in [Settings](settings.md). When set
up, the builder can send the questionnaire (or response) to a validator and show
the returned issues. This is optional — the live checks above work entirely in the
browser with no server.

---

Next: [Translate a questionnaire](translate.md).
