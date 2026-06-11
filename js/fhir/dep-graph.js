// ── Dependency graph for inter-item logic ─────────────────────────────────────
// Builds a directed graph of dependencies between questionnaire items so that
// calculated/initial expressions can be evaluated in topological order and
// circular dependencies can be detected and surfaced as validation errors.
//
// Pure module — no DOM, no state imports. Edge direction: A → B means
// "A depends on B" (B must be evaluated before A).

// Extract item linkId and variable references from a FHIRPath expression string.
// Matches: linkId = 'X' / linkId = "X" / linkId='X' (single or double quotes),
// and %varName environment-variable references.
export function extractRefs(expr) {
  const linkIds = new Set();
  const vars = new Set();
  if (!expr || typeof expr !== 'string') {
    return { linkIds: [], vars: [] };
  }
  // linkId = 'value' — tolerant of surrounding whitespace and quote style
  const linkIdRe = /linkId\s*=\s*(['"])(.*?)\1/g;
  let m;
  while ((m = linkIdRe.exec(expr)) !== null) {
    if (m[2]) linkIds.add(m[2]);
  }
  // %variableName — FHIRPath environment variables (and %`quoted name`)
  const varRe = /%(`[^`]+`|[A-Za-z_][A-Za-z0-9_]*)/g;
  while ((m = varRe.exec(expr)) !== null) {
    let name = m[1];
    if (name.startsWith('`') && name.endsWith('`')) name = name.slice(1, -1);
    // %resource / %context are FHIRPath built-ins, not user variables
    if (name !== 'resource' && name !== 'context') vars.add(name);
  }
  return { linkIds: [...linkIds], vars: [...vars] };
}

// Walk the node tree (groups + items) into a flat array.
function flatten(nodes, out = []) {
  for (const node of nodes) {
    out.push(node);
    if (node.type === 'group' && Array.isArray(node.children)) {
      flatten(node.children, out);
    }
  }
  return out;
}

// Build a dependency graph from the node tree and questionnaire-level variables.
//
// Returns:
//   {
//     edges:    Map<nodeId, Set<nodeId>>   — A → B means A depends on B
//     nodeIds:  string[]                   — all item/group ids present
//     varNames: Set<string>                — declared SDC variable names
//     missing:  Map<nodeId, Set<string>>   — references to unknown linkIds
//   }
//
// A node depends on another node when its enableWhen / enableWhenExpression /
// calculatedExpression / initialExpression references that node's linkId.
// References to SDC variables are recorded but do not create node→node edges
// (variables are evaluated separately by buildVarEnv).
export function buildDepGraph(nodes, variables = []) {
  const flat = flatten(nodes || []);
  const nodeIds = flat.map(n => n.id);
  const idSet = new Set(nodeIds);
  const varNames = new Set((variables || []).map(v => v && v.name).filter(Boolean));

  const edges = new Map();
  const missing = new Map();
  for (const id of nodeIds) edges.set(id, new Set());

  const addDep = (fromId, toId) => {
    if (toId === fromId) return; // self-reference handled by cycle detection if real
    if (idSet.has(toId)) {
      edges.get(fromId).add(toId);
    } else if (!varNames.has(toId)) {
      if (!missing.has(fromId)) missing.set(fromId, new Set());
      missing.get(fromId).add(toId);
    }
  };

  for (const node of flat) {
    // 1. enableWhen[] — explicit linkId references via .question
    if (Array.isArray(node.enableWhen)) {
      for (const ew of node.enableWhen) {
        if (ew && ew.question) addDep(node.id, ew.question);
      }
    }
    // 2/3/4. FHIRPath expression fields — parse linkId references out
    const exprs = [
      node.enableWhenExpression,
      node._calculatedExpr,
      node._initialExpr,
    ];
    for (const expr of exprs) {
      const { linkIds } = extractRefs(expr);
      for (const lid of linkIds) addDep(node.id, lid);
    }
  }

  return { edges, nodeIds, varNames, missing };
}

// Detect circular dependencies in the graph using DFS with white/grey/black
// coloring. Returns an array of cycles; each cycle is an array of node ids in
// dependency order, with the repeated entry point appended (e.g. [A, B, A]).
export function detectCycles(graph) {
  const { edges } = graph;
  const WHITE = 0, GREY = 1, BLACK = 2;
  const color = new Map();
  for (const id of edges.keys()) color.set(id, WHITE);
  const cycles = [];
  const stack = [];

  const visit = (id) => {
    color.set(id, GREY);
    stack.push(id);
    for (const next of edges.get(id) || []) {
      const c = color.get(next);
      if (c === GREY) {
        // Found a back-edge → extract the cycle from the current stack
        const start = stack.indexOf(next);
        if (start !== -1) cycles.push([...stack.slice(start), next]);
      } else if (c === WHITE) {
        visit(next);
      }
    }
    stack.pop();
    color.set(id, BLACK);
  };

  for (const id of edges.keys()) {
    if (color.get(id) === WHITE) visit(id);
  }
  return cycles;
}

// Produce a topological evaluation order using Kahn's algorithm. Because edges
// point from dependent → dependency, a node is emitted only after all the nodes
// it depends on. Any nodes left over (involved in a cycle) are reported in
// `cycles` and appended to `order` in their original tree order so evaluation
// still makes a best-effort single pass over them.
export function topoOrder(graph) {
  const { edges, nodeIds } = graph;
  // outDeg[id] = number of unresolved dependencies of id
  const outDeg = new Map();
  // dependents[id] = nodes that depend on id (reverse edges)
  const dependents = new Map();
  for (const id of nodeIds) {
    outDeg.set(id, (edges.get(id) || new Set()).size);
    dependents.set(id, []);
  }
  for (const id of nodeIds) {
    for (const dep of edges.get(id) || []) {
      if (dependents.has(dep)) dependents.get(dep).push(id);
    }
  }

  // Seed queue with nodes that have no dependencies, preserving tree order
  const queue = nodeIds.filter(id => outDeg.get(id) === 0);
  const order = [];
  const resolved = new Set();
  while (queue.length) {
    const id = queue.shift();
    order.push(id);
    resolved.add(id);
    for (const dependent of dependents.get(id) || []) {
      outDeg.set(dependent, outDeg.get(dependent) - 1);
      if (outDeg.get(dependent) === 0) queue.push(dependent);
    }
  }

  const cycles = detectCycles(graph);
  if (order.length < nodeIds.length) {
    // Append unresolved (cyclic) nodes in original tree order
    for (const id of nodeIds) {
      if (!resolved.has(id)) order.push(id);
    }
  }
  return { order, cycles };
}
