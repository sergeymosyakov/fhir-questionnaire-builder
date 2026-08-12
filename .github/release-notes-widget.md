Embeddable **FHIR R4 QuestionnaireRenderer** — the builder's right-side runtime as a self-contained, in-page, multi-instance widget. No builder shell, no iframe, no framework.

## Assets
| File | Use |
|------|-----|
| `questionnaire-widget.js` | ES module (`import`) — recommended |
| `questionnaire-widget.global.js` | Classic `<script>` global (`window.FhirQuestionnaireWidget`) |
| `questionnaire-widget.css` | Widget styles (always include) |
| `SHA256SUMS.txt` | Verify your download: `sha256sum -c SHA256SUMS.txt` |

## Quick start
```html
<link rel="stylesheet" href="questionnaire-widget.css">
<div id="form"></div>
<script type="module">
  import { QuestionnaireRenderer } from './questionnaire-widget.js';
  const questionnaire = await (await fetch('my-questionnaire.json')).json();
  const widget = new QuestionnaireRenderer(document.getElementById('form'), {
    questionnaire, config: { previewMode: 'patient', validation: true },
  });
  document.querySelector('#save').onclick = () => save(widget.getResponse());
</script>
```

## Features
- Live SDC runtime: enableWhen / enableWhenExpression, calculatedExpression/initialExpression chains, constraints, PASS/FAIL validation.
- Opt-in chrome via `config`: `search`, `validation`, `explain`, `tooltips`, `navButton`.
- Per-widget server: `fhirBaseUrl`, `corsProxy` (reference search + `$populate`).
- API: `getResponse()`, `setResponse(qr)`, `setLanguage()`, `setConfig()`, `on/off`, `destroy()`.
- Multiple isolated widgets per page (own bus + answer store, zero cross-talk).

Full guide: [WIDGET.md](https://github.com/sergeymosyakov/fhir-questionnaire-builder/blob/master/WIDGET.md) · Live demo: [fhirbuilder.com/widget-demo.html](https://fhirbuilder.com/widget-demo.html)
