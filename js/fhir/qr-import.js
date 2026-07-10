// Parse and load answers from a FHIR R4 QuestionnaireResponse into the plain values object

// Collect all builder node linkIds recursively from tree
function _collectLinkIds(nodes, set = new Set()) {
  for (const n of nodes) {
    if (n.id) set.add(n.id);
    if (n.children) _collectLinkIds(n.children, set);
  }
  return set;
}

// Flatten QR item[] recursively → { [linkId]: [row0, row1, …] } (repeat rows as array)
function _flattenQR(items, out = {}) {
  for (const item of items || []) {
    if (item.answer && item.answer.length) {
      const extractVal = ans => {
        if (ans.valueBoolean  !== undefined) return ans.valueBoolean;
        if (ans.valueCoding   !== undefined) return ans.valueCoding.code;
        if (ans.valueDecimal  !== undefined) return ans.valueDecimal;
        if (ans.valueInteger  !== undefined) return ans.valueInteger;
        if (ans.valueDate      !== undefined) return ans.valueDate;
        if (ans.valueDateTime  !== undefined) return ans.valueDateTime;
        if (ans.valueTime      !== undefined) return ans.valueTime;
        if (ans.valueQuantity  !== undefined) return { value: ans.valueQuantity.value, unit: ans.valueQuantity.unit || '' };
        if (ans.valueUri       !== undefined) return ans.valueUri;
        if (ans.valueReference !== undefined) return { reference: ans.valueReference.reference || '' };
        if (ans.valueString    !== undefined) return ans.valueString;
        return undefined;
      };
      out[item.linkId] = item.answer.map(extractVal).filter(v => v !== undefined);
      if (out[item.linkId].length === 0) delete out[item.linkId];
      // Nested items inside answers (non-group questions with sub-items)
      for (const ans of item.answer) {
        if (ans.item) _flattenQR(ans.item, out);
      }
    }
    // Group children
    if (item.item) _flattenQR(item.item, out);
  }
  return out;
}

// Collect checklist node linkIds from tree
function _collectChecklistIds(nodes, set = new Set()) {
  for (const n of nodes) {
    if (n.itemType === 'checklist') set.add(n.id);
    if (n.children) _collectChecklistIds(n.children, set);
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
  const extracted = _flattenQR(qrJson.item || []);
  const unmatched = [];
  let loaded = 0;

  for (const [linkId, arr] of Object.entries(extracted)) {
    if (knownIds.has(linkId)) {
      values[linkId] = arr;
      loaded++;
    } else {
      unmatched.push(linkId);
    }
  }

  // Merge multi-answer QR entries for checklist items into a single comma-separated row
  const checklistIds = _collectChecklistIds(tree);
  for (const id of checklistIds) {
    const arr = values[id];
    if (Array.isArray(arr) && arr.length > 1) {
      values[id] = [arr.filter(v => v !== undefined).join(',')];
    }
  }

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
