// ── FHIR Patient R4 context — reactive fields for questionnaire logic ─────────
// Represents the patient being screened. Separated from app state (state.js)
// so patient context can be swapped or serialised independently
// (e.g. loaded from a FHIR Patient resource).
//
// Available in visibility / condition rules as bare variables:
//   age, gender, bmi, pregnant, smoker, proc, comorb
import { ref } from 'https://unpkg.com/@vue/reactivity@3.5/dist/reactivity.esm-browser.js';

export const age      = ref(30);
export const gender   = ref('male');   // male | female | other | unknown
export const bmi      = ref(42);
export const pregnant = ref(false);    // boolean (Extension: pregnancyStatus)
export const smoker   = ref(false);    // boolean (Observation: tobacco-use)
export const proc     = ref('43644'); // procedure code (Claim.procedure)
export const comorb   = ref('');       // comma-separated condition codes / display names
