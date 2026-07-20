# Running locally

The builder is a **static site** — plain HTML, CSS and vanilla-JS ES modules.
There is no build step and no backend. You only need a local HTTP server,
because ES modules are blocked over the `file://` protocol.

## Prerequisites

- **Node.js** — used only to run a static file server and the tests. Any recent
  LTS works.
- A modern browser (Chromium, Firefox or Safari).

No compilation, bundler or framework install is required to *use* the app.

## Start the app

From the repository root, serve the folder over HTTP and open it in a browser:

```bash
npx serve .
# then open http://localhost:3000
```

On Windows you can use the bundled helper instead:

```powershell
.\start.ps1
```

Either way, the app boots from `index.html`. It loads a sample questionnaire by
default so you have something to explore immediately.

> **Why a server?** Opening `index.html` directly with `file://` fails — the
> browser refuses to load ES modules from the file system. Always go through
> `http://localhost:...`.

## Running the tests

Unit tests run in [Vitest](https://vitest.dev/), end-to-end tests in
[Playwright](https://playwright.dev/) (Chromium):

```bash
npm test             # unit tests — single run
npm run test:watch   # unit tests — watch mode
npm run test:e2e     # end-to-end tests
npm run test:e2e:ui  # end-to-end tests — Playwright UI
```

Linting uses ESLint:

```bash
npm run lint
```

Vitest and Playwright also run automatically in CI on every push.

## Hosted version

If you just want to try it without cloning anything, the same site is deployed
to GitHub Pages at <https://fhirbuilder.com/>.

---

Next: [Quick tour](quick-tour.md) walks through the interface, or jump into
[Core concepts](questionnaire-items.md).
