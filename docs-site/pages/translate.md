# Translate a questionnaire

The builder can produce **multi-language** questionnaires. Translations are stored
as standard FHIR translation extensions on the item text (and title), so they
round-trip through import/export like any other FHIR data.

## Translating

Open **Settings ▾ → Translate questionnaire…**:

1. **Pick a target language** from the list.
2. Click **Translate**. Every translatable string — item text, the questionnaire
   title, the labels of answer choices, and the built-in UI strings shown in the patient view — is
   machine-translated in one pass.
3. **Review and edit** the results in a side-by-side table (original vs.
   translation). The translations are editable, so you can correct anything the
   machine got wrong.
4. **Apply** to save the reviewed translations onto the questionnaire.

Machine translation is a **starting point** — always review medical wording before
using a translated form for real.

The default provider is the unofficial Google Translate endpoint (free, no API
key). In [Settings](settings.md) you can switch the provider to DeepL,
LibreTranslate or OpenAI, and set the endpoint and API key each one needs.

## Switching language

Once translations exist, use the **language selector** to switch the preview
between the available languages, so you can see the form as a speaker of each
language would. Question text and the labels of answer choices (dropdowns, radio
buttons, checklists, open-choice lists, tables) switch together; a choice with no
translation keeps its original label. Only the label changes — the stored answer
and any calculation still use the choice's code.

## How it's stored

Translations are written as FHIR translation extensions (on each item's `_text`,
each answer choice's display, and the questionnaire `_title`). Because they live in the questionnaire itself,
exporting produces a single multi-language `Questionnaire`, and importing one
restores every language.

---

Next: [Fill from a FHIR server ($populate)](populate.md).
