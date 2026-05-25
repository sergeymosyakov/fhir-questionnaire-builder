// Parse and load answers from a FHIR R4 QuestionnaireResponse into the plain values object

// Collect all builder node linkIds recursively from tree
function _collectLinkIds(nodes, set = new Set()) {
  for (const n of nodes) {
    if (n.id) set.add(n.id);
    if (n.children) _collectLinkIds(n.children, set);
  }
  return set;
}

// Flatten QR item[] recursively → { [linkId]: primaryValue, [linkId+'$$N']: extraValue, [linkId+'$$n']: count }
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
      out[item.linkId] = extractVal(item.answer[0]);
      if (item.answer.length > 1) {
        for (let i = 1; i < item.answer.length; i++) {
          const v = extractVal(item.answer[i]);
          if (v !== undefined) out[item.linkId + '$$' + i] = v;
        }
        out[item.linkId + '$$n'] = item.answer.length - 1;
      }
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

  for (const [key, val] of Object.entries(extracted)) {
    // Repeat meta-keys: id$$n and id$$N — load if base id is known
    const repeatMatch = key.match(/^(.+)\$\$(\d+|n)$/);
    if (repeatMatch && knownIds.has(repeatMatch[1])) {
      values[key] = val;
      continue;
    }
    if (knownIds.has(key)) {
      values[key] = val;
      loaded++;
    } else {
      unmatched.push(key);
    }
  }

  return { ok: true, loaded, unmatched, questionnaire: qrJson.questionnaire || '',
    meta: {
      status:  qrJson.status  || 'in-progress',
      subject: qrJson.subject?.reference || '',
      author:  qrJson.author?.reference  || '',
    },
  };
}
