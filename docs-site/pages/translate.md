# Translate a questionnaire

The builder can produce **multi-language** questionnaires. Translations are stored
as standard FHIR translation extensions on the item text (and title), so they
round-trip through import/export like any other FHIR data.

## Translating

Open **Tools ▾ → Translate questionnaire…**:

1. **Pick a target language** from the list.
2. Click **Translate**. Every translatable string — item text, the questionnaire
   title, and the built-in UI strings shown in the patient view — is
   machine-translated in one pass.
3. **Review and edit** the results in a side-by-side table (original vs.
   translation). The translations are editable, so you can correct anything the
   machine got wrong.
4. **Apply** to save the reviewed translations onto the questionnaire.

Machine translation is a **starting point** — always review medical wording before
using a translated form for real.

The translation service is the unofficial Google Translate endpoint by default and
requires no API key; you can point it at a compatible self-hosted endpoint in
[Settings](settings.md).

## Switching language

Once translations exist, use the **language selector** to switch the preview
between the available languages, so you can see the form as a speaker of each
language would.

## How it's stored

Translations are written as FHIR translation extensions (on each item's `_text`,
and the questionnaire `_title`). Because they live in the questionnaire itself,
exporting produces a single multi-language `Questionnaire`, and importing one
restores every language.

---

Next: [Fill from a FHIR server ($populate)](populate.md).
