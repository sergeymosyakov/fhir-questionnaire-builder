import { NODE_REGISTRY } from './registry.js';
import { GTableRenderer } from './gtable-renderer.js';
// ── GroupNode ─────────────────────────────────────────────────────────────────
// Represents a FHIR Questionnaire group item (type: 'group').
// Children are other GroupNode or ItemNode instances.
// Optional FHIR-imported properties set after construction:
//   _collapsible, _renderXhtml, _renderStyle, _prefix, _definition,
//   _codes, _supportLinks, _hidden, _designNote, _unknownExtensions
import { BaseNode, isRelevantItem } from './base-node.js';
import { isDescendant } from '../utils.js';

export class GroupNode extends BaseNode {
  /** Backward-compat: delegates to BaseNode._collapseMap (shared with ItemNode). */
  static get _collapseMap() { return BaseNode._collapseMap; }

  constructor(data = {}) {
    super(data);
    this.type            = 'group';
    this.logicWithParent = data.logicWithParent ?? 'AND';
    this.children        = data.children        ?? [];
    this.repeats         = data.repeats         ?? false;
    // _previewCollapsed and COLLAPSE_ALL/EXPAND_ALL/BUILDER_NAVIGATE listeners
    // are inherited from BaseNode constructor.
  }

  /** Abort own listeners and recursively destroy children. */
  destroy() {
    super.destroy();
    this.children.forEach(c => c.destroy());
  }

  // ── Condition icon logic for groups ──────────────────────────────────────
  _evalCondition(res, rc) {
    // A group with its own calculatedExpression is a computed value — its
    // children do not determine it, so don't aggregate them. Reflect the group's
    // own state instead: honour its own constraint if present, otherwise show no
    // aggregate icon.
    if (this._calculatedExpr) {
      if (this.constraint?.length) {
        const { ctx: rcCtx, cEnv: rcCEnv } = rc;
        return { hasCondition: true, displayOk: rc.evalConstraints(this, rcCtx.fp, rcCtx.qr, rcCEnv) };
      }
      return { hasCondition: false, displayOk: true };
    }
    const descendantItems = rc.visible.filter(r =>
      r.node.type === 'item' && !r.disabled && !r.hidden && isDescendant(r.node.id, this)
    );
    const relevantItems = descendantItems.filter(r => isRelevantItem(r.node, rc));
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
    const { ctx } = rc;
    // Calculated group: its own expression drives it, children are irrelevant.
    if (this._calculatedExpr) {
      if (this.constraint?.length) {
        const ok = rc.evalConstraints(this, ctx.fp, ctx.qr, ctx.envVars || {});
        icon.className   = ok ? 'icon-ok' : 'icon-fail';
        icon.textContent = ok ? '\u2713' : '\u2717';
      } else {
        icon.className   = 'icon-ok';
        icon.textContent = '\u2713';
      }
      return;
    }
    const relevant = descendants.filter(r => isRelevantItem(r.node, rc));
    if (relevant.length === 0) {
      icon.className   = 'icon-ok';
      icon.textContent = '\u2713';
      return;
    }
    const itemOk = k => k.ok && rc.calcFormOk(k.node) &&
      (!k.node.constraint?.length || rc.evalConstraints(k.node, ctx.fp, ctx.qr, ctx.envVars || {}));
    const ok = this.logicWithParent === 'OR'
      ? relevant.some(itemOk)
      : relevant.every(itemOk);
    icon.className   = ok ? 'icon-ok' : 'icon-fail';
    icon.textContent = ok ? '\u2713' : '\u2717';
  }

  // ── Label: group-label class, XHTML support ───────────────────────────────
  _buildLabel(_res, rc) {
    const isEmptyGroup = this.children.length === 0;
    const el = document.createElement('span');
    el.className = (isEmptyGroup ? 'display-info-label' : 'group-label') + ' item-label';
    this._applyLabelContent(el, rc);
    return el;
  }

