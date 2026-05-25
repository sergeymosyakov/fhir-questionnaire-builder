import { MODAL_REGISTRY } from '../ui/modal-registry.js';
// ── GroupNode ─────────────────────────────────────────────────────────────────
// Represents a FHIR Questionnaire group item (type: 'group').
// Children are other GroupNode or ItemNode instances.
// Optional FHIR-imported properties set after construction:
//   _collapsible, _renderXhtml, _renderStyle, _prefix, _definition,
//   _codes, _supportLinks, _hidden, _designNote, _unknownExtensions
import { BaseNode } from './base-node.js';
import { isDescendant } from '../utils.js';
import { NODE_REGISTRY } from './registry.js';

export class GroupNode extends BaseNode {
  constructor(data = {}) {
    super(data);
    this.type            = 'group';
    this.logicWithParent = data.logicWithParent ?? 'AND';
    this.children        = data.children        ?? [];
  }

  // ── Condition icon logic for groups ──────────────────────────────────────
  _evalCondition(res, rc) {
    const descendantItems = rc.visible.filter(r =>
      r.node.type === 'item' && !r.disabled && !r.hidden && isDescendant(r.node.id, this)
    );
    const relevantItems = descendantItems.filter(r =>
      (rc.isMandatory(r.node) && rc.CHECKABLE_TYPES.has(r.node.itemType)) ||
      (r.node._calculatedExpr && r.node._readOnly && r.node.itemType === 'checkbox') ||
      r.node.constraint?.length > 0 ||
      (r.node._minValue !== undefined || r.node._maxValue !== undefined)
    );
    if (relevantItems.length === 0) return { hasCondition: false, displayOk: true };
    const { ctx, cEnv } = rc;
    const itemOk = k => k.ok && rc.calcFormOk(k.node) &&
      (!k.node.constraint?.length || rc.evalConstraints(k.node, ctx.fp, ctx.qr, cEnv));
    const displayOk = this.logicWithParent === 'OR'
      ? relevantItems.some(itemOk)
      : relevantItems.every(itemOk);
    return { hasCondition: true, displayOk };
  }

  // ── Re-evaluate pass/fail icon for this group after a value change ────────
  // Called by render-node.js updateGroupIcons() which iterates groupIconMap.
  refreshIcon(rc) {
    const entry = rc.groupIconMap.get(this.id);
    if (!entry) return;
    const { icon, descendants } = entry;
    const relevant = descendants.filter(r =>
      (rc.isMandatory(r.node) && rc.CHECKABLE_TYPES.has(r.node.itemType)) ||
      (r.node._calculatedExpr && r.node._readOnly && r.node.itemType === 'checkbox') ||
      r.node.constraint?.length > 0 ||
      (r.node._minValue !== undefined || r.node._maxValue !== undefined)
    );
    if (relevant.length === 0) {
      icon.className   = 'icon-ok';
      icon.textContent = '\u2713';
      return;
    }
    const { ctx } = rc;
    const itemOk = k => k.ok && rc.calcFormOk(k.node) &&
      (!k.node.constraint?.length || rc.evalConstraints(k.node, ctx.fp, ctx.qr, ctx.envVars || {}));
    const ok = this.logicWithParent === 'OR'
      ? relevant.some(itemOk)
      : relevant.every(itemOk);
    icon.className   = ok ? 'icon-ok' : 'icon-fail';
    icon.textContent = ok ? '\u2713' : '\u2717';
  }

  // ── Label: group-label class, XHTML support ───────────────────────────────
  _buildLabel() {
    const isEmptyGroup = this.children.length === 0;
    const el = document.createElement('span');
    el.className = isEmptyGroup ? 'display-info-label' : 'group-label';
    this._applyLabelContent(el);
    return el;
  }

