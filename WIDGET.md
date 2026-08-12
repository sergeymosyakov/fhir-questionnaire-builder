# QuestionnaireRenderer — embeddable FHIR form widget

The **right-hand runtime** of the FHIR Questionnaire Builder, packaged as a
self-contained, embeddable widget. Drop a FHIR R4 `Questionnaire` into any web
page and get a live, fillable form that runs the SDC logic (enableWhen,
`calculatedExpression`, constraints, validation) and returns a valid
`QuestionnaireResponse` — **no builder shell, no iframe, no framework**.

- **In-page & multi-instance** — put several forms on one page; each keeps its
  own answers, calculations and validation state with zero cross-talk.
- **Vanilla ES module** — no React/Vue/Angular required. Works with any stack.
- **Host-driven UI** — the widget has no menus; you turn features on through
  `config` and drive it through a small public API.

---

## Table of contents

- [Install](#install)
- [Quick start](#quick-start)
- [Configuration](#configuration)
- [Public API](#public-api)
- [Events](#events)
- [Example: custom “Export FHIR R4” button](#example-custom-export-fhir-r4-button)
- [Preview modes](#preview-modes)
- [Multiple isolated widgets](#multiple-isolated-widgets)
- [Styling](#styling)
- [Browser support & dependencies](#browser-support--dependencies)

---

## Install

Download the release bundle from the
[**GitHub Releases**](https://github.com/sergeymosyakov/fhir-questionnaire-builder/releases)
page. Each release contains three files:

| File | Use it when… |
|------|--------------|
| `questionnaire-widget.js` | You use ES modules (`import`). **Recommended.** |
| `questionnaire-widget.global.js` | You want a classic `<script>` global (`window.FhirQuestionnaireWidget`). |
| `questionnaire-widget.css` | Always — the widget’s styles. |

Verify the download with the `SHA256SUMS.txt` published alongside the assets.

```html
<link rel="stylesheet" href="questionnaire-widget.css">
<script type="module">
  import { QuestionnaireRenderer } from './questionnaire-widget.js';
  // …
</script>
```

Or build it yourself from source:

```bash
npm install
npm run build:widget       # → dist/questionnaire-widget.{js,global.js,css}
```

---

## Quick start

```html
<link rel="stylesheet" href="questionnaire-widget.css">
<div id="form"></div>

<script type="module">
  import { QuestionnaireRenderer } from './questionnaire-widget.js';

  const questionnaire = await (await fetch('my-questionnaire.json')).json();

  const widget = new QuestionnaireRenderer(document.getElementById('form'), {
    questionnaire,
    config: { previewMode: 'patient', validation: true },
  });

  widget.on('response-changed', qr => console.log('answers now:', qr));
</script>
```

That renders the questionnaire as a patient-facing form with a live PASS/FAIL
validation badge.

---

## Configuration

`new QuestionnaireRenderer(mountEl, { questionnaire, response?, config? })`

| Argument | Type | Description |
|----------|------|-------------|
| `mountEl` | `HTMLElement` | The container the form is rendered into (its contents are replaced). |
| `questionnaire` | `object` | FHIR R4 `Questionnaire` JSON. **Required.** |
| `response` | `object` | Optional `QuestionnaireResponse` to pre-fill answers. |
| `config` | `object` | Options below. Everything is **off unless you opt in**. |

### `config` options

| Option | Type | Default | What it does |
|--------|------|---------|--------------|
| `previewMode` | `'patient' \| 'preview' \| 'json'` | `'patient'` | Form view (see [Preview modes](#preview-modes)). |
| `search` | `boolean` | `false` | A search box that highlights matching rows (or JSON). |
| `validation` | `boolean` | `false` | Live **PASS / FAIL** badge + dropdown of items still needing attention; clicking one scrolls to it. |
| `explain` | `boolean` | `false` | Makes calculated values and FHIRPath/`enableWhen` conditions clickable to open an **Explain** popup showing *why* a value or visibility rule evaluates the way it does. |
| `tooltips` | `boolean` | `false` | Rich hover tooltips describing each field and its FHIR mapping. |
| `navButton` | `boolean` | `false` | A “go to builder node” arrow on each row (only meaningful when a builder is present). |
| `viewPrefs` | `object` | `{}` | Design-view toggles: `{ showLinkId, showPrefix, showBadges, showHiddenItems }`. |
| `language` | `string` | `''` | Show a translated language if the questionnaire carries translations (`''` = source). |
| `fhirBaseUrl` | `string` | — | FHIR base server for reference search and server-side `$populate`. |
| `corsProxy` | `string` | — | CORS proxy for the FHIR/terminology requests. |
| `readOnly` | `boolean` | `false` | Render answers without editable controls. |
| `onProgress` | `(msg\|null) => void` | — | Called with a message while long operations run, `null` when done. |

---

## Public API

```js
widget.getResponse();          // → current answers as a FHIR QuestionnaireResponse
widget.setResponse(qr);        // load answers from a QuestionnaireResponse
widget.setLanguage('es');      // switch active language ('' = source)
widget.setConfig({ language: 'es' });    // runtime config — only `language` takes effect
widget.on(event, cb);          // subscribe (returns the widget)
widget.off(event, cb);         // unsubscribe
widget.destroy();              // remove the widget and free all listeners
```

`getResponse()` always returns a fresh, valid FHIR R4 `QuestionnaireResponse`
built from the current answers — this is your integration point for saving,
submitting, or exporting.

> **Note:** the chrome flags (`search`, `validation`, `explain`, `tooltips`,
> `navButton`) are **construction-time** — set them in the initial `config`.
> `setConfig()` only applies `language` at runtime; to change chrome, `destroy()`
> and create a new instance.

---

## Events

Subscribe with `widget.on(name, cb)`:

| Event | Payload | Fires when |
|-------|---------|-----------|
| `ready` | — | The widget has mounted and rendered the first time. |
| `response-changed` | `QuestionnaireResponse` | Any answer changes. |
| `language-changed` | `string` (lang) | The active language changes. |
| `render` | — | The form re-renders. |

---

## Example: custom “Export FHIR R4” button

The widget deliberately ships **no toolbar**. To let a user export their answers,
add your own button on the host page and call `getResponse()` — the returned
object is a ready-to-save FHIR R4 `QuestionnaireResponse`:

```html
<div id="form"></div>
<button id="export">Export FHIR R4</button>

<script type="module">
  import { QuestionnaireRenderer } from './questionnaire-widget.js';

  const questionnaire = await (await fetch('my-questionnaire.json')).json();
  const widget = new QuestionnaireRenderer(document.getElementById('form'), {
    questionnaire,
    config: { previewMode: 'patient', validation: true },
  });

  document.getElementById('export').addEventListener('click', () => {
    const qr = widget.getResponse();               // ← ask the widget for answers
    const blob = new Blob([JSON.stringify(qr, null, 2)], { type: 'application/fhir+json' });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), {
      href: url, download: 'questionnaire-response.json',
    });
    a.click();
    URL.revokeObjectURL(url);
  });
</script>
```

A working version of this button is in the [live demo](https://fhirbuilder.com/widget-demo.html).

---

## Preview modes

`config.previewMode` picks how the form looks:

- **`patient`** — the clean, fillable form a respondent sees.
- **`preview`** — the design view with link IDs, prefixes and status badges.
- **`json`** — the live `QuestionnaireResponse` / `Questionnaire` JSON.

---

## Multiple isolated widgets

Each widget runs on its **own event channel and its own answer store**, so two
forms on the same page never affect each other:

```js
const a = new QuestionnaireRenderer(elA, { questionnaire: qA });
const b = new QuestionnaireRenderer(elB, { questionnaire: qB });
// answering a never touches b
```

See the [live demo](https://fhirbuilder.com/widget-demo.html) for a three-widget page (one per
preview mode) over the same questionnaire.

---

## Styling

Link `questionnaire-widget.css` once. It carries the widget’s design tokens and
all preview/control/modal styles, scoped so they don’t leak into your page’s
layout (no global `body`/reset rules). Override the CSS custom properties on a
wrapping element to re-theme (e.g. `--c-primary`, `--c-border`, `--c-surface`).

---

## Browser support & dependencies

- Modern evergreen browsers (ES2020 modules).
- The ESM/global bundles include their runtime dependencies (FHIRPath, DOMPurify,
  marked) — no extra `<script>` tags needed.
- No network calls unless you set `fhirBaseUrl` (reference search / `$populate`)
  or use terminology expansion.