  // ── Row content: super + logic badge + collapse toggle (groups with children) ─
  _buildRowContent(row, res, rc) {
    super._buildRowContent(row, res, rc);
    const body = row._itemBody;
    const isPatient = rc.previewMode === 'patient';
    const isEmptyGroup = this.children.length === 0;

    // questionnaire-itemControl header / footer — styled group band
    if (this._itemControl === 'header' || this._itemControl === 'footer') {
      row.classList.add('lform-group-' + this._itemControl);
      if (!isPatient) {
        const badge = document.createElement('span');
        badge.className = 'preview-group-ctrl-badge';
        badge.textContent = this._itemControl;
        badge.dataset.tipTitle = this._itemControl === 'header' ? 'Group header' : 'Group footer';
        badge.dataset.tipBody = this._itemControl === 'header'
          ? 'This group is rendered as a header — continuously visible at the top of the questionnaire.'
          : 'This group is rendered as a footer — continuously visible at the bottom of the questionnaire.';
        badge.dataset.tipFhir = 'item.extension[questionnaire-itemControl].valueCodeableConcept.coding.code = ' + this._itemControl;
        badge.dataset.tipSpec = 'R4';
        body.appendChild(badge);
      }
    }

    // questionnaire-itemControl gtable — table layout badge
    if (this._itemControl === 'gtable' && !isPatient) {
      const badge = document.createElement('span');
      badge.className = 'preview-group-ctrl-badge preview-group-ctrl-badge--gtable';
      badge.textContent = 'gtable';
      badge.dataset.testid = 'gtable-badge';
      badge.dataset.tipTitle = 'Group table layout (gtable)';
      badge.dataset.tipBody = 'This group is rendered as a table — each child item is a column, each repeat instance is a row.';
      badge.dataset.tipFhir = 'item.extension[questionnaire-itemControl].valueCodeableConcept.coding.code = gtable';
      badge.dataset.tipSpec = 'R4 · SDC';
      body.appendChild(badge);
    }

    // Repeatable group badge (item.repeats on a group)
    if (this.repeats && !isPatient) {
      const rb = document.createElement('span');
      rb.className = 'preview-group-ctrl-badge';
      rb.textContent = 'Repeatable';
      rb.dataset.tipTitle = 'Repeatable group';
      rb.dataset.tipBody = 'This group repeats \u2014 the respondent can add multiple entries.';
      rb.dataset.tipFhir = 'Questionnaire.item.repeats';
      rb.dataset.tipSpec = 'R4';
      body.appendChild(rb);
    }

    if (!isPatient && !isEmptyGroup) {
      // Show the AND/OR "ALL/ANY items" badge only when the group's children
      // actually govern its pass/fail — i.e. it has no calculatedExpression of
      // its own and has at least one enforceable descendant. Otherwise the badge
      // is meaningless (nothing is being combined).
      if (this._hasChildLogic(rc)) {
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
        body.appendChild(lb);
      }
    }

    if (!isEmptyGroup) {
      this._buildPreviewCollapseToggle(row);
    }
  }

  // ── Dimmed/disabled: also render children to keep counts in sync ─────────
  _renderDimmedChildren(res, container, rc) {
    if (this._previewCollapsed) return;
    this._renderNestedChildren(res, container, rc);
  }

  _renderDisabledChildren(res, container, rc) {
    if (this._previewCollapsed) return;
    this._renderNestedChildren(res, container, rc);
  }