  // ── Row content: super + logic badge + collapse toggle (groups with children) ─
  _buildRowContent(row, res, rc) {
    super._buildRowContent(row, res, rc);
    const isPatient = rc.previewMode === 'patient';
    const isEmptyGroup = this.children.length === 0;

    if (!isPatient && !isEmptyGroup) {
      const isOr = this.logicWithParent === 'OR';
      const lb = document.createElement('span');
      lb.className = 'preview-logic-badge preview-logic-' + (isOr ? 'or' : 'and');
      lb.textContent = isOr ? 'ANY item \u2713' : 'ALL items \u2713';
      lb.dataset.tipTitle = isOr ? 'Any item passes (OR)' : 'All items required (AND)';
      lb.dataset.tipBody = isOr
        ? 'Group is satisfied if at least one child item has a valid answer.\nStored in FHIR as a questionnaire-constraint with key e3a8c2f1\u2026:group-or.'
        : 'Group is satisfied only when all child items have valid answers.\nThis is the default FHIR behaviour \u2014 no extra constraint is generated.';
      lb.dataset.tipFhir = isOr ? 'questionnaire-constraint (key: ITLH_NS:group-or)' : 'item.required (default AND)';
      lb.dataset.tipSpec = 'R4';
      row.appendChild(lb);
    }

    if (!isEmptyGroup) {
      const collapsed = rc.collapsedGroups.has(this.id);
      const toggle = document.createElement('span');
      toggle.className = 'preview-collapse-toggle';
      toggle.textContent = collapsed ? '\u25B6' : '\u25BC';
      toggle.title = collapsed ? 'Expand section' : 'Collapse section';
      const nodeId = this.id;
      toggle.addEventListener('click', e => {
        e.stopPropagation();
        if (rc.collapsedGroups.has(nodeId)) rc.collapsedGroups.delete(nodeId);
        else rc.collapsedGroups.add(nodeId);
        rc.formTick.value++;
      });
      row.insertBefore(toggle, row.firstChild);
    }
  }

  // ── Dimmed/disabled: also render children to keep counts in sync ─────────
  _renderDimmedChildren(res, container, rc) {
    this._renderNestedChildren(res, container, rc);
  }

  _renderDisabledChildren(res, container, rc) {
    this._renderNestedChildren(res, container, rc);
  }

  _renderNestedChildren(res, container, rc) {
    if (this.children.length === 0) return;
    const nested = document.createElement('div');
    nested.className = 'preview-nested';
    for (const ch of this.children) {
      const childRes = rc.resultMap.get(ch.id);
      if (childRes) BaseNode.dispatch(childRes, nested, rc);
    }
    if (nested.childElementCount > 0) container.appendChild(nested);
  }

  // ── Children: register groupIconMap, render expanded children with separators ─
  _renderChildren(res, target, rc) {
    if (this.children.length === 0) return;
    const { iconEl } = res;

    // Register this group in groupIconMap for icon refresh on value change.
    const descendants = rc.visible.filter(r =>
      r.node.type === 'item' && !r.disabled && !r.hidden && isDescendant(r.node.id, this)
    );
    if (iconEl) rc.groupIconMap.set(this.id, { icon: iconEl, descendants, node: this });

    if (rc.collapsedGroups.has(this.id)) return;

    const nested = document.createElement('div');
    nested.className = 'preview-nested';
    const logic = this.logicWithParent || 'AND';
    let firstVisible = true;
    for (const ch of this.children) {
      const childRes = rc.resultMap.get(ch.id);
      if (childRes && childRes.hidden && (rc.previewMode === 'patient' || !rc.viewPrefs.showHiddenItems)) continue;
      if (childRes && (childRes.visible || childRes.showDimmed)) {
        if (!firstVisible && childRes.visible) {
          const sep = document.createElement('div');
          sep.className = 'logic-separator logic-separator-' + logic.toLowerCase();
          sep.textContent = logic;
          nested.appendChild(sep);
        }
        BaseNode.dispatch(childRes, nested, rc);
        if (childRes.visible) firstVisible = false;
      }
    }
    if (nested.childElementCount > 0) target.appendChild(nested);
  }

