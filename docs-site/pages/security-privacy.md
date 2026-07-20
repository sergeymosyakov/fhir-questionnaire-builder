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
- Translation calls the configured translation endpoint (Google `gtx` by default).
- A CORS proxy, when configured, forwards requests only to allowlisted FHIR
  servers and stores no data.

If you configure none of these, the builder makes no external FHIR calls.

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
