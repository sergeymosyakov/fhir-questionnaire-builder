// ── FHIRPath calculatedExpression evaluation ──────────────────────────────────
// Evaluates all readOnly calc nodes in the tree and writes results to values[].

// Pre-compute questionnaire-level SDC variables into an environment object.
// Variables are evaluated in order; later ones may reference earlier ones via %name.
export function buildVarEnv(variables, qr, fp) {
  const env = {};
  for (const v of variables) {
    if (!v.name || !v.expression) continue;
    try {
      const result = fp.evaluate(qr, v.expression, { resource: qr, ...env });
      env[v.name] = Array.isArray(result) && result.length === 1 ? result[0] : result;
    } catch (_e) { /* skip variables whose expression fails */ }
  }
  return env;
}

export function evalCalcNodes(nodes, qr, fp, values, envVars = {}) {
  const env = { resource: qr, ...envVars };
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
      } catch (_e) {
        // silently skip nodes whose expression fails
      }
    }
    if (node.type === 'group') evalCalcNodes(node.children, qr, fp, values, envVars);
  }
}

// Evaluate sdc-questionnaire-initialExpression on all nodes and write to values[].
// Called once on form load and on manual re-init (↺ button in Variables panel).
export function evalInitialExprNodes(nodes, qr, fp, values, envVars = {}) {
  const env = { resource: qr, ...envVars };
  for (const node of nodes) {
    if (node._initialExpr) {
      try {
        const result = fp.evaluate(qr, node._initialExpr, env);
        if (node.itemType === 'checkbox') {
          values[node.id] = result[0] === true || result[0] === 'true';
        } else {
          values[node.id] = Array.isArray(result) ? result.join('') : (result[0] !== undefined ? String(result[0]) : '');
        }
      } catch (_e) {
        // silently skip nodes whose expression fails
      }
    }
    if (node.type === 'group') evalInitialExprNodes(node.children, qr, fp, values, envVars);
  }
}