  // Refresh pass/fail icons on every rendered group.
  // Called from render-preview.js via _rc.updateGroupIcons after a value change.
  static updateAll(rc) {
    for (const [, { node }] of rc.groupIconMap.entries()) {
      node.refreshIcon(rc);
    }
  }

  // ── Builder panel ─────────────────────────────────────────────────────────
  // Renders the left-panel (builder tree) row for this group node.
  // All external deps (modals, DnD, utils) are injected via ctx.
  buildBuilder(ctx) {
    const node = this;
    const { renderTree, renderNode } = ctx;

    const wrapper = document.createElement('div');
    wrapper.className = 'node-wrap';

    const div = document.createElement('div');
    div.className = 'node node-group';
    div.dataset.nodeId = node.id;

    const dropAbove = document.createElement('div');
    dropAbove.className = 'drop-zone drop-zone-above';
    dropAbove.textContent = 'Drop here';
    ctx.attachDropZone(dropAbove, node, 'before');
    wrapper.appendChild(dropAbove);

    const header = document.createElement('div');
    header.className = 'node-header';

    const titleWrap = document.createElement('div');
    titleWrap.className = 'node-title';

    const collapsed = ctx.collapsed.get(node.id) || false;
    const toggleBtn = document.createElement('button');
    toggleBtn.type = 'button';
    toggleBtn.className = 'node-collapse-btn';
    toggleBtn.dataset.testid = 'group-collapse-btn';
    toggleBtn.textContent = collapsed ? '\u25B6' : '\u25BC';
    toggleBtn.title = collapsed ? 'Expand' : 'Collapse';
    toggleBtn.onclick = e => {
      e.stopPropagation();
      const isNowCollapsed = !(ctx.collapsed.get(node.id) || false);
      ctx.collapsed.set(node.id, isNowCollapsed);
      toggleBtn.textContent = isNowCollapsed ? '\u25B6' : '\u25BC';
      toggleBtn.title = isNowCollapsed ? 'Expand' : 'Collapse';
      const body = div.querySelector('.node-body');
      if (body) body.style.display = isNowCollapsed ? 'none' : '';
    };
    titleWrap.appendChild(toggleBtn);
    titleWrap.insertBefore(ctx.makeDragHandle(node), titleWrap.firstChild);

    const isEmptyGroupNode = node.children.length === 0;
    const typeLabel = document.createElement('span');
    typeLabel.className = 'node-type-label ' + (isEmptyGroupNode ? 'lbl-info' : 'lbl-group');
    typeLabel.dataset.testid = 'node-type-label';
    typeLabel.textContent = isEmptyGroupNode ? '[Info]' : '[Group]';
    titleWrap.appendChild(typeLabel);

    const linkIdInput = document.createElement('input');
    linkIdInput.type = 'text';
    linkIdInput.value = node.id;
    linkIdInput.className = 'node-linkid-input';
    linkIdInput.dataset.tipTitle = 'FHIR linkId';
    linkIdInput.dataset.tipBody  = 'Editable. Must be unique within the questionnaire.';
    linkIdInput.oninput = () => { node.id = linkIdInput.value.trim() || node.id; };

    const prefixInput = document.createElement('input');
    prefixInput.type = 'text';
    prefixInput.value = node._prefix || '';
    prefixInput.className = 'node-prefix-input';
    prefixInput.placeholder = '\u2014';
    prefixInput.dataset.tipTitle = 'Display prefix';
    prefixInput.dataset.tipBody  = 'Cosmetic only \u2014 e.g. "1.". Does not affect logic or linkId.';
    prefixInput.oninput = () => { node._prefix = prefixInput.value.trim() || undefined; };

    const titleRow = document.createElement('div');
    titleRow.className = 'node-title-row';
    const titleDisplay = document.createElement('span');
    titleDisplay.className = 'node-title-display';
    titleDisplay.dataset.testid = 'node-title-display';
    titleDisplay.textContent = node.title || '(no title)';
    const titleTextarea = document.createElement('textarea');
    titleTextarea.className = 'node-title-textarea';
    titleTextarea.dataset.testid = 'node-title-input';
    titleTextarea.value = node.title;
    titleTextarea.style.display = 'none';
    titleTextarea.oninput = () => { node.title = titleTextarea.value; titleDisplay.textContent = titleTextarea.value || '(no title)'; };
    titleTextarea.onblur = () => { titleTextarea.style.display = 'none'; titleDisplay.style.display = ''; };
    titleDisplay.addEventListener('click', e => {
      e.stopPropagation();
      const h = titleDisplay.offsetHeight;
      titleDisplay.style.display = 'none';
      titleTextarea.style.display = '';
      titleTextarea.style.height = Math.max(h, 48) + 'px';
      titleTextarea.focus();
      titleTextarea.setSelectionRange(titleTextarea.value.length, titleTextarea.value.length);
    });
    titleRow.appendChild(titleDisplay);
    titleRow.appendChild(titleTextarea);

    titleWrap.addEventListener('click', e => {
      if (e.target === titleTextarea || e.target === titleDisplay || e.target === linkIdInput || e.target === prefixInput) return;
      ctx.navigateToPreview(node.id);
    });

    const actions = document.createElement('div');
    actions.className = 'node-actions';
    const panels = {};
    let openKey = null;

    const addToggle = (label, key, tipTitle, tipBody, tipFhir, tipSpec) => {
      const a = document.createElement('a');
      a.textContent = label;
      a.className = 'action-edit';
      a.dataset.testid = 'action-' + key;
      if (tipTitle) a.dataset.tipTitle = tipTitle;
      if (tipBody)  a.dataset.tipBody  = tipBody;
      if (tipFhir)  a.dataset.tipFhir  = tipFhir;
      if (tipSpec)  a.dataset.tipSpec  = tipSpec;
      a.onclick = () => {
        openKey = openKey === key ? null : key;
        for (const k of Object.keys(panels)) panels[k].style.display = openKey === k ? 'block' : 'none';
      };
      actions.appendChild(a);
      return a;
    };
    const setActive = (el, active) => el.classList.toggle('action-edit--active', active);

    const statesLink = document.createElement('a');
    statesLink.textContent = 'States';
    statesLink.className = 'action-edit';
    statesLink.dataset.tipTitle = 'Item / group states';
    statesLink.dataset.tipBody  = 'Required \u2014 must be answered to pass validation.\nHidden \u2014 excluded from patient view; participates in logic.\nCollapsible \u2014 group starts collapsed or expanded in patient view.';
    statesLink.dataset.tipFhir  = 'item.required / sdc-questionnaire-hidden / sdc-questionnaire-collapsible';
    statesLink.dataset.tipSpec  = 'R4 \u00B7 SDC';
    statesLink.dataset.testid   = 'action-states';
    statesLink.onclick = () => MODAL_REGISTRY.get('states').open(node, statesLink, setActive);
    actions.appendChild(statesLink);

    const visLink = addToggle('Show When', 'vis',
      'Show When (enableWhen)',
      'Add enableWhen conditions to control when this group is visible. Supports FHIR R4 enableWhen[] (AND/OR) and SDC enableWhenExpression (FHIRPath). Hidden groups are dimmed \uD83D\uDD12 in the preview.',
      'Questionnaire.item.enableWhen[]', 'R4 \u00B7 optional');
    visLink.onclick = () => MODAL_REGISTRY.get('showWhen').open(node, visLink, setActive, ctx, ctx.buildVisPanel);

    const exprLink = addToggle('Expression', 'expr',
      'Calculated Expression',
      'SDC FHIRPath calculatedExpression on this group item. Evaluated on Test click. Supports questionnaire-level %variables.',
      'sdc-questionnaire-calculatedExpression', 'SDC \u00B7 optional');
    exprLink.onclick = () => MODAL_REGISTRY.get('expression').open({
      node, link: exprLink, setActive,
      field:       '_calculatedExpr',
      label:       'Calculated Expression',
      fhirLabel:   'FHIRPath calculatedExpression:',
      placeholder: "%resource.item.where(linkId='...')",
      onApply:     ctx.triggerCalcRecalc,
    });

    const styleLink = addToggle('Appearance', 'style',
      'Appearance (rendering-style)',
      'Inline CSS applied to the group title in the preview. Stored in the standard FHIR rendering-style extension on the _text element.',
      'Questionnaire.item._text.extension[rendering-style]', 'R4 \u00B7 optional');

    const propsLink = document.createElement('a');
    propsLink.textContent = 'Props';
    propsLink.className = 'action-edit';
    propsLink.dataset.tipTitle = 'Group Properties';
    propsLink.dataset.tipBody  = 'Edit group-level metadata: definition URL, terminology codes (item.code[]) and support links (questionnaire-supportLink).';
    propsLink.dataset.tipFhir  = 'Questionnaire.item.definition / item.code[] / questionnaire-supportLink';
    propsLink.dataset.tipSpec  = 'R4 \u00B7 optional';
    propsLink.dataset.testid   = 'action-codes';
    propsLink.onclick = () => MODAL_REGISTRY.get('codes').open(node, propsLink, setActive);
    actions.appendChild(propsLink);

    const noteLink = document.createElement('a');
    noteLink.textContent = 'Note';
    noteLink.className = 'action-edit';
    noteLink.dataset.tipTitle = 'Design Note';
    noteLink.dataset.tipBody  = 'Internal author note \u2014 stored as FHIR designNote extension. Never shown to patients.';
    noteLink.dataset.tipFhir  = 'http://hl7.org/fhir/StructureDefinition/designNote';
    noteLink.dataset.tipSpec  = 'R4 \u00B7 optional';
    noteLink.dataset.testid   = 'action-note';
    noteLink.onclick = () => MODAL_REGISTRY.get('note').open(node, noteLink, setActive);
    setActive(noteLink, !!node._designNote);
    actions.appendChild(noteLink);

    // ⊕ Add ▾ dropdown
    const addWrap = document.createElement('div');
    addWrap.className = 'action-add-wrap';
    const addBtn = document.createElement('button');
    addBtn.className = 'action-add-btn';
    addBtn.dataset.testid = 'group-add-btn';
    addBtn.innerHTML = '&#x2295; Add &#x25BE;';
    const addMenu = document.createElement('div');
    addMenu.className = 'action-add-menu';
    addMenu.style.display = 'none';

    const addChild = (label, factory) => {
      const mi = document.createElement('div');
      mi.className = 'action-add-menu-item';
      mi.dataset.testid = 'add-menu-' + label.toLowerCase();
      mi.textContent = label;
      mi.onclick = () => {
        addMenu.style.display = 'none';
        const newNode = factory();
        node.children.push(newNode);
        ctx.formTick.value++;
        ctx.collapsed.set(node.id, false);
        renderTree();
        requestAnimationFrame(() => {
          const el = document.querySelector('[data-node-id="' + newNode.id + '"]');
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            el.classList.add('node-flash');
            setTimeout(() => el.classList.remove('node-flash'), 1000);
          }
        });
      };
      addMenu.appendChild(mi);
    };

