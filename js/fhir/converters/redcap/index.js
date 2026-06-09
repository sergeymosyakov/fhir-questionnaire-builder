// ── REDCap converter — entry point & self-registration ───────────────────────
//
// Import this module as a side-effect to register the REDCap converter
// and its compatibility validator.
//
// Usage in app.js:
//   import './fhir/converters/redcap/index.js';
//
// Public API re-exports:
//   toFHIR(rows, opts)   — rows[] → FHIR Questionnaire JSON
//   fromFHIR(questJson)  — FHIR Questionnaire JSON → CSV string
//   parseCSV(text)       — CSV text → rows[]
//   validateCSV(rows)    — rows[] → Issue[]
//   redcapCompatValidator — the registered Validator instance
//                           (set .enabled = true before running validateModal)

export { toFHIR }         from './to-fhir.js';
export { fromFHIR }       from './from-fhir.js';
export { parseCSV }       from './parse-csv.js';
export { validateCSV }    from './validate.js';

import { validatorRegistry }   from '../../validators/registry.js';
import { REDCapCompatValidator } from '../../validators/redcap-compat.js';

export const redcapCompatValidator = new REDCapCompatValidator();
validatorRegistry.register(redcapCompatValidator);
