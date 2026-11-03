import { FHIR } from './urls/fhir.js';
import { fhirModel } from './fhir-model.js';
import { isUnsafeKey } from '../utils.js';
// ── SDC Definition-based extraction ──────────────────────────────────────────
// Pure transformation: Questionnaire + QuestionnaireResponse → Bundle of FHIR
// resources constructed from item.definition mappings.
//
// SDC spec: https://hl7.org/fhir/uv/sdc/extraction.html#definition-based-extraction
//
// • Each group annotated with sdc-questionnaire-definitionExtract defines one resource per
//   response instance of the type encoded in item.definition (or child item definitions).
// • Items with item.definition = '...StructureDefinition/{Type}#{path}' map their answers to that element.
//   The element's type and cardinality come from the R4 model, so a coded answer becomes a CodeableConcept /
//   Coding / code as the element requires, and single-valued elements are not turned into lists.
// • A group with a definition is one element (one per response instance); answers nested under answers are used.
// • The extension's own parameters (definition, fullUrl, ifNoneMatch, ifMatch, ifNoneExist, ifModifiedSince)
//   become the Bundle entry; no resource id or profile is invented.
// Not supported: extractAllocateId, definitionExtractValue.

const DEFINITION_EXTRACT_URL =
  FHIR.definitionExtract;

// Older names accepted as the same marker: a name the builder used to write, and the retired SDC item extraction context
const EXTRACT_MARKER_ALIASES = [FHIR.definitionExtractContext, FHIR.itemExtractionContext];

/**
 * Check if a questionnaire item has the definitionExtract extension.
 */
function hasExtractExtension(qItem) {
  return (qItem.extension || []).some(e =>
    e.url === DEFINITION_EXTRACT_URL || EXTRACT_MARKER_ALIASES.includes(e.url)
  );
}

/**
 * Parse a definition URL into { resourceType, path }.
 * Example: 'http://hl7.org/fhir/StructureDefinition/Patient#Patient.name.family'
 *   → { resourceType: 'Patient', path: 'name.family' }
 */
function parseDefinition(definition) {
  if (!definition) return null;
  const hashIdx = definition.indexOf('#');
  if (hashIdx === -1) return null;
  const fragment = definition.slice(hashIdx + 1); // 'Patient.name.family'
  const dotIdx = fragment.indexOf('.');
  if (dotIdx === -1) {
    return { resourceType: fragment, path: '' };
  }
  const resourceType = fragment.slice(0, dotIdx);
  const path         = fragment.slice(dotIdx + 1);  // 'name.family'
  return { resourceType, path };
}

/**
 * Convert a QR answer object to a raw FHIR value.
 */
function answerToValue(answer) {
  for (const k of ['valueString', 'valueInteger', 'valueDecimal', 'valueBoolean', 'valueDate', 'valueDateTime', 'valueTime',
    'valueUri', 'valueCoding', 'valueQuantity', 'valueReference', 'valueAttachment']) {
    if (answer[k] !== undefined) return answer[k];
  }
  return null;
}

const STRING_TYPES = new Set(['string', 'markdown', 'id', 'uri', 'url', 'canonical', 'oid', 'uuid', 'base64Binary']);
const QUANTITY_TYPES = new Set(['Quantity', 'SimpleQuantity', 'Age', 'Count', 'Duration', 'Distance', 'Money']);

/** Shape an answer for an element of the given FHIR type; null when it cannot be represented. */
function convertAnswer(answer, type) {
  const raw = answerToValue(answer);
  if (raw == null) return null;
  const coding = answer.valueCoding;
  if (type === 'CodeableConcept') return coding ? { coding: [coding] } : typeof raw === 'string' ? { text: raw } : null;
  if (type === 'Coding') return coding ?? null;
  if (type === 'code') return coding ? coding.code ?? null : String(raw);
  if (STRING_TYPES.has(type)) return coding ? coding.display ?? coding.code ?? null : typeof raw === 'object' ? null : String(raw);
  if (type === 'boolean') return typeof raw === 'boolean' ? raw : null;
  if (type === 'integer' || type === 'positiveInt' || type === 'unsignedInt') {
    const n = typeof raw === 'object' ? NaN : Number(raw);
    return Number.isInteger(n) ? n : null;
  }
  if (type === 'decimal') { const n = typeof raw === 'object' ? NaN : Number(raw); return Number.isFinite(n) ? n : null; }
  if (QUANTITY_TYPES.has(type)) {
    if (answer.valueQuantity) return answer.valueQuantity;
    const n = typeof raw === 'object' ? NaN : Number(raw);
    return Number.isFinite(n) ? { value: n } : null;
  }
  if (type === 'Reference') return answer.valueReference ?? (typeof raw === 'string' ? { reference: raw } : null);
  if (type === 'Identifier') return typeof raw === 'string' ? { value: raw } : null;
  if (type === 'date' || type === 'dateTime' || type === 'instant' || type === 'time') return typeof raw === 'string' ? raw : null;
  if (type === 'Attachment') return answer.valueAttachment ?? null;
  return raw;
}