    addChild('Group', () => {
      const n = ctx.createGroupNode({ title: 'New Group' });
      n.id = node.id + '.' + ctx.formatSeg(node.children.length + 1);
      return n;
    });
    addChild('Item', () => {
      const siblings = node.children.filter(c => c.type === 'item');
      const template = siblings.length > 0 ? siblings[siblings.length - 1] : null;
      const n = ctx.createItemNodeFromTemplate('New Item', template);
      n.id = node.id + '.' + ctx.formatSeg(node.children.length + 1);
      return n;
    });

    addBtn.onclick = e => {
      e.stopPropagation();
      const open = addMenu.style.display !== 'none';
      document.querySelectorAll('.action-add-menu').forEach(m => { m.style.display = 'none'; });
      addMenu.style.display = open ? 'none' : 'block';
    };
    addWrap.appendChild(addBtn);
    addWrap.appendChild(addMenu);
    actions.appendChild(addWrap);

    const headerTop = document.createElement('div');
    headerTop.className = 'node-header-top';
    headerTop.appendChild(titleWrap);

    const metaRow = document.createElement('div');
    metaRow.className = 'node-meta-row';
    const prefixLbl = document.createElement('span');
    prefixLbl.className = 'node-meta-label node-meta-label--prefix';
    prefixLbl.textContent = 'prefix:';
    const idLbl = document.createElement('span');
    idLbl.className = 'node-meta-label node-meta-label--id';
    idLbl.textContent = 'id:';
    metaRow.appendChild(idLbl);
    metaRow.appendChild(linkIdInput);
    metaRow.appendChild(prefixLbl);
    metaRow.appendChild(prefixInput);

