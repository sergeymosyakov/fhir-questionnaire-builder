// ── Unified Export Format Registry ───────────────────────────────────────────
// Single source of truth for all export formats (FHIR R4/R4B/R5, REDCap CSV…).
// Formats self-register from js/fhir/formats/*.js at startup.
//
// Format definition shape:
//   id              : string     — unique key ('R4', 'R4B', 'R5', 'redcap')
//   label           : string     — shown in export dropdown
//   isBuilderVersion: boolean    — true → also shown in version selector toolbar
//                                  and drives UI gates (open-choice hidden etc.)
//   metaVersion     : string|null — FHIR version code ('4.0.1' etc); written to
//                                  the builder-target-version extension (null for
//                                  non-FHIR formats)
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
   * Detect the target FHIR version from an imported Questionnaire.
   *
   * Order of precedence:
   *   1. The builder-target-version extension on the Questionnaire (our own
   *      round-trip marker — FHIR's Meta type has no fhirVersion field, so the
   *      target version is carried in an extension instead).
   *   2. Feature-based heuristics: a native `disabledDisplay` or `answerConstraint`
   *      field implies R5 (both were added in R5).
   *   3. Fallback: R4.
   *
   * @param {object} data - parsed FHIR Questionnaire JSON
   * @returns {string} format id ('R4' | 'R4B' | 'R5')
   */
  detectVersion(data) {
    const ext = (data?.extension || []).find(e => e?.url === BUILDER_VERSION_EXTENSION_URL);
    if (ext?.valueCode) {
      for (const def of this._map.values()) {
        if (def.metaVersion && def.metaVersion === ext.valueCode) return def.id;
      }
    }
    if (this._map.has('R5') &&
        (_treeHasField(data?.item, 'disabledDisplay') || _treeHasField(data?.item, 'answerConstraint')))
      return 'R5';
    return 'R4';
  }
}

/** URL of the extension that records the builder's target FHIR version. */
export const BUILDER_VERSION_EXTENSION_URL =
  'https://sergeymosyakov.github.io/fhir-questionnaire-builder/StructureDefinition/builder-target-version';

/**
 * URLs for builder-private extensions that carry R5-only Questionnaire.item
 * fields in an R4/R4B export. The official HL7 cross-version extension URLs
 * (`.../fhir/5.0/StructureDefinition/...`) are rejected by some validators
 * (e.g. public HAPI cannot resolve them), so we use our own canonical URLs.
 * Validators emit at most an informational "unknown extension" warning, the
 * document stays valid, and our importer reads these back for a loss-less
 * downgrade round-trip.
 */
export const ITEM_ANSWER_CONSTRAINT_EXTENSION_URL =
  'https://sergeymosyakov.github.io/fhir-questionnaire-builder/StructureDefinition/item-answerConstraint';
export const ITEM_DISABLED_DISPLAY_EXTENSION_URL =
  'https://sergeymosyakov.github.io/fhir-questionnaire-builder/StructureDefinition/item-disabledDisplay';

/**
 * Set (or replace) the builder-target-version extension on a Questionnaire.
 * @param {object} q    - FHIR Questionnaire object (mutated in place)
 * @param {string} code - FHIR version code, e.g. '4.0.1'
 */
export function setBuilderVersion(q, code) {
  q.extension = (q.extension || []).filter(e => e?.url !== BUILDER_VERSION_EXTENSION_URL);
  q.extension.push({ url: BUILDER_VERSION_EXTENSION_URL, valueCode: code });
  if (q.extension.length === 0) delete q.extension;
}

/** Recursively test whether any item in the tree has the given native field. */
function _treeHasField(items, field) {
  if (!Array.isArray(items)) return false;
  for (const item of items) {
    if (item?.[field] !== undefined) return true;
    if (_treeHasField(item?.item, field)) return true;
  }
  return false;
}

export const formatRegistry = new FormatRegistry();
