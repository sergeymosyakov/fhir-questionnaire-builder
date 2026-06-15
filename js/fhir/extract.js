// ── SDC Observation-based extraction ─────────────────────────────────────────
// Pure FHIR transformation: completed QuestionnaireResponse + source Questionnaire
// → a `transaction` Bundle of Observation resources.
// No DOM, no state imports — fully unit-testable.
//
// Implements the Observation-based extraction mechanism from the SDC IG:
//   https://hl7.org/fhir/uv/sdc/extraction.html#observation-based-extraction
//
// Scope & deliberate decisions for ambiguous areas of the spec (MVP):
//   • The observationExtract flag is inherited top-down. An item/code without its
//     own value inherits the nearest ancestor's value. An explicit `false` on a
//     descendant suppresses an inherited `true`. Codes have no descendants, so a
//     flag on item.code does not propagate further.
//   • Only leaf question items that have an `item.code` AND an answer value are
//     extracted; each produces one Observation (status = 'final').
//   • A group carrying only a boolean flag is treated as a container: the spec
//     states the parent↔child relationship (component vs hasMember) is "undefined"
//     when the flag value is only a boolean. To stay safe we do NOT invent a
//     value-less parent Observation nor component[]/hasMember links — each coded
//     leaf below the group becomes an independent Observation. The code-valued
//     form of the flag (which would convey component/hasMember) is treated as
//     "extraction enabled" but its relationship semantics are not yet applied.
//   • Each answer of a multi-answer item becomes a separate Observation.
//   • Skipped/cleared answers and items without a code produce nothing.

const OBSERVATION_EXTRACT_URL =
  'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-observationExtract';
const UNIT_URL = 'http://hl7.org/fhir/StructureDefinition/questionnaire-unit';

/**
 * Resolve the effective observationExtract flag declared directly on a node.
 * @returns {boolean|undefined} true/false when declared, undefined when absent.
 */
function ownFlag(node) {
  const ext = (node.extension || []).find(e => e.url === OBSERVATION_EXTRACT_URL);
  if (!ext) return undefined;
  if (typeof ext.valueBoolean === 'boolean') return ext.valueBoolean;
  // Code-valued flag conveys a component/hasMember relationship (not applied in
  // this MVP) — its presence still means extraction is enabled for the item.
  return true;
}

/** questionnaire-unit valueCoding for an item, or null. */
function unitOf(qItem) {
  const ext = (qItem.extension || []).find(e => e.url === UNIT_URL);
  return ext?.valueCoding || null;
}

function makeQuantity(value, unit) {
  const q = { value };
  if (unit.display || unit.code) q.unit = unit.display || unit.code;
  if (unit.system) q.system = unit.system;
  if (unit.code)   q.code   = unit.code;
  return q;
}

/**
 * Map a single QR answer object to an Observation.value[x] property.
 * @returns {object|null} e.g. { valueInteger: 5 } or null when no usable value.
 */
function answerToValue(answer, qItem) {
  const unit = unitOf(qItem);
  if (answer.valueInteger !== undefined)
    return unit ? { valueQuantity: makeQuantity(answer.valueInteger, unit) } : { valueInteger: answer.valueInteger };
  if (answer.valueDecimal !== undefined)
    return unit ? { valueQuantity: makeQuantity(answer.valueDecimal, unit) } : { valueDecimal: answer.valueDecimal };
  if (answer.valueQuantity !== undefined) return { valueQuantity: answer.valueQuantity };
  if (answer.valueBoolean  !== undefined) return { valueBoolean: answer.valueBoolean };
  if (answer.valueString   !== undefined) return { valueString: answer.valueString };
  if (answer.valueDate     !== undefined) return { valueDateTime: answer.valueDate };
  if (answer.valueDateTime !== undefined) return { valueDateTime: answer.valueDateTime };
  if (answer.valueTime     !== undefined) return { valueTime: answer.valueTime };
  if (answer.valueUri      !== undefined) return { valueString: answer.valueUri };
  if (answer.valueCoding   !== undefined) {
    const c = answer.valueCoding;
    const coding = {};
    if (c.system)  coding.system  = c.system;
    if (c.code)    coding.code    = c.code;
    if (c.display) coding.display = c.display;
    return { valueCodeableConcept: { coding: [coding] } };
  }
  return null;
}

