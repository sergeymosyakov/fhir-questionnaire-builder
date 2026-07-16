// ── BuilderPanel class ────────────────────────────────────────────────────────
// Encapsulates builder tree rendering, renumbering, collapse/expand, DnD, and
// FHIR calc recalculation.  Created once by builder/index.js.
import { AppEvents, EventState } from '../events.js';
import { buildQR } from '../fhir/qr-builder.js';
import { evalCalcNodes, buildCalcCache } from '../fhir/calc.js';
import { GroupNode } from '../nodes/group-node.js';
import { createGroupNode } from '../nodes/index.js';
import { init as dndInit, makeRootDropZone } from './dnd.js';
import { showWarn } from '../ui/toast.js';
import { versionCompatRegistry } from '../fhir/version-compat-registry.js';
import { numberingService } from './numbering-service.js';
import { findAndRemove } from '../utils.js';
import { ConfirmDialog } from '../ui/confirm-dialog.js';
import * as progress from '../ui/progress.js';
import { RenumberControl } from '../ui/renumber-control.js';

const fhirpath = typeof window !== 'undefined' ? window.fhirpath : null;

export class BuilderPanel {
  constructor() {
    this._questDoc    = null;
    this._tree        = null;
    this._answerStore = null;
    this._calcCache   = null;   // { nodeMap, order } — cached dep-graph for _doCalcRecalc
    this._container   = null;

    const _init = (questDoc, answerStore) => {
      this._questDoc    = questDoc;
      this._tree        = questDoc.tree;
      this._answerStore = answerStore;
      this._subscribeEvents();
      dndInit(() => this.renderTree(), questDoc.tree);
    };

    // If APP_CONTEXT_READY already fired — read from cache; otherwise wait
    const cached = EventState.get(AppEvents.APP_CONTEXT_READY);
    if (cached?.questDoc) {
      _init(cached.questDoc, cached.answerStore);
    } else {
      document.addEventListener(AppEvents.APP_CONTEXT_READY, e => {
        _init(e.detail.questDoc, e.detail.answerStore);
      }, { once: true });
    }

    if (typeof document !== 'undefined') this.mount();
  }

  // ── Public API ──────────────────────────────────────────────────────────────
  mount() {
    this._container = document.querySelector('[data-mount="tree-container"]');
    const addRootGroupBtn  = document.querySelector('[data-mount="add-root-group-btn"]');
    addRootGroupBtn.onclick = () => this.addRootGroup();
    new RenumberControl({ renumberAll: () => this.renumberAll() });
  }

  renderTree() {
    if (!this._container || !this._tree) return;
    this._container.innerHTML = '';
    for (const node of this._tree) this._container.appendChild(this._renderNode(node));
    this._container.appendChild(makeRootDropZone());
    document.dispatchEvent(new CustomEvent(AppEvents.BUILDER_RENDER_DONE));
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
    document.dispatchEvent(new CustomEvent(AppEvents.RESPONSE_CHANGED));
  }

  addRootGroup() {
    const wasEmpty = this._tree.length === 0;
    const node = createGroupNode({ title: 'New Group' });
    node.id = String(this._tree.length + 1);
    this._tree.push(node);
    document.dispatchEvent(new CustomEvent(AppEvents.REINIT_FORM));
    if (wasEmpty) document.dispatchEvent(new CustomEvent(AppEvents.QUESTIONNAIRE_NEW));
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
    if (this._questDoc.rawFhir && fhirpath) {
      const base = JSON.parse(JSON.stringify(this._questDoc.rawFhir));
      const values = this._answerStore.toValueMap();
      const qr = buildQR(base, values);
      // Reuse cached dep-graph order — stable while questionnaire structure is unchanged.
      if (!this._calcCache) {
        this._calcCache = buildCalcCache(this._tree, this._questDoc.variables);
      }
      evalCalcNodes(this._tree, qr, fhirpath, values, {}, base, this._calcCache);
      this._answerStore.merge(values);
    }
    document.dispatchEvent(new CustomEvent(AppEvents.RESPONSE_CHANGED));
  }

  // ── Private ─────────────────────────────────────────────────────────────────
  _renderNode(node) { return node.buildBuilder(); }

  _setCollapsedAll(nodes, value) {
    for (const n of nodes) {
      if (n.children?.length) {
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
      if (node.children?.length)
        this._applyPrefixes(node.children, prefix);
    });
  }

  _subscribeEvents() {
    document.addEventListener(AppEvents.NODE_DELETE_REQUESTED, async e => {
      const { id, label } = e.detail;
      const ok = await ConfirmDialog.show(label);
      if (ok) {
        findAndRemove(id, this._tree);
        this._calcCache = null;  // node removed — dep-graph stale
        document.dispatchEvent(new CustomEvent(AppEvents.REINIT_FORM));
        document.dispatchEvent(new CustomEvent(AppEvents.BUILDER_RERENDER));
      }
    });
    document.addEventListener(AppEvents.CALC_RECALC_REQUESTED,
      () => this._doCalcRecalc());
    document.addEventListener(AppEvents.BUILDER_RERENDER,
      () => this.renderTree());
    document.addEventListener(AppEvents.BUILDER_EXPAND_ALL,
      () => { this._setCollapsedAll(this._tree, false); this.renderTree(); });
    document.addEventListener(AppEvents.BUILDER_COLLAPSE_ALL,
      () => { this._setCollapsedAll(this._tree, true); this.renderTree(); });
    document.addEventListener(AppEvents.QUESTIONNAIRE_LOADED, async () => {
      if (!this._tree) return; // _init not yet complete (APP_CONTEXT_READY pending)
      this._calcCache = null;  // questionnaire structure changed — invalidate dep-graph cache
      document.querySelector('.left-panel-body')?.scrollTo({ top: 0 });
      progress.show('Rendering ' + this._tree.length + ' nodes…');
      await this.renderTreeAsync((done, total) => progress.update(done, total));
      progress.hide();
      document.dispatchEvent(new CustomEvent(AppEvents.BUILDER_EXPAND_ALL));
    });
    document.addEventListener(AppEvents.FHIR_VERSION_CHANGED, e => {
      const { versionId, fromVersionId, source } = e.detail ?? {};
      if (versionId && this._questDoc.meta.fhirTarget !== versionId) {
        if (source === 'user' && this._tree.length > 0) {
          versionCompatRegistry
            .runAll(fromVersionId ?? this._questDoc.meta.fhirTarget, versionId,
              this._tree)
            .then(msgs => { if (msgs.length > 0) showWarn(msgs.join('\n')); });
        }
        this._questDoc.meta.fhirTarget = versionId;
        document.dispatchEvent(new CustomEvent(AppEvents.BUILDER_RERENDER));
        document.dispatchEvent(new CustomEvent(AppEvents.REINIT_FORM));
      }
    });
  }
}