const CHOICE_SUFFIX = { valueString: 'String', valueInteger: 'Integer', valueDecimal: 'Decimal', valueBoolean: 'Boolean', valueDate: 'Date',
  valueDateTime: 'DateTime', valueTime: 'Time', valueUri: 'Uri', valueCoding: 'Coding', valueQuantity: 'Quantity', valueReference: 'Reference', valueAttachment: 'Attachment' };

const CHOICE_FALLBACKS = { Coding: ['Coding', 'CodeableConcept'], Date: ['Date', 'DateTime'], Decimal: ['Decimal', 'Quantity'], Integer: ['Integer', 'Quantity'] };
// The suffix of the value[x] name → the datatype used to shape the value
const CHOICE_CONVERT = { String: 'string', Integer: 'integer', Decimal: 'decimal', Boolean: 'boolean', Date: 'date', DateTime: 'dateTime', Time: 'time', Uri: 'uri' };

// Model lookup for `Type.path`: element type, cardinality and allowed value[x] types.
// The model keys backbone elements by their own path and datatype elements by the datatype (HumanName.given).
function meta(ctx, path) {
  const m = ctx.model;
  if (!m) return {};
  const segs = path.split('.');
  let owner = ctx.resourceType;
  for (let i = 0; i < segs.length; i++) {
    const key = `${owner}.${segs[i]}`;
    const type = m.path2Type?.[key];
    if (i === segs.length - 1) return { type, repeating: m.path2Repeating?.[key] === true, choice: m.choiceTypePaths?.[key] };
    if (type === undefined) return {};
    owner = type === 'BackboneElement' || type === 'Element' ? key : type;
  }
  return {};
}
const repeatsAt = (ctx, path) => meta(ctx, path).repeating === true;

/** Walk to the object that holds the last segment, creating parents; arrays on the way use their first element. */
function walkTo(ctx, obj, parentParts, baseParts) {
  let cur = obj;
  for (let i = 0; i < parentParts.length; i++) {
    const key = parentParts[i];
    if (isUnsafeKey(key)) return null;
    if (!Object.hasOwn(cur, key)) cur[key] = repeatsAt(ctx, [...baseParts, ...parentParts.slice(0, i + 1)].join('.')) ? [{}] : {};
    cur = Array.isArray(cur[key]) ? (cur[key][0] ??= {}) : cur[key];
  }
  return cur;
}

/** Resolve a definition path to { obj, key, parentParts, absPath } relative to the current element scope. */
function locate(ctx, path) {
  const base = ctx.base;
  const inScope = base && path.startsWith(base + '.');
  const rel = inScope ? path.slice(base.length + 1) : path;
  const obj = inScope ? ctx.target : ctx.resource;
  const relParts = rel.split('.');
  const baseParts = inScope ? base.split('.') : [];
  const target = walkTo(ctx, obj, relParts.slice(0, -1), baseParts);
  return target ? { target, key: relParts[relParts.length - 1], absPath: path } : null;
}

function putValue(ctx, loc, values, absPath) {
  if (!values.length) return;
  const { target, key } = loc;
  if (isUnsafeKey(key)) return;
  if (repeatsAt(ctx, absPath)) {
    const had = Object.hasOwn(target, key);
    target[key] = [...(had ? (Array.isArray(target[key]) ? target[key] : [target[key]]) : []), ...values];
  } else if (ctx.model || !Object.hasOwn(target, key)) {
    if (values.length > 1) ctx.warnings.push(`${ctx.resourceType}.${absPath} takes a single value; only the first of ${values.length} answers was used.`);
    target[key] = values[0];
  } else {
    // No model available: a repeated value promotes the scalar to a list
    target[key] = [...(Array.isArray(target[key]) ? target[key] : [target[key]]), ...values];
  }
}

