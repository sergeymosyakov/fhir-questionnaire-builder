// ── BaseNode ──────────────────────────────────────────────────────────────────
// Common properties shared by every node (group and all item types).
// Subclasses must set `this.type` and optionally `this.itemType`.
import { nextId } from '../id.js';
import * as explainModal from '../ui/modals/explain-modal.js';
import * as bh from './builder-helpers.js';
import { AppEvents } from '../events.js';

// Shared wrapper factory used by every buildControl() implementation.
export function createWrap() {
  const wrap = document.createElement('span');
  wrap.className = 'ctrl-wrap';
  return wrap;
}

// Safe allowlist for node._renderStyle — only these CSS properties are applied.
const _STYLE_ALLOWLIST = new Set(['font-weight', 'font-style', 'color', 'font-size', 'text-decoration']);
export function applyRenderStyle(el, raw) {
  if (!raw) return;
  raw.split(';').forEach(part => {
    const sep = part.indexOf(':');
    if (sep < 1) return;
    const prop = part.slice(0, sep).trim().toLowerCase();
    const val  = part.slice(sep + 1).trim();
    if (_STYLE_ALLOWLIST.has(prop) && val) el.style.setProperty(prop, val);
  });
}

export class BaseNode {
  constructor(data = {}) {
    this.id                   = data.id   ?? nextId();
    this.title                = data.title ?? '';
    this.enableWhen           = data.enableWhen           ?? [];
    this.enableBehavior       = data.enableBehavior       ?? 'all';
    this.enableWhenExpression = data.enableWhenExpression ?? '';
    this.mandatory            = data.mandatory            ?? false;
    if (typeof document !== 'undefined') {
      this._ac = new AbortController();
      this._initPreviewNavListener();
      document.addEventListener(AppEvents.REFRESH_CALC_BADGES, () => this._refreshCalcBadge?.(), { signal: this._ac.signal });
    }
  }

  /** Abort all document listeners owned by this node. */
  destroy() { this._ac?.abort(); }

  // ── Builder service injection ─────────────────────────────────────────────
  // Nodes must not import application state or services directly.
  // Call BaseNode.configure() once at app startup (builder/index.js).
  static _svc = {
    tree:              null,  // reactive tree array (state.js)
    findAndRemove:     null,  // (id, nodes) => void
    confirmDelete:     null,  // (label) => Promise<boolean>
    triggerCalcRecalc: null,  // () => void
    tickForm:          null,  // () => void — increments formTick
    formatSeg:         null,  // (n) => string
    leftPanelBody:     null,  // scroll container for builder navigate-to
  };

  static configure(services) {
    Object.assign(BaseNode._svc, services);
  }

  // ── Static dispatcher ────────────────────────────────────────────────────
  // Every node has its correct class prototype throughout its lifecycle:
  //   - fhirItemToNode uses createItemNode/createGroupNode (correct class)
  //   - answer-type-modal.js calls Object.setPrototypeOf on type-change
  // So node.renderPreview() always dispatches to the right implementation.
  static dispatch(res, container, rc) {
    if (!res) return;
    res.node.renderPreview(res, container, rc);
  }

  // ── Preview rendering entry point ─────────────────────────────────────────
  // Called by BaseNode.dispatch(). rc = _rc from render-ctx.js.
  renderPreview(res, container, rc) {
    if (!res.visible && !res.showDimmed) return;
    const isPatient = rc.previewMode === 'patient';
    if (res.hidden && (isPatient || !rc.viewPrefs.showHiddenItems)) return;
    if (!res.visible && res.showDimmed) {
      if (!isPatient) this._renderDimmed(res, container, rc);
      return;
    }
    if (res.disabled)                   { this._renderDisabled(res, container, rc); return; }

    const row   = this._createBaseRow(res, rc);
    this._buildRowContent(row, res, rc);
    const target = this._appendRow(row, res, container);
    this._renderChildren(res, target, rc);
  }

