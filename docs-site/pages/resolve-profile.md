# Resolve from profile

When a questionnaire item is tied to a specific FHIR data element via its
**Definition URL** (`item.definition`), the builder can read the matching FHIR
profile and **auto-fill the item** — its text, answer type, and value constraints
— from that element. This saves configuring each field by hand and keeps the form
aligned with the profile.

## Setting the Definition URL

An item's Definition URL points at an element in a `StructureDefinition`, in the
form:

```
https://example.org/StructureDefinition/Patient#Patient.name.family
```

The part before `#` is the profile's canonical URL; the part after is the element
inside it. You set this in the item's **Definition** section.

## Resolving

In the item's Definition section, use **Resolve from profile…**:

1. Choose a **StructureDefinition JSON** file (the profile that the Definition URL
   refers to).
2. The builder finds the referenced element and fills in the item's **text**,
   **answer type**, and **value constraints** (such as min/max, bindings and
   allowed reference target profiles) from that element.

A status line confirms which element was resolved.

## No server needed

Resolution runs **entirely in the browser** — you supply the profile as a file,
and the builder reads it directly. Nothing is sent anywhere. If a profile bundles
several types, the element id in the Definition URL selects the exact element to
use.

## Related

Definition URLs are also what drive [Definition-based extraction](definition-extract.md)
on the output side — the same annotation both configures an item from a profile
and maps its answer back out to a resource field.

---

Next: [REDCap import/export](redcap.md).
