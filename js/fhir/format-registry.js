// ── Unified Export Format Registry ───────────────────────────────────────────
// Single source of truth for all export formats (FHIR R4/R4B/R5, REDCap CSV…).
// Formats self-register from js/fhir/formats/*.js at startup.
//
// Format definition shape:
//   id              : string     — unique key ('R4', 'R4B', 'R5', 'redcap')
//   label           : string     — shown in export dropdown
//   isBuilderVersion: boolean    — true → also shown in version selector toolbar
//                                  and drives UI gates (open-choice hidden etc.)
//   metaVersion     : string|null — FHIR meta.fhirVersion value (null for non-FHIR)
//   ext             : string     — file extension ('json' | 'csv')
//   mimeType        : string     — MIME type for download blob
//   build(baseQ)    : function   — transforms base FHIR object; returns JSON
//                                  object (FHIR formats) or string (CSV formats)
//   reportTitle     : string?    — validation modal title (default provided)
//   onBeforeReport(): void?      — called before validation modal opens
//   onAfterExport() : void?      — called after successful download
//   onCancel()      : void?      — called if user dismisses without exporting

class FormatRegistry {
  /** @type {Map<string, object>} */
  _map = new Map();

  /** @param {object} def - format definition (see shape above) */
  register(def) {
    this._map.set(def.id, def);
  }

  /** @returns {object|undefined} */
  get(id) { return this._map.get(id); }

  /** All registered formats in insertion order. */
  getAll() { return [...this._map.values()]; }

  /** Only formats where isBuilderVersion === true (for version selector). */
  getBuilderVersions() { return this.getAll().filter(f => f.isBuilderVersion); }

  /**
   * Detect a version id from a FHIR meta.fhirVersion string.
   * Only checks formats with metaVersion set.
   * @param {string} metaFhirVersion - e.g. '4.0.1'
   * @returns {string|null} format id, or null if not recognised
   */
  detectFromMeta(metaFhirVersion) {
    if (!metaFhirVersion) return null;
    // Exact match first
    for (const def of this._map.values()) {
      if (def.metaVersion && def.metaVersion === metaFhirVersion) return def.id;
    }
    // Coarse prefix fallback
    if (metaFhirVersion.startsWith('5.'))   return this._map.has('R5')  ? 'R5'  : null;
    if (metaFhirVersion.startsWith('4.3.')) return this._map.has('R4B') ? 'R4B' : null;
    if (metaFhirVersion.startsWith('4.0.')) return this._map.has('R4')  ? 'R4'  : null;
    return null;
  }
}

export const formatRegistry = new FormatRegistry();
