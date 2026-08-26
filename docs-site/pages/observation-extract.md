# Observation-based extraction

Observation-based extraction is the simplest of the three extraction mechanisms
— it turns coded answers directly into `Observation` resources, with no mapping
setup required. This is the how-to; for the concept and how it compares to the
other mechanisms, see [Extraction](extraction.md).

## How it works

Two things make an item extractable:

1. **A code on the item** (`item.code`) — this becomes the Observation's `code`.
2. **The extraction flag turned on** (`sdc-questionnaire-observationExtract`).
   The flag is **inherited down the tree**: turning it on for a group opts in
   every coded question beneath it, and an explicit "off" on one child overrides
   that inherited "on" for just that item.

Every coded item with an answer produces one `Observation` (`status: final`).
Answers with a `questionnaire-unit` extension are written as a `valueQuantity`
with that unit; other answer types map to the matching `value[x]` (string,
boolean, integer, decimal, dateTime, Coding).

## Running it

1. Fill in the form in the preview (or load a `QuestionnaireResponse`).
2. Open **Save ▾ → 🧪 Observations · FHIR JSON Bundle**.
3. A small dialog lets you optionally set the `subject` and `author`
   references and the `QuestionnaireResponse` id that each Observation should
   point back to, and whether to tag each Observation with the SDC Observation
   profile (on by default).
4. Confirm to download a transaction `Bundle` of the extracted Observations.

Everything runs in the browser — no server is required.

## When to use it vs. Definition-based extraction

Use **Observation-based** extraction when you simply want each coded answer to
become its own `Observation` — no setup beyond ticking the flag. Use
**definition-based** extraction when you need to populate specific fields of
specific resource types instead (e.g. build a `Patient` and a `Condition`). Both
are described in [Extraction](extraction.md).

---

Next: [Definition-based extraction](definition-extract.md).
