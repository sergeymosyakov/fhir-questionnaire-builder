// ── Builder shared utilities ─────────────────────────────────────────────────
// Pure helpers used by panels.js and nodes.
// All stateful logic lives in BuilderPanel class (builder-panel.js).
// formatSeg now lives in NumberingService (numbering-service.js).

// Collect all item nodes as flat list with breadcrumb labels for dropdowns
export function getAllItems(nodes, result = [], prefix = '') {
  for (const n of nodes) {
    if (n.type === 'item') {
      result.push({ id: n.id, label: (prefix ? prefix + ' › ' : '') + n.title, itemType: n.itemType, options: n.options });
    }
    // Non-group items can also carry nested item.item[] (FHIR R4) — always recurse.
    if (n.children?.length) {
      getAllItems(n.children, result, (prefix ? prefix + ' › ' : '') + n.title);
    }
  }
  return result;
}


