// ── Tree evaluation: enableWhen visibility ───────────────────────────────────────
// ctx: { fp, qr, envVars } — fhirpath + QuestionnaireResponse + variable env
// (optional; needed only for enableWhenExpression FHIRPath evaluation)
import { getAllValues } from './state.js';

// Marks every node in a subtree as visible-but-disabled.
export function markAllDisabled(nodes, results) {
  for (const ch of nodes) {
    results.push({ node: ch, visible: true, ok: true, disabled: true });
    if (ch.type === 'group') markAllDisabled(ch.children, results);
  }
}

// Compare a single value against one enableWhen condition.
function compareValue(val, ew) {
  if (ew.operator === 'exists') {
    const hasVal = val !== undefined && val !== null && val !== '';
    return ew.answerBoolean !== false ? hasVal : !hasVal;
  }
  let answer;
  if      (ew.answerBoolean  !== undefined) answer = ew.answerBoolean;
  else if (ew.answerString   !== undefined) answer = ew.answerString;
  else if (ew.answerInteger  !== undefined) answer = ew.answerInteger;
  else if (ew.answerDecimal  !== undefined) answer = ew.answerDecimal;
  else if (ew.answerCoding)                 answer = ew.answerCoding.code || ew.answerCoding.display || '';
  else return false;
  // Coerce for consistent comparison (user values may be booleans or strings)
  const coerced = String(answer);
  const current = val !== undefined && val !== null ? String(val) : '';
  switch (ew.operator) {
    case '=':  return current === coerced;
    case '!=': return current !== coerced;
    case '>':  return Number(current) > Number(coerced);
    case '<':  return Number(current) < Number(coerced);
    case '>=': return Number(current) >= Number(coerced);
    case '<=': return Number(current) <= Number(coerced);
  }
  return false;
}

// Evaluate one enableWhen condition against current form values.
// For repeating items: condition is met if ANY answer satisfies it (FHIR R4 spec).
function checkOneEnableWhen(ew) {
  const all = getAllValues(ew.question);
  if (all.length === 0) return compareValue(undefined, ew);
  return all.some(v => compareValue(v, ew));
}

// Evaluate node visibility:
// 1. enableWhen[] (standard R4) — check against values[]
// 2. enableWhenExpression (SDC) — evaluate via FHIRPath
// 3. Neither present → always visible
function isNodeVisible(node, ctx) {
  if (node.enableWhen && node.enableWhen.length) {
    const checks = node.enableWhen.map(checkOneEnableWhen);
    return node.enableBehavior === 'any' ? checks.some(Boolean) : checks.every(Boolean);
  }
  if (node.enableWhenExpression && ctx && ctx.fp && ctx.qr) {
    try {
      const result = ctx.fp.evaluate(ctx.qr, node.enableWhenExpression, ctx.envVars || {});
      return result[0] === true;
    } catch { return false; }
  }
  return true;
}

// evaluateNode handles external conditions (enableWhen / enableWhenExpression).
// Form-value checks (calcFormOk) are applied separately in the preview renderer
// so that typing in a control does NOT trigger a full DOM rebuild via effect().
// _insideHidden: true when a parent node carries sdc-questionnaire-hidden=true
export function evaluateNode(node, ctx, results, _insideHidden = false) {
  // sdc-questionnaire-hidden: node (and all its descendants) are marked hidden.
  // calculatedExpression still runs; they are excluded from PASS/FAIL validation.
  if (node._hidden || _insideHidden) {
    const isRoot = !!node._hidden && !_insideHidden;
    const entry = { node, visible: true, ok: true, hidden: true, hiddenRoot: isRoot };
    results.push(entry);
    if (node.type === 'group') {
      for (const ch of node.children) evaluateNode(ch, ctx, results, true);
    }
    return { ok: true, visible: true, hidden: true };
  }

  const visible = isNodeVisible(node, ctx);
  if (!visible) {
    const showDimmed = !!(node.enableWhen && node.enableWhen.length) || !!node.enableWhenExpression;
    results.push({ node, visible: false, ok: node.mandatory === false, showDimmed });
    if (showDimmed && node.type === 'group') {
      markAllDisabled(node.children, results);
    }
    return { ok: node.mandatory === false, visible: false, showDimmed };
  }

  if (node.type === 'item') {
    results.push({ node, visible: true, ok: true });
    return { ok: true, visible: true };
  }

  // Group: push placeholder FIRST → group heading appears above children in preview
  const entry = { node, visible: true, ok: true };
  results.push(entry);

  const visKids = [];
  for (const ch of node.children) {
    const r = evaluateNode(ch, ctx, results);
    if (r.visible) visKids.push(r);
  }

  let groupOk;
  if (visKids.length === 0) {
    groupOk = node.mandatory === false;
  } else {
    groupOk = visKids[0].ok;
    for (let i = 1; i < visKids.length; i++) {
      groupOk = node.logicWithParent === 'AND'
        ? groupOk && visKids[i].ok
        : groupOk || visKids[i].ok;
    }
  }
  entry.ok = groupOk;
  return { ok: groupOk, visible: true };
}
