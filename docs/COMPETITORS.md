# Honest Competitive Comparison

> A deliberately unvarnished assessment of where this builder stands against
> other FHIR Questionnaire / SDC tools. Written to expose gaps, not to market.
> If something here reads as a weakness — it is one. Last reviewed: June 2026.

This is a **zero-backend, single-page browser tool** served as static files
(GitHub Pages). That framing matters: several "competitors" below are full
healthcare platforms with a FHIR store, auth, and server-side operations. We do
not compete with them on that axis and never will. The fair comparison is
"browser-based questionnaire authoring + a live SDC runtime."

---

## The field

| Tool | Type | License | Backend |
|---|---|---|---|
| **This builder** | Standalone SPA builder + live runtime | Source-available, non-commercial | None (static) |
| **NLM LHC-Forms Form Builder** | Standalone SPA builder | Open source (public domain) | None (static) |
| **CSIRO Smart Forms** | SPA renderer + authoring | Apache-2.0 | Optional FHIR server |
| **Aidbox Forms** (Health Samurai) | Commercial platform module | Proprietary | Aidbox FHIR server |
| **Medplum** | Open-core platform | Apache-2.0 / commercial | Medplum server |
| **Firely** ecosystem | SDK + server tooling | Proprietary / OSS mix | Vonk/Firely server |

The only true apples-to-apples peers are **LHC-Forms** and **Smart Forms**.
Aidbox / Medplum / Firely are platforms; comparing the whole platform to a
single SPA is unfair to both sides, so those rows below focus only on the
authoring/runtime slice.

---

## Where we are genuinely competitive

| Area | Honest status |
|---|---|
| Field-mapping coverage | On par with LHC-Forms for R4 Questionnaire fields and common SDC extensions. |
| Round-trip transparency | **Better than most.** Every import↔export mapping is documented and silent data loss is explicitly flagged (`docs/FHIR-MAPPING.md`). Few tools publish this. |
| Live SDC runtime | Real client-side FHIRPath: `enableWhen` / `enableWhenExpression`, `calculatedExpression`, `initialExpression` chains evaluate against an injected Patient. Comparable to Smart Forms. |
| Multi-version support | STU3→R4 normalization on import; R5-only fields downgraded to private extensions on R4/R4B export with lossless re-import. Engineering-solid. |
| Logic testing UX | Patient-context presets to drive expressions, undo/redo, autosave, drag-and-drop, cloud persistence. This is our strongest differentiator over LHC-Forms. |
| Validation | HAPI `$validate` integration plus formal R4 invariants and cross-field semantic warnings. |

## Where we are at parity (with caveats)

| Area | Honest status |
|---|---|
| `$populate` | Implemented, but **requires an external SDC-capable server** (e.g. Matchbox). Cannot be exercised without one. Aidbox does this natively. |
| Definition-based extraction | Implemented **client-side** for `item.definition` + `definitionExtract`. Covers the common case; not a general extraction engine. |
| Reference resolution | Resource-type dropdown + id input + live FHIR server search (when a base server is configured). No profile-based validation of the chosen reference. |
| Terminology binding | `answerValueSet` expansion works against a configured tx server; falls back to built-in lists. Fine for demos, limited in practice. |

## Where we are honestly behind

| Gap | Who does it better | Why it matters |
|---|---|---|
| **StructureMap-based extraction/population** (`targetStructureMap` / `sourceStructureMap`) | Aidbox, Firely | Round-tripped only — **not executed.** This is the core of industrial-grade SDC extraction. Biggest single gap. |
| **`item.definition` resolution against a StructureDefinition** | Aidbox, Firely | No auto-fill of `text` / `type` / value constraints from a profile. Authoring is fully manual. |
| **Licensed terminology** (LOINC, SNOMED CT) | Any platform with a real tx server | Public HAPI doesn't load these, so validation of coded answers is partial. |
| **Persistence / API / auth as a product** | Aidbox, Medplum, Firely | We have Supabase-backed cloud save, but we are not a FHIR store and have no server API. |
| **Renderer maturity / accessibility audit** | LHC-Forms (battle-tested at NIH scale) | Their renderer has years of production hardening and formal a11y review; ours does not. |
| **Ecosystem / adoption** | LHC-Forms, Medplum | Reference implementations with large user bases, integrations, and community. We are an early-stage prototype. |

---

## Brutally honest summary

- As a **free, browser-only FHIR questionnaire builder + tester with trustworthy
  export**, this is competitive today and arguably ahead of LHC-Forms on UX.
- It is **not** an industrial SDC engine: no StructureMap execution, no profile
  resolution, no licensed terminology, no server.
- It is **not** a platform and should not be evaluated against Aidbox / Medplum /
  Firely as if it were one.
- It is an **early-stage prototype** by adoption and hardening, regardless of
  feature breadth. Feature count ≠ production maturity.

**The two things that would move us from "good prototype" to "industrial-grade":**
StructureMap-based transform execution, and integration with a real terminology
server. Everything else is polish.
