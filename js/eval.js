// ── Tree evaluation: visibility and condition rules ───────────────────────────
import { evalRule } from './state.js';

// Marks every node in a subtree as visible-but-disabled.
// Used when a group's conditionRule evaluates to false.
export function markAllDisabled(nodes, results) {
  for (const ch of nodes) {
    results.push({ node: ch, visible: true, ok: true, disabled: true });
    if (ch.type === 'group') markAllDisabled(ch.children, results);
  }
}

// evaluateNode handles external conditions (visibilityRule, conditionRule).
// Form-value checks (calcFormOk) are applied separately in the preview renderer
// so that typing in a control does NOT trigger a full DOM rebuild via effect().
export function evaluateNode(node, ctx, results) {
  const visible = evalRule(node.visibilityRule, ctx);
  if (!visible) {
    // If this node came from FHIR enableWhen, show it dimmed in preview with condition text
    const showDimmed = !!node._enableWhenText;
    results.push({ node, visible: false, ok: !node.mandatory, showDimmed });
    if (showDimmed && node.type === 'group') {
      markAllDisabled(node.children, results);
    }
    return { ok: !node.mandatory, visible: false, showDimmed };
  }

  if (node.type === 'item') {
    const ok = !node.mandatory || evalRule(node.conditionRule, ctx);
    results.push({ node, visible: true, ok });
    return { ok, visible: true };
  }

  // Group: push placeholder FIRST → group heading appears above children in preview
  const entry = { node, visible: true, ok: true };
  results.push(entry);

  // Group's own conditionRule — if false: whole subtree is N/A (disabled, not FAIL)
  if (!evalRule(node.conditionRule, ctx)) {
    entry.disabled = true;
    markAllDisabled(node.children, results);
    return { ok: true, visible: true, disabled: true };
  }

  const visKids = [];
  for (const ch of node.children) {
    const r = evaluateNode(ch, ctx, results);
    if (r.visible) visKids.push(r);
  }

  let groupOk;
  if (visKids.length === 0) {
    groupOk = !node.mandatory;
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