  // ── Dimmed state (enableWhen condition not yet met) ───────────────────────
  _renderDimmed(res, container, rc) {
    if (this._disabledDisplay === 'hidden') return;
    const row = this._makePreviewRow('lform-item lform-waiting preview-row--pointer');
    row.dataset.tipTitle = 'Click to navigate to builder node';
    row.addEventListener('click', () => document.dispatchEvent(new CustomEvent(AppEvents.BUILDER_NAVIGATE_TO, { detail: { nodeId: this.id } })));
    const ph = document.createElement('span');
    ph.className = 'preview-icon-ph';
    row.appendChild(ph);
    const label = document.createElement('span');
    label.className = 'preview-label--dim';
    label.textContent = (this.type === 'group' ? 'Group: ' : 'Item: ') + this.title;
    row.appendChild(label);
    const hint = document.createElement('span');
    hint.className = 'preview-condition-hint preview-condition-waiting';
    const dimText = this._enableWhenText || this.enableWhenExpression || 'condition not met';
    hint.textContent = '\uD83D\uDD12 ' + dimText;
    if (this.enableWhenExpression) {
      hint.classList.add('preview-condition-hint--explain');
      hint.dataset.tipTitle = 'Visibility condition';
      hint.dataset.tipBody  = 'Not met. FHIRPath: ' + this.enableWhenExpression + '\n\nClick to explain.';
      hint.dataset.tipFhir  = 'sdc-questionnaire-enableWhenExpression';
      hint.dataset.tipSpec  = 'SDC';
      const expr = this.enableWhenExpression;
      hint.addEventListener('click', e => {
        e.stopPropagation();
        if (rc.lastCtx.fp) explainModal.show(expr, rc.lastCtx.fp, rc.lastCtx.qr, rc.lastCtx.env);
      });
    } else {
      hint.dataset.tipTitle = 'Visibility condition';
      hint.dataset.tipBody  = 'Not yet met: ' + dimText + '\n\nThis label is auto-generated from the enableWhen condition. To change it \u2014 edit the Show When panel in the builder.';
      hint.dataset.tipFhir  = 'Questionnaire.item.enableWhen[]';
      hint.dataset.tipSpec  = 'R4';
    }
    row.appendChild(hint);
    container.appendChild(row);
    this._renderDimmedChildren(res, container, rc);
  }

  // Override in GroupNode to render children even when dimmed (keeps counts in sync).
  _renderDimmedChildren(_res, _container, _rc) { /* no-op */ }

  // ── Disabled state (group conditionRule not met → N/A) ───────────────────
  _renderDisabled(res, container, rc) {
    if (rc.previewMode === 'patient') return;
    const row = this._makePreviewRow('lform-item lform-disabled preview-row--pointer');
    row.addEventListener('click', () => document.dispatchEvent(new CustomEvent(AppEvents.BUILDER_NAVIGATE_TO, { detail: { nodeId: this.id } })));
    const naIcon = document.createElement('span');
    naIcon.className = 'icon-na';
    row.appendChild(naIcon);
    const label = document.createElement('span');
    if (this.type === 'group') label.className = 'group-label';
    label.textContent = (this.type === 'group' ? 'Group: ' : 'Item: ') + this.title;
    row.appendChild(label);
    container.appendChild(row);
    this._renderDisabledChildren(res, container, rc);
  }

  // Override in GroupNode.
  _renderDisabledChildren(_res, _container, _rc) { /* no-op */ }