function setField(ctx, path, answers) {
  const loc = locate(ctx, path);
  if (!loc) return;
  const noX = path.replace(/\[x\]$/, '');
  const { type, choice } = meta(ctx, noX);
  if (choice) {
    const lastKey = loc.key.replace(/\[x\]$/, '');
    for (const a of answers) {
      const kind = Object.keys(CHOICE_SUFFIX).find(k => a[k] !== undefined);
      const wanted = kind && CHOICE_SUFFIX[kind];
      // A date is a valid dateTime, a decimal a valid Quantity value, a coding a valid CodeableConcept
      const typeName = wanted && (CHOICE_FALLBACKS[wanted] || [wanted]).find(t => choice.includes(t));
      if (!typeName) {
        if (kind) ctx.warnings.push(`${ctx.resourceType}.${noX} does not allow a ${wanted} value; the answer was skipped.`);
        continue;
      }
      const value = convertAnswer(a, CHOICE_CONVERT[typeName] || typeName);
      if (value != null) loc.target[lastKey + typeName] = value;
    }
    return;
  }
  const values = answers.map(a => (type ? convertAnswer(a, type) : answerToValue(a))).filter(v => v != null);
  putValue(ctx, { ...loc, key: loc.key.replace(/\[x\]$/, '') }, values, noX);
}

/** Attach a finished group element (one response instance) at its definition path. */
function attachElement(ctx, path, elem) {
  if (!Object.keys(elem).length) return;
  const loc = locate(ctx, path);
  if (!loc || isUnsafeKey(loc.key)) return;
  const has = Object.hasOwn(loc.target, loc.key);
  if (repeatsAt(ctx, path)) (has ? loc.target[loc.key] : (loc.target[loc.key] = [])).push(elem);
  else {
    if (has) ctx.warnings.push(`${ctx.resourceType}.${path} takes a single element; the answers of several group instances were merged.`);
    loc.target[loc.key] = { ...(has ? loc.target[loc.key] : {}), ...elem };
  }
}

const qrChildren = qrItem => [...(qrItem.item || []), ...(qrItem.answer || []).flatMap(a => a.item || [])];

/** Every response item with this linkId in the scope, at any depth; stops descending at a match. */
function findQrItems(scope, linkId, out = []) {
  for (const it of scope || []) {
    if (it.linkId === linkId) out.push(it);
    else findQrItems(qrChildren(it), linkId, out);
  }
  return out;
}

function processItems(ctx, qItems, scope) {
  for (const qItem of qItems || []) {
    if (hasExtractExtension(qItem)) continue;
    const parsed = qItem.definition ? parseDefinition(qItem.definition) : null;
    const path = parsed && parsed.resourceType === ctx.resourceType && parsed.path ? parsed.path : null;
    const matches = findQrItems(scope, qItem.linkId);
    if (qItem.type === 'group') {
      if (path) {
        for (const inst of matches) {
          const elem = {};
          processItems({ ...ctx, base: path, target: elem }, qItem.item, qrChildren(inst));
          attachElement(ctx, path, elem);
        }
      } else {
        processItems(ctx, qItem.item, matches.length ? matches.flatMap(qrChildren) : scope);
      }
      continue;
    }
    if (path) {
      const answers = matches.flatMap(i => i.answer || []);
      if (answers.length) setField(ctx, path, answers);
    }
    if (qItem.item?.length) processItems(ctx, qItem.item, matches.flatMap(qrChildren));
  }
}

/** Parameters of the definitionExtract extension: { profile, fullUrl, ifNoneMatch, ... } (expressions stay unevaluated). */
function extractParams(qItem) {
  const ext = (qItem.extension || []).find(e => e.url === DEFINITION_EXTRACT_URL);
  const sub = name => (ext?.extension || []).find(e => e.url === name);
  return {
    profile:         sub('definition')?.valueCanonical,
    fullUrl:         sub('fullUrl')?.valueString,
    ifNoneMatch:     sub('ifNoneMatch')?.valueString,
    ifModifiedSince: sub('ifModifiedSince')?.valueString,
    ifMatch:         sub('ifMatch')?.valueString,
    ifNoneExist:     sub('ifNoneExist')?.valueString,
  };
}

const BASE_SD = `${FHIR.sd}/`;
const profileOf = (canonical, resourceType) => (canonical && canonical !== `${BASE_SD}${resourceType}` ? canonical : undefined);

/**
 * Walk Questionnaire items and collect one built resource per extraction-group instance
 * (repeating groups yield one per response instance; extraction groups nested in an instance extract too).
 */
