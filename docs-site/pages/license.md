# License & attribution

## License

© 2026 [Sergey Mosyakov](https://github.com/sergeymosyakov) /
[Roko Labs Inc.](https://www.rokolabs.com)

The project is **source-available for non-commercial use with attribution**.
**Commercial use requires prior written permission.** See the `LICENSE` file in the
source repository for the authoritative terms.

If you use the tool or its code in a non-commercial setting, keep the attribution
to the author and Roko Labs.

## Third-party libraries

The builder is dependency-light and bundles a few open-source libraries in `lib/`,
including:

- **FHIRPath.js** — the FHIRPath engine used by the runtime.
- **marked** — Markdown rendering (used for item text and this documentation).
- **DOMPurify** — HTML sanitisation for any rendered XHTML/Markdown.

Each retains its own license; see the files under `lib/` in the repository.

## Attribution in exports

Questionnaires you export are your own FHIR data. The builder does not inject
branding into exported resources beyond the standard FHIR fields you configure.

---

Next: [Security & privacy](security-privacy.md).