  // ── Children: register groupIconMap, render expanded children with separators ─
  _renderChildren(res, target, rc) {
    if (this.children.length === 0) return;
    const iconEl = res._iconEl;

    // Register this group in groupIconMap for icon refresh on value change.
    const descendants = rc.visible.filter(r =>
      r.node.type === 'item' && !r.disabled && !r.hidden && isDescendant(r.node.id, this)
    );
    if (iconEl) rc.groupIconMap.set(this.id, { icon: iconEl, descendants, node: this });

    if (this._previewCollapsed) return;

    // questionnaire-itemControl gtable — render as table (takes priority over repeats,
    // because GTableRenderer handles repeating rows itself when group.repeats is true)
    if (this._itemControl === 'gtable') {
      new GTableRenderer(this).render(target, rc, rc.instancePath || []);
      return;
    }

    if (this.repeats) { this._renderInstances(target, rc); return; }

    const nested = document.createElement('div');
    nested.className = 'preview-nested';
    this._appendChildRows(nested, rc);
    if (nested.childElementCount > 0) target.appendChild(nested);
  }

  // Repeating group: render N instance blocks, each evaluated & rendered with its
  // own instance path so values / enableWhen / validation are scoped per entry.
  _renderInstances(target, rc) {
    const parentPath = rc.instancePath || [];
    const min = (this._minOccurs && this._minOccurs > 0) ? this._minOccurs : 1;
    let count = rc.instanceCount(this.id, parentPath);
    while (count < min) { rc.addInstance(this.id, parentPath); count++; }

    const wrap = document.createElement('div');
    wrap.className = 'preview-nested rg-instances';
    wrap.dataset.rgGroup = this.id;    // e.g. data-rg-group="meds", "schedule"

    const saved = { map: rc.resultMap, visible: rc.visible, path: rc.instancePath };
    for (let i = 0; i < count; i++) {
      const instPath = [...parentPath, { id: this.id, idx: i }];
      const block = document.createElement('div');
      block.className = 'rg-inst';

      if (count > min) {
        const rm = document.createElement('button');
        rm.type = 'button';
        rm.className = 'repeat-remove-btn rg-del';
        rm.textContent = '\u00D7';
        rm.dataset.testid = 'rg-remove-btn';
        rm.dataset.tipTitle = 'Remove this entry';
        const _i = i;
        rm.onclick = () => { rc.removeInstance(this.id, _i, parentPath); BaseNode.notifyChanged(rc.bus); };
        block.appendChild(rm);
      }

      rc.instancePath = instPath;
      const instResults = rc.evalChildren(this.children, instPath);
      rc.resultMap = new Map(instResults.map(r => [r.node.id, r]));
      rc.visible   = instResults;
      this._appendChildRows(block, rc);
      rc.resultMap = saved.map; rc.visible = saved.visible; rc.instancePath = saved.path;

      wrap.appendChild(block);
    }

    const max = this._maxOccurs;
    const atMax = max !== undefined && count >= max;
    const add = document.createElement('button');
    add.type = 'button';
    add.className = 'repeat-add-btn';
    add.dataset.testid = 'rg-add-btn';
    add.textContent = '+ Add another entry';
    if (atMax) {
      add.disabled = true;
      add.dataset.tipTitle = 'Maximum ' + max + ' entr' + (max === 1 ? 'y' : 'ies') + ' reached';
    }
    add.onclick = () => { if (!atMax) { rc.addInstance(this.id, parentPath); BaseNode.notifyChanged(rc.bus); } };
    wrap.appendChild(add);

    target.appendChild(wrap);
  }

  // Refresh pass/fail icons on every rendered group.
  // Called from preview-form.js via _rc.updateGroupIcons after a value change.
  static updateAll(rc) {
    for (const [, { node }] of rc.groupIconMap.entries()) {
      node.refreshIcon(rc);
    }
  }

  // Reset _previewCollapsed on every group node from its _collapsible FHIR value.
  // Called after import / clear so runtime UI state matches the FHIR default.
  static resetCollapsedFromTree(nodes) {
    for (const n of nodes) {
      BaseNode._collapseMap.delete(n.id);
      if (n.children?.length) {
        if (n.type === 'group') n._previewCollapsed = n._collapsible === 'default-closed';
        GroupNode.resetCollapsedFromTree(n.children);
      }
    }
  }
}

NODE_REGISTRY.set('group', GroupNode);