function collectResources(qItems, scope, ctx, parentResourceType = null, out = []) {
  for (const qItem of (qItems || [])) {
    let localType = parentResourceType;
    if (qItem.definition) {
      const parsed = parseDefinition(qItem.definition);
      if (parsed?.resourceType) localType = parsed.resourceType;
    }
    if (!(qItem.type === 'group' && hasExtractExtension(qItem))) {
      collectResources(qItem.item, scope, ctx, localType, out);
      continue;
    }
    const params = extractParams(qItem);
    const profileType = params.profile ? params.profile.split('/').pop().split('|')[0] : null;
    // The group's own definition wins over the type inherited from the enclosing group
    const ownType = qItem.definition ? parseDefinition(qItem.definition)?.resourceType : null;
    const resourceType = ownType || profileType || _inferResourceType(qItem) || parentResourceType;
    if (!resourceType) { collectResources(qItem.item, scope, ctx, localType, out); continue; }
    // Falls back to the whole response when the group linkId is absent (flat / implicit responses)
    const instances = findQrItems(scope, qItem.linkId);
    const scopes = instances.length ? instances : [{ linkId: qItem.linkId, item: scope }];
    for (const inst of scopes) {
      const resource = { resourceType };
      const profile = profileOf(params.profile, resourceType);
      const rctx = { ...ctx, resourceType, resource, target: resource, base: '' };
      processItems(rctx, qItem.item, qrChildren(inst));
      if (Object.keys(resource).length > 1) {
        resource.meta = { ...(profile ? { profile: [profile] } : {}) };
        if (!Object.keys(resource.meta).length) delete resource.meta;
        out.push({ resource, params, context: inst });
      }
      collectResources(qItem.item, qrChildren(inst), ctx, resourceType, out);
    }
  }
  return out;
}

/**
 * Infer resource type from first child item's definition.
 */
function _inferResourceType(groupItem) {
  for (const child of (groupItem.item || [])) {
    if (child.definition) {
      const parsed = parseDefinition(child.definition);
      if (parsed?.resourceType) return parsed.resourceType;
    }
  }
  return null;
}

const defaultEvaluate = (expression, context, qr) =>
  (typeof window !== 'undefined' && window.fhirpath ? window.fhirpath.evaluate(context, { base: 'QuestionnaireResponse.item', expression }, { resource: qr, context }, fhirModel()) : null);

function entryFor({ resource, params, context }, qr, evaluate, warnings) {
  const run = (name, expression) => {
    if (!expression) return undefined;
    try {
      const v = evaluate(expression, context, qr)?.[0];
      return v == null ? undefined : String(v);
    } catch (e) {
      warnings.push(`${name} expression "${expression}" could not be evaluated: ${e.message}`);
      return undefined;
    }
  };
  const request = { method: 'POST', url: resource.resourceType };
  for (const name of ['ifNoneMatch', 'ifModifiedSince', 'ifMatch', 'ifNoneExist']) {
    const v = run(name, params[name]);
    if (v !== undefined) request[name] = v;
  }
  const fullUrl = run('fullUrl', params.fullUrl) ?? `urn:uuid:${globalThis.crypto.randomUUID()}`;
  return { fullUrl, resource, request };
}

/**
 * Main extraction function.
 *
 * @param {object} questJson - FHIR Questionnaire resource
 * @param {object} qr        - FHIR QuestionnaireResponse resource
 * @param {{ model?: object, evaluate?: Function }} [opts] — model: FHIR R4 model (defaults to the loaded one);
 *   evaluate(expression, contextItem, qr) → array, for the extension's fullUrl / if* expressions
 * @returns {{ bundle: object, count: number, warnings: string[] }}
 */
export function definitionExtract(questJson, qr, { model = fhirModel(), evaluate = defaultEvaluate } = {}) {
  const warnings = [];

  if (!qr || qr.resourceType !== 'QuestionnaireResponse') {
    return { bundle: null, count: 0, warnings: ['No QuestionnaireResponse provided.'] };
  }

  const found = collectResources(questJson.item, qr.item || [], { model, warnings });

  if (found.length === 0) {
    warnings.push(
      'No extraction groups found. Add the sdc-questionnaire-definitionExtract ' +
      'extension to a group item and set item.definition on child items.'
    );
    return { bundle: null, count: 0, warnings };
  }

  const bundle = {
    resourceType: 'Bundle',
    type: 'transaction',
    entry: found.map(f => entryFor(f, qr, evaluate, warnings)),
  };

  return { bundle, count: found.length, warnings };
}
