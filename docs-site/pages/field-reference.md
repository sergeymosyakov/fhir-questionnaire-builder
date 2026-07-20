# FHIR field reference

Alongside these guides, the builder ships with an **interactive FHIR Field
Reference** — a searchable table of every FHIR R4 / SDC field and extension the
builder knows about, and exactly where to configure it in the UI.

## Opening it

From the app, open **⋯ More → FHIR Reference**. It also opens as a standalone
page at `help.html`.

## What's in it

Each row lists:

- the **FHIR field or extension** (e.g. `Questionnaire.item.required`,
  `item.extension[questionnaire-hidden].valueBoolean`);
- a short **description** of what it does;
- **where in the UI** it lives (which modal or control);
- **how to access** it (the exact clicks).

A search box filters the table by field name, extension, or keyword, so you can
answer "where do I set X?" in seconds.

## When to use which

- Use **this documentation** for concepts and step-by-step tasks.
- Use the **FHIR Field Reference** when you already know the FHIR field you want
  and just need to find its control in the builder.
- See [FHIR mapping & round-trip fidelity](fhir-mapping.md) for how the builder's
  data model maps to FHIR overall.

---

Next: [FHIR mapping & round-trip fidelity](fhir-mapping.md).
