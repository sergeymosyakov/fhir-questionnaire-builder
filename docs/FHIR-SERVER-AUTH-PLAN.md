# FHIR Server Auth Plan — builder app login/token lifecycle

> **Status: implemented for `FHIR_BASE` + `SDC_SERVER`** (issue #63) — see
> "Production flow" below for what's done and the known scope cuts
> (`TERMINOLOGY_SERVER`/`VALIDATORS` not yet wired). An **interim debug
> tool** (`dev-fhir-login.html`, `client_credentials`, one shared token)
> also exists for local testing against a real dev/QA server — see "Interim
> debug tool" further down. Scope is the **builder app** (`js/settings.js`,
> `js/fhir/server-config.js`), not the embeddable widget — the widget has a
> separate model (host supplies a `getToken()` callback; the widget never
> owns login).

## Why the builder is different from the widget

The builder has no "host" to delegate auth to — it's the only party talking
to external FHIR servers, so it must own any OAuth flow itself. Up to **4
independently-configured servers** (`CONFIG_KEYS` in
[server-config.js](../js/fhir/server-config.js)) each need their own token,
not one shared login: `FHIR_BASE`, `SDC_SERVER`, `TERMINOLOGY_SERVER`,
`VALIDATORS`.

## Locked decisions

- **Login trigger = lazy**, per server, at first real attempted use of that
  specific server — not an app-wide gate at startup, not a separate explicit
  "Connect" step. Existing **"Test connection" button** in Settings
  (`js/settings.js` `_testFhirServer`) doubles as one such first-use trigger
  point (clicking it can itself run login-then-test). Other trigger points:
  `SdcPopulateModal` "Fill from FHIR Server" click, first term-search
  dropdown open.
- **Grant type: Authorization Code + PKCE** — no `client_secret` anywhere
  (there's no secure place to store one). Plain Authorization Code and
  `client_credentials` both need a confidential-client secret; PKCE doesn't.
- **Real popup/new window required for login**, not the app's in-page
  pseudo-modals (`js/ui/modals/modal-base.js`) — OAuth redirects to a
  cross-origin IdP login page, which pseudo-modals can't host (most IdPs
  also send `X-Frame-Options`/`frame-ancestors` blocking iframes anyway).
  Needs a small same-origin static callback page (e.g. `oauth-callback.html`)
  that reads `code`, exchanges it, then
  `window.opener.postMessage(...)` + `window.close()`.
- **Tokens (access + refresh) persisted to `localStorage`** — accepted
  tradeoff given there's currently no more secure storage available.
- **Renewal = periodic background ping**, always running (including hidden
  tabs, best-effort — browsers throttle background timers to ~1 min
  granularity, acceptable given minute/second-scale buffers):
  - **Adaptive interval**: base 5 min, shrinks as expiry nears. Implemented
    as a self-rescheduling `setTimeout` computing
    `next = min(5min, timeUntilExpiry - ~5s buffer)`, not a flat
    `setInterval`. One scheduler loop covers all configured servers,
    reschedules against the soonest upcoming deadline across them.
  - Renewal itself (when a `refresh_token` is present) is a **plain silent
    POST** to the token endpoint — no popup/iframe needed for that path.
  - **`refresh_token` may be absent** for some servers/flows — in that case
    the scheduler just watches access-token expiry directly and goes
    straight to the login prompt when it's gone (no silent path exists).
  - **On app boot**, if valid tokens already exist in `localStorage` for a
    server, start its ping scheduler immediately (don't wait for first use).
  - **The ping/renewal scheduler for a given server only activates after
    that server's first real login attempt** (whether triggered by Test
    Connection, Fill-from-Server, or term search) — it is never started
    eagerly for a configured-but-never-used server. This keeps renewal
    consistent with the lazy first-login trigger above.
