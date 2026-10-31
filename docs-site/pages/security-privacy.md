# Security & privacy

The builder is a **client-side browser tool**. By default your questionnaires and
answers stay in your browser and are not sent anywhere.

## Where your data lives

- **Local by default** — building, previewing, import/export, extraction and
  translation all run in the browser. Your work is kept locally (including a
  recent-draft autosave you can restore).
- **Cloud is opt-in** — only if you sign in do questionnaires get stored in the
  cloud, and each user can only access their own data (enforced by row-level
  security). See [Cloud save](cloud-save.md).

## When the app talks to a server

External requests happen **only for features you configure or trigger**:

- Terminology expansion, `$populate`, and external validation call the servers you
  set in [Settings](settings.md).
- Out of the box the builder is pre-configured with a public terminology server
  (tx.fhir.org) and the NLM Clinical Tables service. Opening a questionnaire that
  refers to an external value set contacts the terminology server automatically,
  even if you changed nothing in Settings. A questionnaire can also name its own
  preferred terminology server, which is then contacted instead.
- A public external validator (HAPI FHIR) is listed in the defaults but stays
  **off** until you turn it on.
- Translation calls the configured provider (Google `gtx` by default; optionally
  DeepL, LibreTranslate or OpenAI). Provider API keys are stored client-side.
- Requests to other servers can go through a CORS proxy (a small relay needed
  because browsers block direct calls to many FHIR servers). The default proxy is
  run by the maintainer and stores no data. It only accepts request paths that
  look like FHIR operations (such as value-set expansion or `$validate`); it does
  not restrict which server the request is forwarded to. If you send an
  authorization header to a protected server, the proxy passes it on without
  storing it. You can point the builder at your own proxy in Settings.

To keep requests under your control, point the terminology server and proxy at
servers you run, and be careful with questionnaires that reference external value
sets.

## Sending clinical data

Because some features send the questionnaire or response to an external server,
be mindful when working with real patient data — point those features only at
servers you trust and are permitted to use. For sensitive data, prefer local-only
workflows (file import/export) or servers under your control.

## Content safety

Rich item text (XHTML/Markdown) is **sanitised** before rendering, so questionnaire
content cannot inject active scripts into the preview.

## Reporting a vulnerability

Please do not open a public issue for security problems. Report them privately to
the maintainer (see the `SECURITY.md` file in the source repository); confirmed
issues are addressed promptly.

---

Back to [What is this?](what-is-this.md).
