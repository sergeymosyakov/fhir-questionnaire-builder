// Parse and load answers from a FHIR R4 QuestionnaireResponse into the plain values object
import { joinCodes } from './checklist-codec.js';

// Collect all builder node linkIds recursively from tree
function _collectLinkIds(nodes, set = new Set()) {
  for (const n of nodes) {
    if (n.id) set.add(n.id);
    if (n.children) _collectLinkIds(n.children, set);
  }
  return set;
}

// Flatten QR item[] recursively → { [linkId]: [row0, row1, …] } (repeat rows as array).
// A repeating group instead maps to one answer map per QR item occurrence, as the store expects.
// Containers are null-prototype so linkIds like 'constructor' or '__proto__' are plain keys.
function _flattenQR(items, out = Object.create(null), repeatGroups = new Set()) {
  for (const item of items || []) {
    if (item.linkId === '__proto__') continue;
    if (repeatGroups.has(item.linkId)) {
      (out[item.linkId] ||= []).push(_flattenQR(item.item, Object.create(null), repeatGroups));
      continue;
    }
    if (item.answer && item.answer.length) {
      const extractVal = ans => {
        if (ans.valueBoolean  !== undefined) return ans.valueBoolean;
        if (ans.valueCoding   !== undefined) return ans.valueCoding.code;
        if (ans.valueDecimal  !== undefined) return ans.valueDecimal;
        if (ans.valueInteger  !== undefined) return ans.valueInteger;
        if (ans.valueDate      !== undefined) return ans.valueDate;
        if (ans.valueDateTime  !== undefined) return ans.valueDateTime;
        if (ans.valueTime      !== undefined) return ans.valueTime;
        if (ans.valueQuantity  !== undefined) return {
          value: ans.valueQuantity.value, unit: ans.valueQuantity.unit || '',
          ...(ans.valueQuantity.system ? { system: ans.valueQuantity.system } : {}),
          ...(ans.valueQuantity.code   ? { code:   ans.valueQuantity.code }   : {}),
        };
        if (ans.valueUri       !== undefined) return ans.valueUri;
        if (ans.valueReference !== undefined) return {
          reference: ans.valueReference.reference || '',
          ...(ans.valueReference.display ? { display: ans.valueReference.display } : {}),
        };
        // The store keeps the file-chip fields plus the original Attachment so export can restore it verbatim
        if (ans.valueAttachment !== undefined) return {
          name: ans.valueAttachment.title || ans.valueAttachment.url || '',
          type: ans.valueAttachment.contentType || '',
          size: ans.valueAttachment.size,
          attachment: JSON.parse(JSON.stringify(ans.valueAttachment)),
        };
        if (ans.valueString    !== undefined) return ans.valueString;
        return undefined;
      };
      out[item.linkId] = item.answer.map(extractVal).filter(v => v !== undefined);
      if (out[item.linkId].length === 0) delete out[item.linkId];
      // Nested items inside answers (non-group questions with sub-items)
      for (const ans of item.answer) {
        if (ans.item) _flattenQR(ans.item, out, repeatGroups);
      }
    }
    // Group children
    if (item.item) _flattenQR(item.item, out, repeatGroups);
  }
  return out;
}

// Collect repeating group linkIds from tree
function _collectRepeatGroupIds(nodes, set = new Set()) {
  for (const n of nodes) {
    if (n.type === 'group' && n.repeats && n.id) set.add(n.id);
    if (n.children) _collectRepeatGroupIds(n.children, set);
  }
  return set;
}

/**
 * Load QR answers into the plain `values` object.
 * Only loads answers for linkIds that exist in the current questionnaire tree.
 * @param {object} qrJson - Parsed QuestionnaireResponse JSON
 * @param {object} values - Plain values store (modified in-place)
 * @param {Array}  tree   - Current builder tree array
 * @returns {{ ok: boolean, error?: string, loaded: number, unmatched: string[], questionnaire: string }}
 */
export function importQRAnswers(qrJson, values, tree) {
  if (!qrJson || qrJson.resourceType !== 'QuestionnaireResponse') {
    const rt = qrJson?.resourceType ?? 'unknown';
    return { ok: false, error: 'Not a QuestionnaireResponse (resourceType: ' + rt + ')' };
  }

  const knownIds  = _collectLinkIds(tree);
  const extracted = _flattenQR(qrJson.item || [], undefined, _collectRepeatGroupIds(tree));
  const unmatched = [];
  let loaded = 0;

  for (const [linkId, arr] of Object.entries(extracted)) {
    if (knownIds.has(linkId) && linkId !== '__proto__') {
      values[linkId] = arr;
      loaded++;
    } else {
      unmatched.push(linkId);
    }
  }

  // Merge multi-answer QR entries for checklist items into a single encoded row (also inside repeating-group instances)
  const mergeChecklists = (nodes, scope) => {
    for (const n of nodes) {
      if (n.itemType === 'checklist') {
        const arr = Object.hasOwn(scope, n.id) ? scope[n.id] : undefined;
        if (Array.isArray(arr) && (arr.length > 1 || (arr.length === 1 && typeof arr[0] === 'string'))) {
          scope[n.id] = [joinCodes(arr.filter(v => v !== undefined))];
        }
      }
      if (!n.children?.length) continue;
      if (n.type === 'group' && n.repeats) {
        const rows = Object.hasOwn(scope, n.id) ? scope[n.id] : undefined;
        if (Array.isArray(rows)) for (const row of rows) if (row && typeof row === 'object') mergeChecklists(n.children, row);
      } else mergeChecklists(n.children, scope);
    }
  };
  mergeChecklists(tree, values);

  return { ok: true, loaded, unmatched, questionnaire: qrJson.questionnaire || '',
    meta: {
      status:           qrJson.status  || 'in-progress',
      subject:          qrJson.subject?.reference || '',
      author:           qrJson.author?.reference  || '',
      id:               qrJson.id || '',
      language:         qrJson.language || '',
      metaVersionId:    qrJson.meta?.versionId || '',
      metaSource:       qrJson.meta?.source    || '',
      metaProfile:      (qrJson.meta?.profile  || []).slice(),
      metaTag:          (qrJson.meta?.tag       || []).map(c => ({ ...c })),
      metaSecurity:     (qrJson.meta?.security  || []).map(c => ({ ...c })),
    },
  };
}
