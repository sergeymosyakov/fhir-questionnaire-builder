# Embed the renderer

The right-hand preview — the part that renders a questionnaire as a fillable
form, runs the logic, validates answers and shows the FHIR JSON — can be
**embedded in your own web page** as a self-contained widget, without the
builder shell around it. Host apps use it to let people *fill in* a questionnaire
you designed here, in-place, with no iframe.

You can put **several independent widgets on one page** — each keeps its own
answers, calculations and validation state, with no cross-talk.

## Quick start

```html
<link rel="stylesheet" href="css/widget.css">
<div id="form"></div>

<script type="module">
  import { QuestionnaireRenderer } from './js/renderer/index.js';

  const questionnaire = await (await fetch('my-questionnaire.json')).json();

  const widget = new QuestionnaireRenderer(document.getElementById('form'), {
    questionnaire,
    config: { previewMode: 'patient' },
  });

  widget.on('response-changed', qr => console.log('answers now:', qr));
</script>
```

That renders the questionnaire as a patient-facing form. See
in the repository for a complete three-widget example, or open the
[live demo](https://fhirbuilder.com/widget-demo.html).

## Modes

`config.previewMode` picks how the form looks — the same three views as the
builder's preview panel (see [Preview, Patient View & FHIR JSON](preview-modes.md)):

- `patient` — the clean, fillable form a respondent sees.
- `preview` — the design view with link IDs, prefixes and status badges.
- `json` — the live `QuestionnaireResponse` / `Questionnaire` JSON.

## Turning features on

The widget has **no menus** — the host page decides what to show through
`config`. Everything is off unless you opt in:

| Option | What it adds |
|--------|--------------|
| `search: true` | A search box that highlights matching rows (or JSON). |
| `validation: true` | A live **PASS / FAIL** badge with a dropdown listing the items that still need attention; clicking one scrolls to it. |
| `explain: true` | Makes calculated values and FHIRPath conditions clickable to open an **Explain** popup that shows why a value or a visibility rule evaluates the way it does. |
| `tooltips: true` | Rich hover tooltips describing each field and its FHIR mapping. |
| `navButton: true` | A “go to builder node” arrow on each row (only useful when a builder is present). |
| `fhirBaseUrl`, `corsProxy` | A FHIR server for reference search and server-side `$populate`. |
| `viewPrefs: { showLinkId, showPrefix, showBadges, showHiddenItems }` | Fine-grained toggles for the design view. |
| `language: 'fr'` | Show a translated language if the questionnaire carries translations. |

## Reading and setting answers

```js
const qr = widget.getResponse();   // current answers as a QuestionnaireResponse
widget.setResponse(existingQR);    // load answers back in
widget.setLanguage('es');          // switch language
widget.setConfig({ validation: true });
widget.destroy();                  // remove it and free listeners
```

Events you can subscribe to with `widget.on(name, cb)`: `ready`,
`response-changed`, `language-changed`, `render`.

## Why it stays isolated

Each widget runs on its **own event channel and its own answer store**, so two
forms on the same page never affect each other. The host owns the surrounding
UI; the widget only renders and reports back through the API and events.

---

Next: [Validation](validation.md).
