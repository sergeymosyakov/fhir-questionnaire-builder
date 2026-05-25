// ── GroupNode ─────────────────────────────────────────────────────────────────
// Represents a FHIR Questionnaire group item (type: 'group').
// Children are other GroupNode or ItemNode instances.
// Optional FHIR-imported properties set after construction:
//   _collapsible, _renderXhtml, _renderStyle, _prefix, _definition,
//   _codes, _supportLinks, _hidden, _designNote, _unknownExtensions
import { BaseNode } from './base-node.js';
import { isDescendant } from '../utils.js';

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
      if (childRes) rc.renderNode(childRes, nested);
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
        rc.renderNode(childRes, nested);
        if (childRes.visible) firstVisible = false;
      }
    }
    if (nested.childElementCount > 0) target.appendChild(nested);
  }
}
