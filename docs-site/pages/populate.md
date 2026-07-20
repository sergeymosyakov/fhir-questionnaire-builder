# Fill from a FHIR server ($populate)

Instead of filling a form by hand, you can ask a FHIR server to **pre-populate**
it from existing data — for example, pulling a patient's demographics and recent
observations straight into the answers. This uses the SDC `$populate` operation.

## Requirements

Pre-population talks to a server, so you first need a **FHIR server configured**
in [Settings](settings.md) — either the FHIR Base Server or a dedicated SDC
server. Until one is set, the option stays hidden.

For the server to know what to fill in, the questionnaire should declare the
**launch contexts** it expects (such as `%patient`) and use expressions that read
from them. See [FHIRPath in the builder](fhirpath.md) and
[Extensions & SDC](extensions-sdc.md).

## Populating

Open **Answers ▾ → ↧ Fill from FHIR Server…**:

1. Choose the **patient** the form is about (you can search the server).
2. The builder sends the questionnaire and the selected patient to the server's
   `Questionnaire/$populate` operation.
3. The returned `QuestionnaireResponse` is loaded into the preview as the current
   answers, with all logic re-run on top.

From there you can review and adjust the answers just as if you had typed them,
and export the response from the **Save** menu.

## Where the work happens

`$populate` runs on the **server** — the builder only sends the questionnaire and
the patient reference and displays the response. If you don't have a populating
server, you can still load answers from a file (see
[Import & round-trip](import-roundtrip.md)).

---

Next: [Definition-based extraction](definition-extract.md).