- **On full expiry** (no refresh token, or the refresh call itself failed):
  show the login prompt **proactively**, not lazily wait for the next
  feature use — but gated by a real technical constraint:
  - `window.open()` from a background timer callback (no user gesture) is
    blocked by popup blockers in Chrome/Firefox/Safari alike.
  - Resolution: show an immediate **in-page banner/toast** ("session for
    `<server>` expired — click to log in") the moment the ping detects full
    expiry; the actual `window.open()` call happens **inside that banner's
    click handler**, preserving the user-gesture requirement while still
    feeling proactive (the prompt itself appears immediately, only the
    popup open is gesture-gated).
- **User declines / closes the login popup without completing it** — clear
  that server's stored tokens (access + refresh) from `localStorage`
  entirely and stop scheduling renewal for it. Falls back fully to the lazy
  first-login trigger — the next real attempted use of that server starts a
  fresh login. (No way to distinguish an intentional cancel from an
  accidental close — both treated the same: incomplete popup = decline.)

## Still open

- Multi-tab correctness: if refresh tokens rotate (single-use), two open
  builder tabs racing to refresh near-simultaneously could invalidate each
  other's stored refresh token. Not yet decided whether to coordinate
  (`BroadcastChannel`/storage events) or accept as a known v1 limitation.
- Token storage format/keying per server, retry-on-401 behavior at the
  fetch call sites (`fhir-search.js`, `sdc-populate.js`,
  `terminology-service.js`, `validators/external.js`), concrete
  `oauth-callback.html` contract, and the actual config UI in Settings
  (per-server client_id/authorize-URL/token-URL fields).

## Production flow (implemented, issue #63) — scoped to FHIR_BASE + SDC_SERVER

Everything in "Locked decisions" above is implemented for `FHIR_BASE` and
`SDC_SERVER` only:

- `js/fhir/oauth-client.js` — PKCE (`crypto.subtle` SHA-256), popup login,
  `refreshAccessToken`, `ensureLoggedIn`. Tokens in plain `localStorage`
  (`fhirqb.oauthToken.<serverKey>.*`), never via `serverConfig`.
- `oauth-callback.html` + `js/fhir/oauth-callback-page.js` — the popup's
  redirect target; relays `code`/`state`/`error` via `postMessage`, closes.
- `js/fhir/oauth-scheduler.js` — adaptive self-rescheduling renewal;
  dispatches `AppEvents.OAUTH_LOGIN_REQUIRED` when it can no longer renew.
- `js/ui/oauth-login-banner.js` — listens for that event, shows the
  dismissible banner; the actual `window.open()` only happens on its own
  button click (popup-blocker-safe).
- Settings UI — optional "OAuth login" fields (Authorize/Token URL, Client
  ID, Scope) added to the FHIR Base Server and SDC Server cards.
- Lazy trigger points wired: Settings "Test connection" (both cards) and
  the "Fill from FHIR Server" button (`preview-form.js` `_populate()`) —
  each calls `ensureLoggedIn(serverKey)` as its first async step (before any
  other `await`), preserving the click's user-gesture window for the popup.
- `fhir-search.js`/`sdc-populate.js` prefer the real OAuth token over the
  interim debug token, and retry once on a `401` (force-refresh, then
  retry) before surfacing the error.

**Known scope cuts (not done in this pass, by design):**
- **`TERMINOLOGY_SERVER` and `VALIDATORS` are NOT wired to real OAuth.**
  `terminology-service.js` takes its config via constructor DI specifically
  so the widget can supply its own — importing the concrete `oauth-client`
  singleton into it would break that decoupling; it would need an injected
  `authHeaderFn` instead. `VALIDATORS` is a JSON array of independent
  validator entries (different shape entirely). Both still work exactly as
  before (interim debug token or unauthenticated) — no half-built UI exists
  for them (no OAuth fields in Settings for either).
- **Patient-search autocomplete (typing in `SdcPopulateModal`) does not
  trigger login** — a debounced keystroke isn't a reliable user-gesture
  context for `window.open()`, and popping a login window while someone is
  mid-typing would be a bad UX surprise. It surfaces a `401` as a normal
  error message instead; only the "Fill from Server" button click ensures
  login.
- Multi-tab refresh-token-rotation races and any coordination
  (`BroadcastChannel`) — unhandled, accepted as a v1 limitation.

## Interim debug tool (implemented, issue #63)

- `dev-fhir-login.html` + `js/dev/fhir-login-debug.js` — a standalone,
  unlinked page (not part of the builder's nav) with three actions:
  **Save** (persists Token URL / Client ID / Client Secret to
  `sessionStorage` — cleared when the tab closes, no network call), **Test**
  (one-off `client_credentials` fetch to verify the credentials work — never
  stored/reused), **Reset** (clears the saved fields).
- **Fresh token per request, not cached** — confirmed empirically against a
  real partner sandbox server that its access tokens are **single-use**
  (reusing one returns `OperationOutcome: "Invalid Token. Token has already
  been used."`). So `getFhirAuthHeader()` in
  [server-config.js](../js/fhir/server-config.js) reads the saved
  credentials from `sessionStorage` and performs a brand-new
  `client_credentials` exchange on **every** call — no caching, no shared
  token, no expiry tracking. It is `async` (a real network round-trip per
  call), so every call site (`fhir-search.js`, `sdc-populate.js`,
  `settings.js` `_testFhirServer`) awaits it.
- Wired into the two calls on the critical path for testing "Fill from FHIR
  Server": `searchFhir()` in [fhir-search.js](../js/fhir/fhir-search.js) and
  `populateFromServer()` in [sdc-populate.js](../js/fhir/sdc-populate.js) —
  both skip it for the known public demo hosts (`CORS_ENABLED_HOSTS`).
- **Not** the production flow: no PKCE, no popup, no per-server config —
  `client_credentials` requires a client secret typed directly into a
  browser field (never written to disk, never committed) and is a
  local-testing-only bridge, not something the product ships to end users.

## Progress tracker

| Phase | Description | Status |
|-------|-------------|--------|
| A | Interim debug tool (`client_credentials`, issue #63) | ✅ Done |
| B | Production OAuth (PKCE + popup + renewal), `FHIR_BASE` + `SDC_SERVER` | ✅ Done |
| C | Extend to `TERMINOLOGY_SERVER` (needs an injected auth-header hook, not a direct `oauth-client` import) and `VALIDATORS` | Not started |
| — | E2E coverage (mocked IdP: `tests/e2e/oauth-login-flow.spec.js`, `oauth-login-banner.spec.js`, `oauth-settings.spec.js`, `dev-fhir-login.spec.js`) | ✅ Done |
| — | Manual verification against a real OAuth-protected FHIR server | Not started |
