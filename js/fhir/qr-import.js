// Parse and load answers from a FHIR R4 QuestionnaireResponse into the plain values object

// Collect all builder node linkIds recursively from tree
function _collectLinkIds(nodes, set = new Set()) {
  for (const n of nodes) {
    if (n.id) set.add(n.id);
    if (n.children) _collectLinkIds(n.children, set);
  }
  return set;
}

// Flatten QR item[] recursively → { [linkId]: primitiveValue }
function _flattenQR(items, out = {}) {
  for (const item of items || []) {
    if (item.answer && item.answer.length) {
      const ans = item.answer[0];
      if      (ans.valueBoolean  !== undefined) out[item.linkId] = ans.valueBoolean;
      else if (ans.valueCoding   !== undefined) out[item.linkId] = ans.valueCoding.code;
      else if (ans.valueDecimal  !== undefined) out[item.linkId] = ans.valueDecimal;
      else if (ans.valueInteger  !== undefined) out[item.linkId] = ans.valueInteger;
      else if (ans.valueDate     !== undefined) out[item.linkId] = ans.valueDate;
      else if (ans.valueDateTime !== undefined) out[item.linkId] = ans.valueDateTime;
      else if (ans.valueString   !== undefined) out[item.linkId] = ans.valueString;
      // Nested items inside answer (non-group questions with sub-items)
      if (ans.item) _flattenQR(ans.item, out);
    }
    // Group children
    if (item.item) _flattenQR(item.item, out);
  }
  return out;
}

/**
 * Load QR answers into the plain `values` object.
 * Only loads answers for linkIds that exist in the current questionnaire tree.
 * @param {object} qrJson - Parsed QuestionnaireResponse JSON
 * @param {object} values - Plain values store (modified in-place)
 * @param {Array}  tree   - Current builder tree (reactive array is fine)
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

  for (const [id, val] of Object.entries(extracted)) {
    if (knownIds.has(id)) {
      values[id] = val;
      loaded++;
    } else {
      unmatched.push(id);
    }
  }

  return { ok: true, loaded, unmatched, questionnaire: qrJson.questionnaire || '' };
}
