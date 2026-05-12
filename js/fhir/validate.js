// ── FHIR Questionnaire tree validator ─────────────────────────────────────────
// Pure function — no DOM, no side effects.
// Returns an array of { severity: 'error'|'warning', nodeId, message }.

function _collectNodes(nodes, out = []) {
  for (const n of nodes) {
    out.push(n);
    if (n.type === 'group' && n.children) _collectNodes(n.children, out);
  }
  return out;
}

// Attempt to compile a JS rule expression. Returns error message or null.
function _checkJsExpr(rule) {
  if (!rule || !rule.trim()) return null;
  try {
    new Function('age','gender','bmi','pregnant','smoker','proc','comorb','values',
      'return (' + rule + ');');
    return null;
  } catch (e) {
    return e.message;
  }
}

// Attempt to parse a FHIRPath expression (syntax check only). Returns error message or null.
function _checkFhirPath(expr) {
  if (!expr || !expr.trim()) return null;
  const fp = window.fhirpath;
  if (!fp || typeof fp.compile !== 'function') return null;
  try {
    fp.compile(expr);
    return null;
  } catch (e) {
    return e.message;
  }
}

export function validateTree(tree) {
  const issues = [];
  const all    = _collectNodes(tree);
  const allIds = all.map(n => n.id);

  // Pre-compute duplicate IDs
  const idCount = {};
  for (const id of allIds) idCount[id] = (idCount[id] || 0) + 1;
  const dupIds = new Set(Object.keys(idCount).filter(k => idCount[k] > 1));

  for (const node of all) {
    const id = node.id;

    // ── Errors ────────────────────────────────────────────────────────────────
    if (!id || !id.trim()) {
      issues.push({ severity: 'error', nodeId: '(empty)', message: 'Node has an empty linkId — linkId is required in FHIR R4.' });
    } else if (dupIds.has(id)) {
      issues.push({ severity: 'error', nodeId: id, message: `Duplicate linkId "${id}" — linkIds must be unique within a Questionnaire.` });
    }

    // JS expression errors
    const visErr  = _checkJsExpr(node.visibilityRule);
    const condErr = _checkJsExpr(node.conditionRule);
    if (visErr)  issues.push({ severity: 'error', nodeId: id, message: `Visibility rule syntax error: ${visErr}` });
    if (condErr) issues.push({ severity: 'error', nodeId: id, message: `Applicability rule syntax error: ${condErr}` });

    // FHIRPath expression errors
    const fhirPathErr = _checkFhirPath(node._calculatedExpr);
    if (fhirPathErr) issues.push({ severity: 'error', nodeId: id, message: `Calculated expression error: ${fhirPathErr}` });

    // ── Warnings ──────────────────────────────────────────────────────────────
    if (!node.title || !node.title.trim()) {
      issues.push({ severity: 'warning', nodeId: id || '(empty)', message: 'Empty item text (title) — FHIR R4 requires text on every item.' });
    }

    if (node.type === 'item' &&
        (node.itemType === 'select' || node.itemType === 'radio' || node.itemType === 'open-choice') &&
        (!node.options || !node.options.trim())) {
      issues.push({ severity: 'warning', nodeId: id, message: `Item type "${node.itemType}" has no answer options — answerOption will be empty in the export.` });
    }

    // visibilityRule references unknown linkId
    if (node.visibilityRule) {
      for (const m of node.visibilityRule.matchAll(/values\['([^']+)'\]/g)) {
        if (!allIds.includes(m[1])) {
          issues.push({ severity: 'warning', nodeId: id, message: `Visibility rule references unknown linkId "${m[1]}".` });
        }
      }
    }
  }

  return issues;
}