  // ── Base row: nav btn + icon/ph + linkId + hidden badge + prefix ──────────
  _createBaseRow(res, rc) {
    const isPatient = rc.previewMode === 'patient';
    const row = this._makePreviewRow('lform-item');
    if (res.hiddenRoot) row.classList.add('lform-item--hidden');

    if (!isPatient) {
      const navBtn = document.createElement('span');
      navBtn.className = 'preview-nav-btn';
      navBtn.dataset.testid = 'preview-nav-btn';
      navBtn.textContent = '\u2197';
      navBtn.dataset.tipTitle = 'Go to builder node';
      navBtn.dataset.tipBody  = 'Scroll and highlight the corresponding node in the builder panel.';
      navBtn.addEventListener('click', e => { e.stopPropagation(); document.dispatchEvent(new CustomEvent(AppEvents.BUILDER_NAVIGATE_TO, { detail: { nodeId: this.id } })); });
      row.appendChild(navBtn);
    }

    const { hasCondition, displayOk } = this._evalCondition(res, rc);
    let iconEl = null;
    if (!isPatient) {
      if (hasCondition && !res.hidden) {
        iconEl = document.createElement('span');
        iconEl.className   = displayOk ? 'icon-ok' : 'icon-fail';
        iconEl.textContent = displayOk ? '\u2713' : '\u2717';
        row.appendChild(iconEl);
      } else {
        const ph = document.createElement('span');
        ph.className = 'preview-icon-ph';
        row.appendChild(ph);
      }
    }
    res._iconEl = iconEl;

    if (rc.viewPrefs.showLinkId && !isPatient) row.appendChild(this._buildLinkIdTag(rc));

    if (res.hiddenRoot && !isPatient) {
      const b = document.createElement('span');
      b.className = 'preview-hidden-badge';
      b.textContent = 'HIDDEN';
      b.dataset.tipTitle = 'sdc-questionnaire-hidden';
      b.dataset.tipBody  = 'This item is permanently hidden from patients. It still participates in calculatedExpression logic. Controls are disabled in preview.';
      b.dataset.tipFhir  = 'sdc-questionnaire-hidden';
      b.dataset.tipSpec  = 'SDC';
      row.appendChild(b);
    }

    if (this._prefix && rc.viewPrefs.showPrefix) {
      const pfx = document.createElement('span');
      pfx.className = 'preview-prefix';
      pfx.textContent = this._prefix;
      row.appendChild(pfx);
    }

    return row;
  }

  // Compute hasCondition / displayOk for the icon. Overridden in GroupNode and ItemNode.
  _evalCondition(_res, _rc) { return { hasCondition: false, displayOk: true }; }

  // Build linkId tag (same structure for all node types).
  _buildLinkIdTag(_rc) {
    const it = this.itemType;
    const valExample = it === 'checkbox' ? 'true / false'
      : it === 'integer'  ? '42 (valueInteger)'
      : it === 'decimal'  ? '3.14 (valueDecimal)'
      : it === 'number'   ? '42'
      : it === 'date'     ? '"2024-01-15"'
      : (it === 'select' || it === 'radio' || it === 'open-choice') ? '"option-code"'
      : it === 'quantity' ? '{ value: 70, unit: "kg" }'
      : '"text value"';
    const tag = document.createElement('span');
    tag.className = 'preview-linkid';
    tag.dataset.testid = 'preview-linkid';
    tag.textContent = this.id;
    tag.dataset.tipTitle = 'linkId: ' + this.id;
    tag.dataset.tipBody  =
      'In visibility rules:  values[\'' + this.id + '\']\n' +
      'Expected value:  ' + valExample +
      (it ? '\nItem type:  ' + it : '') +
      '\nClick to copy linkId to clipboard.';
    tag.dataset.tipFhir = 'Questionnaire.item.linkId';
    tag.dataset.tipSpec  = 'R4';
    tag.addEventListener('click', e => {
      e.stopPropagation();
      navigator.clipboard.writeText(this.id).catch(() => {});
      tag.textContent = '\u2713 copied';
      setTimeout(() => { tag.textContent = this.id; }, 1200);
    });
    return tag;
  }

  // Apply XHTML / markdown / plain text to label element.
  // Priority: rendering-xhtml > rendering-markdown > plain text.
  _applyLabelContent(el) {
    const { domPurify, marked } = BaseNode._svc;
    if (this._renderXhtml && domPurify) {
      el.innerHTML = domPurify.sanitize(this._renderXhtml);
    } else if (this._renderMarkdown && domPurify && marked) {
      el.innerHTML = domPurify.sanitize(marked.parseInline(this._renderMarkdown));
    } else {
      el.textContent = this.title;
    }
  }

  // Build the label element. Overridden in GroupNode, ItemNode, DisplayNode.
  _buildLabel() {
    const el = document.createElement('span');
    this._applyLabelContent(el);
    return el;
  }

