// Browser stub for cql-exec-fhir's load.js `require('fs')` — never actually invoked
// (we always pass load() literal XML text, never a file path; see js/fhir/cql-engine.js).
module.exports = {
  readFileSync() {
    throw new Error('fs.readFileSync is not available in the browser build of cql-exec-fhir');
  },
};
