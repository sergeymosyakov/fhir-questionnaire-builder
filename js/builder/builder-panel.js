// ── BuilderPanel class ────────────────────────────────────────────────────────
// Encapsulates builder tree rendering, renumbering, collapse/expand, DnD, and
// FHIR calc recalculation.  Created once by builder/index.js.
import { AppEvents } from '../events.js';
import { buildQR } from '../fhir/qr-builder.js';
import { evalCalcNodes } from '../fhir/calc.js';
import { GroupNode } from '../nodes/group-node.js';
import { createGroupNode } from '../nodes/index.js';
import { init as dndInit, makeRootDropZone } from './dnd.js';
import { showWarn } from '../ui/toast.js';
import { versionCompatRegistry } from '../fhir/version-compat-registry.js';
import { numberingService } from './numbering-service.js';

const fhirpath = typeof window !== 'undefined' ? window.fhirpath : null;

export class BuilderPanel {
  constructor({ tree, rawFhir, values, questMeta }) {
    this._tree = tree;
    this._rawFhir = rawFhir;
    this._values = values;
    this._questMeta = questMeta;
    this._container = null;

    this._subscribeEvents();
    dndInit(() => this.renderTree(), tree);
  }

  // ── Public API ──────────────────────────────────────────────────────────────
  mount({ collapseAllBtn, expandAllBtn, treeContainer }) {
    this._container = treeContainer;
    collapseAllBtn.onclick = () =>
      document.dispatchEvent(new CustomEvent(AppEvents.BUILDER_COLLAPSE_ALL));
    expandAllBtn.onclick = () =>
      document.dispatchEvent(new CustomEvent(AppEvents.BUILDER_EXPAND_ALL));
  }

  renderTree() {
    this._container.innerHTML = '';
    for (const node of this._tree) this._container.appendChild(this._renderNode(node));
    this._container.appendChild(makeRootDropZone());
  }

  async renderTreeAsync(onProgress) {
    const raf = () => new Promise(r => requestAnimationFrame(r));
    await raf();
    const frag = document.createDocumentFragment();
    const total = this._tree.length;
    for (let i = 0; i < this._tree.length; i++) {
      frag.appendChild(this._renderNode(this._tree[i]));
      if (onProgress) onProgress(i + 1, total);
      await raf();
    }
    frag.appendChild(makeRootDropZone());
    this._container.innerHTML = '';
    this._container.appendChild(frag);
  }

  async renumberAll() {
    const raf = () => new Promise(r => requestAnimationFrame(r));
    await raf();
    this._applyPrefixes(this._tree, '');
    const frag = document.createDocumentFragment();
    const total = this._tree.length;
    for (let i = 0; i < this._tree.length; i++) {
      frag.appendChild(this._renderNode(this._tree[i]));
      document.dispatchEvent(new CustomEvent(AppEvents.RENUMBER_PROGRESS,
        { detail: { done: i + 1, total } }));
      await raf();
    }
    frag.appendChild(makeRootDropZone());
    this._container.innerHTML = '';
    this._container.appendChild(frag);
    document.dispatchEvent(new CustomEvent(AppEvents.RENUMBER_DONE));
  }

  addRootGroup() {
    const node = createGroupNode({ title: 'New Group' });
    node.id = numberingService.formatSeg(this._tree.length + 1);
    this._tree.push(node);
    document.dispatchEvent(new CustomEvent(AppEvents.REINIT_FORM));
    this.renderTree();
    requestAnimationFrame(() => {
      const el = document.querySelector(
        '[data-node-id="' + CSS.escape(node.id) + '"]');
      if (el) {
        const panel = document.querySelector('.left-panel-body');
        if (panel) {
          const top = el.getBoundingClientRect().top -
            panel.getBoundingClientRect().top + panel.scrollTop;
          panel.scrollTo({ top, behavior: 'smooth' });
        } else {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        el.classList.add('node-flash');
        setTimeout(() => el.classList.remove('node-flash'), 1000);
      }
    });
  }

  _doCalcRecalc() {
    if (this._rawFhir.value && fhirpath) {
      const base = JSON.parse(JSON.stringify(this._rawFhir.value));
      const qr = buildQR(base, this._values);
      evalCalcNodes(this._tree, qr, fhirpath, this._values, {}, base);
    }
    document.dispatchEvent(new CustomEvent(AppEvents.RESPONSE_CHANGED));
  }

  // ── Private ─────────────────────────────────────────────────────────────────
  _renderNode(node) { return node.buildBuilder(); }

  _setCollapsedAll(nodes, value) {
    for (const n of nodes) {
      if (n.type === 'group') {
        GroupNode._collapseMap.set(n.id, value);
        this._setCollapsedAll(n.children, value);
      }
    }
  }

  _applyPrefixes(nodes, parentPrefix) {
    nodes.forEach((node, i) => {
      const seg = numberingService.formatSeg(i + 1);
      const prefix = parentPrefix ? parentPrefix + '.' + seg : seg;
      node._prefix = prefix;
      if (node.type === 'group' && node.children.length)
        this._applyPrefixes(node.children, prefix);
    });
  }

  _subscribeEvents() {
    document.addEventListener(AppEvents.CALC_RECALC_REQUESTED,
      () => this._doCalcRecalc());
    document.addEventListener(AppEvents.BUILDER_RERENDER,
      () => this.renderTree());
    document.addEventListener(AppEvents.BUILDER_EXPAND_ALL,
      () => { this._setCollapsedAll(this._tree, false); this.renderTree(); });
    document.addEventListener(AppEvents.BUILDER_COLLAPSE_ALL,
      () => { this._setCollapsedAll(this._tree, true); this.renderTree(); });
    document.addEventListener(AppEvents.QUESTIONNAIRE_LOADED, () => {
      document.querySelector('.left-panel-body')?.scrollTo({ top: 0 });
    });
    document.addEventListener(AppEvents.FHIR_VERSION_CHANGED, e => {
      const { versionId, fromVersionId, source } = e.detail ?? {};
      if (versionId && this._questMeta.fhirTarget !== versionId) {
        if (source === 'user' && this._tree.length > 0) {
          versionCompatRegistry
            .runAll(fromVersionId ?? this._questMeta.fhirTarget, versionId,
              this._tree)
            .then(msgs => { if (msgs.length > 0) showWarn(msgs.join('\n')); });
        }
        this._questMeta.fhirTarget = versionId;
        document.dispatchEvent(new CustomEvent(AppEvents.BUILDER_RERENDER));
        document.dispatchEvent(new CustomEvent(AppEvents.REINIT_FORM));
      }
    });
  }
}