  // Build support-link icons/buttons. Same logic for all node types.
  _buildSupportLinks(row, rc) {
    if (!this._supportLinks || !this._supportLinks.length) return;
    const validLinks = this._supportLinks.filter(u => u && u.trim());
    const isPatient = rc.previewMode === 'patient';
    for (const url of validLinks) {
      // Block javascript: and other dangerous URI schemes — only allow http(s) and mailto
      if (!/^https?:|^mailto:/i.test(url.trim())) continue;
      if (isPatient) {
        const btn = document.createElement('a');
        btn.className = 'support-link-patient-btn';
        btn.dataset.testid = 'support-link-patient-btn';
        btn.href = url; btn.target = '_blank'; btn.rel = 'noopener noreferrer';
        btn.textContent = 'More info \u2197';
        row.appendChild(btn);
      } else {
        const icon = document.createElement('a');
        icon.className = 'support-link-icon';
        icon.dataset.testid = 'support-link-icon';
        icon.href = url; icon.target = '_blank'; icon.rel = 'noopener noreferrer';
        icon.textContent = '\uD83D\uDD17';
        icon.dataset.tipTitle = 'Support link';
        icon.dataset.tipBody  = url;
        icon.dataset.tipFhir  = 'Questionnaire.item.extension[questionnaire-supportLink]';
        icon.dataset.tipSpec  = 'R4';
        icon.addEventListener('click', e => e.stopPropagation());
        row.appendChild(icon);
      }
    }
  }

  // Shared visibility-condition hint. Used by both GroupNode and ItemNode.
  _buildVisHint(row, rc) {
    const isPatient = rc.previewMode === 'patient';
    const visText = this._enableWhenText || this.enableWhenExpression;
    if (!isPatient && visText) {
      const hint = document.createElement('span');
      hint.className = 'preview-condition-hint';
      hint.textContent = '\uD83D\uDC41\uFE0F ' + visText;
      if (this.enableWhenExpression) {
        hint.classList.add('preview-condition-hint--explain');
        hint.dataset.tipTitle = 'Visibility condition';
        hint.dataset.tipBody  = 'FHIRPath: ' + this.enableWhenExpression + '\n\nClick to explain.';
        hint.dataset.tipFhir  = 'sdc-questionnaire-enableWhenExpression';
        hint.dataset.tipSpec  = 'SDC';
        const expr = this.enableWhenExpression;
        hint.addEventListener('click', () => {
          if (rc.lastCtx.fp) explainModal.show(expr, rc.lastCtx.fp, rc.lastCtx.qr, rc.lastCtx.env);
        });
      } else {
        hint.dataset.tipTitle = 'Visibility condition';
        hint.dataset.tipBody  = 'This item is shown only when: ' + visText + '\n\nThis label is auto-generated from the enableWhen condition. To change it \u2014 edit the Show When panel in the builder.';
        hint.dataset.tipFhir  = 'Questionnaire.item.enableWhen[]';
        hint.dataset.tipSpec  = 'R4';
      }
      row.appendChild(hint);
    }
  }

  // Add label + support links + vis hint. Override in subclasses to add more.
  _buildRowContent(row, res, rc) {
    const label = this._buildLabel(res, rc);
    if (this._renderStyle) applyRenderStyle(label, this._renderStyle);
    row.appendChild(label);
    this._buildSupportLinks(row, rc);
    this._buildVisHint(row, rc);
  }

  // Append row to container, handling hidden-group wrapper. Returns actual target element.
  _appendRow(row, res, container) {
    if (res.hiddenRoot && this.type === 'group') {
      const wrap = document.createElement('div');
      wrap.className = 'lform-item--hidden';
      container.appendChild(wrap);
      row.classList.remove('lform-item--hidden');
      wrap.appendChild(row);
      return wrap;
    }
    container.appendChild(row);
    return container;
  }

  // Render children into target. No-op in base; overridden in GroupNode.
  _renderChildren(_res, _target, _rc) { /* no-op */ }