/** Build a flat Map<linkId, qrItem> from a QuestionnaireResponse tree. */
function indexQR(qr) {
  const map = new Map();
  const walk = (items) => {
    for (const it of items || []) {
      if (it.linkId) map.set(it.linkId, it);
      if (it.item) walk(it.item);
      for (const a of it.answer || []) {
        if (a.item) walk(a.item);
      }
    }
  };
  walk(qr.item);
  return map;
}

/** A Reference to the source QuestionnaireResponse for Observation.derivedFrom. */
function qrReference(qr) {
  if (qr.id) return { reference: 'QuestionnaireResponse/' + qr.id };
  return { display: 'Source QuestionnaireResponse' };
}

function buildObservation(qItem, valueProp, qr, obsProfile) {
  const obs = {
    resourceType: 'Observation',
    ...(obsProfile?.length ? { meta: { profile: obsProfile } } : {}),
    status: 'final',
    code: {
      coding: (qItem.code || []).map(c => {
        const coding = {};
        if (c.system)  coding.system  = c.system;
        if (c.code)    coding.code    = c.code;
        if (c.display) coding.display = c.display;
        return coding;
      }),
    },
  };
  if (qr.basedOn) obs.basedOn = qr.basedOn;
  if (qr.partOf)  obs.partOf  = qr.partOf;
  if (qr.subject)   obs.subject   = qr.subject;
  if (qr.encounter) obs.encounter = qr.encounter;
  if (qr.authored) {
    obs.effectiveDateTime = qr.authored;
    obs.issued            = qr.authored;
  }
  if (qr.author) obs.performer = [qr.author];
  Object.assign(obs, valueProp);
  obs.derivedFrom = [qrReference(qr)];
  return obs;
}

function newFullUrl() {
  const uuid =
    (typeof globalThis !== 'undefined' && globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function')
      ? globalThis.crypto.randomUUID()
      : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
          const r = (Math.random() * 16) | 0;
          const v = ch === 'x' ? r : (r & 0x3) | 0x8;
          return v.toString(16);
        });
  return 'urn:uuid:' + uuid;
}

/**
 * Extract Observation resources from a completed QuestionnaireResponse.
 * @param {object} qr            - QuestionnaireResponse resource.
 * @param {object} questionnaire - source Questionnaire resource.
 * @param {{ obsProfile?: string[] }} [options] - optional extraction options.
 * @returns {object} a FHIR `transaction` Bundle of Observation entries.
 */
export function extractObservations(qr, questionnaire, options = {}) {
  const obsProfile = options.obsProfile || [];
  const observations = [];
  if (qr && questionnaire) {
    const qrMap = indexQR(qr);
    const rootFlag = ownFlag(questionnaire);

    const walk = (items, inherited) => {
      for (const qItem of items || []) {
        const own = ownFlag(qItem);
        const effective = own === undefined ? inherited : own;
        const qrItem = qrMap.get(qItem.linkId);
        const isLeafQuestion = qItem.type !== 'group' && qItem.type !== 'display';

        if (effective === true && isLeafQuestion && qItem.code?.length && qrItem) {
          for (const ans of qrItem.answer || []) {
            const valueProp = answerToValue(ans, qItem);
            if (valueProp) observations.push(buildObservation(qItem, valueProp, qr, obsProfile));
          }
        }
        walk(qItem.item, effective);
      }
    };

    walk(questionnaire.item, rootFlag);
  }

  return {
    resourceType: 'Bundle',
    type: 'transaction',
    entry: observations.map(obs => ({
      fullUrl: newFullUrl(),
      resource: obs,
      request: { method: 'POST', url: 'Observation' },
    })),
  };
}
