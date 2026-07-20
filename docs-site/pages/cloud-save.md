# Cloud save

By default the builder runs entirely in your browser and nothing leaves your
machine. If you sign in, you can additionally **save questionnaires to the cloud**
so they follow you between devices and sessions.

## Signing in

Cloud features use **GitHub sign-in**. Choose the sign-in option and authorise with
your GitHub account; you are returned to the builder signed in. Sign out at any
time to go back to local-only use.

## Saving to the cloud

While signed in, the **Save ▾** menu offers a cloud-save action that stores the
current questionnaire to your account. Your cloud questionnaires are private to
your account.

## Opening from the cloud

Open **Questionnaires ▾ → ☁️ From Cloud…** to see the list of questionnaires you
have saved. From there you can **open** one back into the builder, or **delete**
ones you no longer need.

## Settings sync

When signed in, your [Settings](settings.md) (server URLs, validators and similar
preferences) are also synced to your account, so a device you sign in on picks up
the same configuration.

## Sharing your work

There is no public share-link feature — cloud storage is personal. To share a
questionnaire with someone else, export it as **📄 Questionnaire · FHIR JSON** from
the **Save** menu and send them the file; they can open it with
**Questionnaires ▾ → 📂 From file…** (see [Import & round-trip](import-roundtrip.md)).

## Without an account

Signing in is entirely optional. Everything except cloud storage — building,
previewing, import/export, extraction, translation — works without an account, and
your most recent work is kept as a local **Recent draft** you can restore from the
**Questionnaires** menu.

---

Next: [FHIR field reference](field-reference.md).