  // ── Shared builder-panel helpers ──────────────────────────────────────────
  // Implementations live in builder-helpers.js; thin delegators here.
  _buildInlineTitleEditor() { return bh.buildInlineTitleEditor(this); }
  _buildLinkIdInput()       { return bh.buildLinkIdInput(this); }
  _buildPrefixInput(ph)     { return bh.buildPrefixInput(this, ph); }
  _makeActionLink(l, k, t, c) { return bh.makeActionLink(this, l, k, t, c); }

  // ── DnD ownership ─────────────────────────────────────────────────────────
  /** Whether this node can be dragged. Override to return false to lock. */
  isDraggable() { return true; }
  _buildDragHandle()    { return bh.buildDragHandle(this); }
  _buildDropZoneAbove() { return bh.buildDropZoneAbove(this); }

  // ── Builder event dispatch ─────────────────────────────────────────────────
  // Breaks circular imports: index.js and preview-form.js both import nodes,
  // so nodes cannot import back. Events decouple the call direction.

  /**
   * Wire the BUILDER_NAVIGATE_TO event for this node's root builder element.
   * Call once at the start of buildBuilder(), passing the node div.
   * Uses AbortController so each re-render cleanly replaces the previous listener.
   */
  _initNavListener(el) {
    this._navAbort?.abort();
    this._navAbort = new AbortController();
    document.addEventListener(AppEvents.BUILDER_NAVIGATE_TO, e => {
      if (e.detail?.nodeId !== this.id) return;
      const panel = BaseNode._svc.leftPanelBody;
      if (panel) {
        const top = el.getBoundingClientRect().top
          - panel.getBoundingClientRect().top
          + panel.scrollTop - 10;
        panel.scrollTo({ top, behavior: 'smooth' });
      } else {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      el.classList.add('node-flash');
      setTimeout(() => el.classList.remove('node-flash'), 1000);
    }, { signal: this._navAbort.signal });
  }

  /** Triggers renderTree() in builder/index.js */
  _dispatchRerender() {
    document.dispatchEvent(new CustomEvent(AppEvents.BUILDER_RERENDER));
  }

  /** Navigates the right-panel preview to this node */
  _dispatchNavigate() {
    document.dispatchEvent(new CustomEvent(AppEvents.BUILDER_NAVIGATE, { detail: { id: this.id } }));
  }

  // ── Preview row factory & scroll-to listener ───────────────────────────────

  /**
   * Create a preview row div, register it as this._previewEl, and return it.
   * All three render paths (_renderDimmed, _renderDisabled, _createBaseRow) go through
   * here so _previewEl always points to the most-recently rendered element.
   */
  _makePreviewRow(className) {
    const row = document.createElement('div');
    row.className = className;
    row.dataset.previewId = this.id;
    this._previewEl = row;
    if (this._scrollAfterRender) {
      this._scrollAfterRender = false;
      // rAF fires after lform.appendChild(frag) so the element is in the live DOM
      requestAnimationFrame(() => this._scrollIntoView());
    }
    return row;
  }

  _scrollIntoView() {
    if (!this._previewEl || !document.contains(this._previewEl)) return;
    this._previewEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    this._previewEl.classList.add('preview-flash');
    setTimeout(() => this._previewEl?.classList.remove('preview-flash'), 1000);
  }

  /**
   * Wire the PREVIEW_NAVIGATE_TO listener for this node instance.
   * Called once from the constructor (with a DOM guard for test environments).
   * If _previewEl is already in DOM — scroll immediately.
   * Otherwise set _scrollAfterRender so _makePreviewRow scrolls after the next render.
   */
  _initPreviewNavListener() {
    document.addEventListener(AppEvents.PREVIEW_NAVIGATE_TO, e => {
      if (e.detail?.id !== this.id) return;
      if (this._previewEl && document.contains(this._previewEl)) {
        this._scrollIntoView();
      } else {
        this._scrollAfterRender = true;
        // Fallback: element may be in a fragment about to be appended
        requestAnimationFrame(() => {
          if (this._scrollAfterRender && this._previewEl && document.contains(this._previewEl)) {
            this._scrollAfterRender = false;
            this._scrollIntoView();
          }
        });
      }
    }, { signal: this._ac.signal });
  }
}
