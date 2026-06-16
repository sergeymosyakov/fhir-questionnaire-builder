// ── Copy / Paste nodes ────────────────────────────────────────────────────────
// Serialises a node subtree to FHIR JSON (via export.js), re-maps linkIds to
// avoid collisions, then deserialises back (via import-item.js) and inserts the
// result after the source node in the tree.
//
// Services injected via CopyPaste.configure() in builder/index.js.
import { nodeToFHIRItem } from '../fhir/export.js';
import { fhirItemToNode } from '../fhir/import-item.js';
import { MODAL_REGISTRY } from './modals/modal-registry.js';
import { AppEvents } from '../events.js';

// FHIRPath structural-query patterns that may be affected when items are added.
const STRUCTURAL_RE = /\.descendants\(\)|\.item\.where\s*\(\s*type\s*=|\.count\(\)/;

export class CopyPaste {
  /** Services injected at app startup. */
  static _svc = {
    questDoc: null,  // QuestDocument singleton
  };

  static configure(services) {
    Object.assign(CopyPaste._svc, services);
  }

  constructor() {
    /** Serialised FHIR JSON of the last copied item. null = nothing copied. */
    this._clip = null;

    document.addEventListener(AppEvents.NODE_COPY_REQUESTED,
      e => this.copy(e.detail.id));
    document.addEventListener(AppEvents.NODE_PASTE_AFTER_REQUESTED,
      e => this.paste(e.detail.id));
    document.addEventListener(AppEvents.NODE_PASTE_BEFORE_REQUESTED,
      e => this.pasteBefore(e.detail.id));
  }

  /** Returns true if there is something in the clipboard. */
  hasPending() { return this._clip !== null; }

  /** Serialise node to FHIR JSON and store in clipboard. */
  copy(nodeId) {
    const node = this._findNode(nodeId, CopyPaste._svc.questDoc.tree);
    if (!node) return;
    const fhirItem = nodeToFHIRItem(node);
    this._clip = JSON.stringify(fhirItem);
    navigator.clipboard?.writeText(this._clip).catch(() => {});
    document.dispatchEvent(new CustomEvent(AppEvents.CLIPBOARD_CHANGED, { detail: { hasClip: true } }));
    // Re-render so Paste-after buttons become active
    document.dispatchEvent(new CustomEvent(AppEvents.BUILDER_RERENDER));
  }

  /** Deserialise clipboard, re-map linkIds, insert after afterNodeId, show warnings. */
  paste(afterNodeId) {
    this._pasteAt(afterNodeId, 'after');
  }

  /** Deserialise clipboard, re-map linkIds, insert before beforeNodeId, show warnings. */
  pasteBefore(beforeNodeId) {
    this._pasteAt(beforeNodeId, 'before');
  }

  _pasteAt(anchorId, position) {
    if (!this._clip) return;
    let fhirItem;
    try { fhirItem = JSON.parse(this._clip); } catch { return; }

    const { remapped, idMap } = this._remapLinkIds(fhirItem);
    const node = fhirItemToNode(remapped, new Map(), CopyPaste._svc.questDoc.contained || []);
    if (position === 'before') this._insertBefore(node, anchorId);
    else                       this._insertAfter(node, anchorId);

    // Analyse for potential expression issues
    const externalRefs   = this._collectExternalRefs(fhirItem, idMap);
    const structuralHits = this._detectStructural(CopyPaste._svc.questDoc.tree);

    document.dispatchEvent(new CustomEvent(AppEvents.REINIT_FORM));
    document.dispatchEvent(new CustomEvent(AppEvents.BUILDER_RERENDER));

    if (externalRefs.length || structuralHits.length) {
      // Modal renders after re-render so the paste is already visible
      requestAnimationFrame(() => {
        MODAL_REGISTRY.get('pasteWarning')?.open(externalRefs, structuralHits);
      });
    }
  }

  // ── Private: tree traversal ────────────────────────────────────────────────

  _findNode(nodeId, nodes) {
    for (const n of nodes) {
      if (n.id === nodeId) return n;
      if (n.children?.length) {
        const found = this._findNode(nodeId, n.children);
        if (found) return found;
      }
    }
    return null;
  }

  _insertBefore(node, beforeId) {
    if (!this._insertBeforeIn(node, beforeId, CopyPaste._svc.questDoc.tree)) {
      CopyPaste._svc.questDoc.tree.unshift(node);
    }
  }

  _insertBeforeIn(node, beforeId, nodes) {
    for (let i = 0; i < nodes.length; i++) {
      if (nodes[i].id === beforeId) {
        nodes.splice(i, 0, node);
        return true;
      }
      if (nodes[i].children?.length && this._insertBeforeIn(node, beforeId, nodes[i].children)) {
        return true;
      }
    }
    return false;
  }

  _insertAfter(node, afterId) {
    if (!this._insertAfterIn(node, afterId, CopyPaste._svc.questDoc.tree)) {
      CopyPaste._svc.questDoc.tree.push(node);
    }
  }

  _insertAfterIn(node, afterId, nodes) {
    for (let i = 0; i < nodes.length; i++) {
      if (nodes[i].id === afterId) {
        nodes.splice(i + 1, 0, node);
        return true;
      }
      if (nodes[i].children?.length && this._insertAfterIn(node, afterId, nodes[i].children)) {
        return true;
      }
    }
    return false;
  }

  _allLinkIds(nodes, out = []) {
    for (const n of nodes) {
      out.push(n.id);
      if (n.children?.length) this._allLinkIds(n.children, out);
    }
    return out;
  }

  // ── Private: linkId re-mapping ─────────────────────────────────────────────

  _remapLinkIds(fhirItem) {
    const idMap      = new Map(); // oldId → newId
    const usedInBatch = new Set();
    this._collectIds(fhirItem, idMap, usedInBatch);
    const remapped = this._rewriteIds(JSON.parse(JSON.stringify(fhirItem)), idMap);
    return { remapped, idMap };
  }

  _collectIds(item, idMap, usedInBatch) {
    const newId = this._uniqueId(item.linkId + '-copy', usedInBatch);
    idMap.set(item.linkId, newId);
    usedInBatch.add(newId);
    if (item.item) for (const c of item.item) this._collectIds(c, idMap, usedInBatch);
  }

  _uniqueId(base, usedInBatch) {
    const existing = new Set(this._allLinkIds(CopyPaste._svc.questDoc.tree));
    if (usedInBatch) for (const id of usedInBatch) existing.add(id);
    let id = base;
    let n = 2;
    while (existing.has(id)) { id = base + '-' + n++; }
    return id;
  }

  _rewriteIds(item, idMap) {
    item.linkId = idMap.get(item.linkId) ?? item.linkId;
    // enableWhen: only rewrite question refs that point inside the copied subtree
    if (item.enableWhen) {
      for (const ew of item.enableWhen) {
        if (idMap.has(ew.question)) ew.question = idMap.get(ew.question);
      }
    }
    if (item.item) for (const c of item.item) this._rewriteIds(c, idMap);
    return item;
  }

  // ── Private: expression analysis ──────────────────────────────────────────

  /** Return rows for expressions in the pasted subtree that reference external linkIds. */
  _collectExternalRefs(fhirItem, idMap) {
    const results = [];
    this._scanExprs(fhirItem, idMap, results);
    return results;
  }

  _scanExprs(item, idMap, results) {
    const SDC_EXPR_URLS = [
      { suffix: 'enableWhenExpression',  label: 'enableWhenExpression' },
      { suffix: 'calculatedExpression',  label: 'calculatedExpression' },
      { suffix: 'initialExpression',     label: 'initialExpression' },
      { suffix: 'answerExpression',      label: 'answerExpression' },
    ];
    for (const { suffix, label } of SDC_EXPR_URLS) {
      const ext = (item.extension || []).find(e => e.url?.endsWith(suffix));
      if (ext?.valueExpression?.expression) {
        if (this._hasExternalLinkIdRef(ext.valueExpression.expression, idMap)) {
          results.push({ linkId: item.linkId, type: label, expr: ext.valueExpression.expression });
        }
      }
    }
    // questionnaire-constraint extensions
    for (const ext of (item.extension || [])) {
      if (!ext.url?.includes('questionnaire-constraint')) continue;
      const exprExt = (ext.extension || []).find(e => e.url === 'expression');
      const expr = exprExt?.valueExpression?.expression || exprExt?.valueString;
      if (expr && this._hasExternalLinkIdRef(expr, idMap)) {
        results.push({ linkId: item.linkId, type: 'constraint', expr });
      }
    }
    if (item.item) for (const c of item.item) this._scanExprs(c, idMap, results);
  }

  _hasExternalLinkIdRef(expr, idMap) {
    const re = /linkId\s*=\s*['"]([^'"]+)['"]/g;
    let m;
    while ((m = re.exec(expr)) !== null) {
      if (!idMap.has(m[1])) return true; // references an id NOT in the copied subtree
    }
    return false;
  }

  /** Scan entire tree for expressions that query tree structure (.descendants, .count, etc.). */
  _detectStructural(nodes) {
    const results = [];
    this._scanStructural(nodes, results);
    return results;
  }

  _scanStructural(nodes, results) {
    for (const n of nodes) {
      const candidates = [
        { expr: n.enableWhenExpression, type: 'enableWhenExpression' },
        { expr: n._calculatedExpr,      type: 'calculatedExpression' },
        { expr: n._initialExpr,         type: 'initialExpression' },
        { expr: n._answerExpression,    type: 'answerExpression' },
      ];
      for (const { expr, type } of candidates) {
        if (expr && STRUCTURAL_RE.test(expr)) results.push({ linkId: n.id, type, expr });
      }
      if (n.constraint?.length) {
        for (const c of n.constraint) {
          if (c.expression && STRUCTURAL_RE.test(c.expression)) {
            results.push({ linkId: n.id, type: 'constraint', expr: c.expression });
          }
        }
      }
      if (n.children?.length) this._scanStructural(n.children, results);
    }
  }
}