    header.appendChild(headerTop);
    header.appendChild(metaRow);
    header.appendChild(titleRow);
    header.appendChild(actions);

    const btnDel = document.createElement('button');
    btnDel.textContent = '\u2715';
    btnDel.className = 'btn-node-delete';
    btnDel.dataset.testid = 'node-delete-btn';
    btnDel.dataset.tipTitle = 'Delete group';
    btnDel.onclick = async () => {
      const ok = await ctx.confirmDelete(node.title || node.id);
      if (ok) { ctx.findAndRemove(node.id, ctx.tree); renderTree(); }
    };

    div.appendChild(header);
    div.appendChild(btnDel);

    ctx.addPanel('style', p => ctx.buildStylePanel(node, p, styleLink, setActive, ctx), div, panels);

    setActive(visLink,    !!(node.enableWhen?.length) || !!node.enableWhenExpression);
    setActive(exprLink,   !!node._calculatedExpr);
    setActive(styleLink,  !!(node._renderStyle || node._renderXhtml));
    setActive(statesLink, node.mandatory === true || !!node._hidden || !!node._collapsible);
    setActive(propsLink,  !!(node._codes?.length) || !!node._definition || !!(node._supportLinks?.length));

    const body = document.createElement('div');
    body.className = 'node-body';
    if (ctx.collapsed.get(node.id)) body.style.display = 'none';

    const logicRow = document.createElement('div');
    logicRow.className = 'logic-row';
    logicRow.textContent = 'Logic between children: ';
    const logicSel = ctx.createCustomSelect({
      items:    [{ value: 'AND', label: 'AND' }, { value: 'OR', label: 'OR' }],
      value:    node.logicWithParent || 'AND',
      className: 'sc-trigger--sm',
      onChange: v => { node.logicWithParent = v; },
    });
    logicRow.appendChild(logicSel.el);
    body.appendChild(logicRow);

    for (let i = 0; i < node.children.length; i++) {
      const childWrap = renderNode(node.children[i]);
      if (i === 0) {
        const firstDrop = childWrap.querySelector('.drop-zone-above');
        if (firstDrop) firstDrop.textContent = 'Drop here to add as first child';
      }
      body.appendChild(childWrap);
    }

    const dropInside = document.createElement('div');
    dropInside.className = 'drop-zone drop-zone-inside';
    dropInside.textContent = 'Drop here to add as last child';
    ctx.attachDropZone(dropInside, node, 'inside-last');
    body.appendChild(dropInside);

    div.appendChild(body);
    wrapper.appendChild(div);
    return wrapper;
  }
}

NODE_REGISTRY.set('group', GroupNode);
