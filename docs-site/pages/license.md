# License & attribution

How the FHIR Questionnaire Builder is licensed, and the credits and notices for the third-party content it uses (terminologies, scales, libraries and sample data).

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

## Ready-made templates

The scales offered under **+ Add → From template…** keep their original wording and
carry the credits their authors ask for. The picker shows each template's source and
license before you insert it.

- **PHQ-9, PHQ-2, GAD-7 and GAD-2** — developed by Drs. Robert L. Spitzer, Janet B.W. Williams, Kurt
  Kroenke and colleagues, with an educational grant from Pfizer Inc. No permission is
  required to reproduce, translate, display or distribute them
  ([phqscreeners.com](https://www.phqscreeners.com/)).
- **AUDIT-C** — a short form of the WHO AUDIT (Bush et al., *Arch Intern Med* 1998;158:1789).
  The ONC USCDI/ISP listing for AUDIT-C (submitted by NIAAA) states no restrictions on use
  ([isp.healthit.gov](https://isp.healthit.gov/uscdi-data/audit-c)).
- **PC-PTSD-5** — developed by the VA National Center for PTSD (Prins et al., 2015), which states that the measure is in the public domain and not copyrighted
  ([ptsd.va.gov](https://www.ptsd.va.gov/professional/assessment/screens/pc-ptsd.asp)).
- **GDS-15** — the Geriatric Depression Scale (Yesavage et al., 1983; short form Sheikh & Yesavage, 1986); its author states that neither the scale nor its electronic form is protected by copyright
  ([Stanford](https://web.stanford.edu/~yesavage/Testing.htm)).
- **ASQ** — the Ask Suicide-Screening Questions, developed at the NIMH Intramural Research Program (Horowitz et al., 2012), which describes the tool as public domain and free of charge
  ([nimh.nih.gov](https://www.nimh.nih.gov/ASQ)).
- **Clinical scales with original wording** (Glasgow Coma Scale, Apgar Score, qSOFA, CHA₂DS₂-VASc, Charlson Comorbidity Index; the scales are published clinical methods, each template lists its sources), **intake fragments and calculators** (demographics, allergies, medications, pain; body measurements, kidney function, cardiac measurements, lipid panel, chemistry calculations, FIB-4, pregnancy dating) — original wording written for this builder, covered by the project license above (non-commercial use with attribution; commercial use needs written permission). Calculator formulas are published methods; each template lists its sources.
- **Codes** — question and answer codes come from LOINC, copyright Regenstrief Institute,
  Inc., available at no cost under the [LOINC license](https://loinc.org/license/).

## Attribution in exports

Questionnaires you export are your own FHIR data. The builder does not inject
branding into exported resources beyond the standard FHIR fields you configure.

---

Next: [Security & privacy](security-privacy.md).
