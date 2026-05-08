// ── FHIRPath calculatedExpression evaluation ──────────────────────────────────
// Evaluates all readOnly calc nodes in the tree and writes results to values[].
export function evalCalcNodes(nodes, qr, fp, values) {
  const env = { resource: qr };
  for (const node of nodes) {
    if (node._calculatedExpr && node._readOnly) {
      try {
        const result = fp.evaluate(qr, node._calculatedExpr, env);
        if (node.itemType === 'checkbox') {
          values[node.id] = result[0] === true || result[0] === 'true';
        } else {
          // String/text calc: store the joined result as a string
          values[node.id] = Array.isArray(result) ? result.join('') : (result[0] !== undefined ? String(result[0]) : '');
        }
      } catch (e) {
        // silently skip nodes whose expression fails
      }
    }
    if (node.type === 'group') evalCalcNodes(node.children, qr, fp, values);
  }
}
