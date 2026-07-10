// ── GTableRenderer — renders a group with itemControl=gtable as an HTML table ──
//
// Layout:
//   <table class="gtable">
//     <thead><tr><th>ChildTitle</th>... [<th/> action col if repeating]</tr></thead>
//     <tbody>
//       <tr><td>[control]</td>... [<td><×></td>]</tr>  × N instances
//     </tbody>
//     [<tfoot> <td colspan="N+1"><button>+ Add row</button></td> </tfoot>]
//   </table>
//
// Child ITEMS: rendered in rc.cellMode=true → control only, no label/badges.
// Child GROUPS: rendered normally via BaseNode.dispatch → each group picks its
//               own renderer (stacked, gtable, header/footer, etc.) recursively.

import { BaseNode } from './base-node.js';

export class GTableRenderer {
  /** @param {import('./group-node.js').GroupNode} group */
  constructor(group) {
    this._group = group;
  }

  /**
   * Render the group as a table into `target`.
   * @param {HTMLElement} target
   * @param {object}      rc       render context from preview-form.js
   * @param {Array}       [instancePath=[]]  parent instance path (for nested groups)
   */
  render(target, rc, instancePath = []) {
    const group = this._group;

    const table = document.createElement('table');
    table.className  = 'gtable';
    table.dataset.testid    = 'gtable';
    table.dataset.gtableId  = group.id;

    // ── Column headers ──────────────────────────────────────────────────────
    const thead     = table.createTHead();
    const headerRow = thead.insertRow();
    const isPatient = rc.previewMode === 'patient';

    for (const ch of group.children) {
      const th = document.createElement('th');
      th.className = 'gtable-th';

      // Title in its own span (first line)
      const titleSpan = document.createElement('span');
      titleSpan.className  = 'gtable-th-title';
      titleSpan.textContent = ch.title || ch.id;
      if (ch.mandatory === true) {
        const star = document.createElement('span');
        star.className   = 'gtable-required-star';
        star.textContent = ' *';
        titleSpan.appendChild(star);
      }
      th.appendChild(titleSpan);

      // Indicators in a separate sub-row below the title (design mode only)
      if (!isPatient) {
        const indRow = document.createElement('div');
        indRow.className = 'gtable-th-indicators';
        this._buildColIndicators(indRow, ch, rc);
        if (indRow.childElementCount > 0) th.appendChild(indRow);
      }

      headerRow.appendChild(th);
    }
    // Extra column for Remove buttons (only when group repeats)
    if (group.repeats) {
      const actionTh = document.createElement('th');
      actionTh.className = 'gtable-th gtable-th-action';
      headerRow.appendChild(actionTh);
    }

    // ── Data rows ───────────────────────────────────────────────────────────
    const tbody = table.createTBody();

    if (group.repeats) {
      this._renderRepeatingRows(tbody, rc, instancePath);
    } else {
      // Non-repeating gtable: single row (uses current rc.resultMap)
      const tr = tbody.insertRow();
      this._appendCells(tr, rc);
    }

    // ── Footer: Add row button ──────────────────────────────────────────────
    if (group.repeats) {
      const count = rc.instanceCount(group.id, instancePath);
      const max   = group._maxOccurs;
      const atMax = max !== undefined && count >= max;

      const tfoot  = table.createTFoot();
      const footTr = tfoot.insertRow();
      const footTd = document.createElement('td');
      footTd.colSpan  = group.children.length + 1;
      footTd.className = 'gtable-tfoot-td';

      const addBtn = document.createElement('button');
      addBtn.type         = 'button';
      addBtn.className    = 'repeat-add-btn gtable-add-btn';
      addBtn.dataset.testid = 'gtable-add-btn';
      addBtn.textContent  = '+ Add row';
      addBtn.disabled     = atMax;
      if (atMax) {
        addBtn.dataset.tipTitle = `Maximum ${max} row${max === 1 ? '' : 's'} reached`;
      }
      addBtn.addEventListener('click', () => {
        if (!atMax) { rc.addInstance(group.id, instancePath); BaseNode.notifyChanged(); }
      });

      footTd.appendChild(addBtn);
      footTr.appendChild(footTd);
    }

    target.appendChild(table);
  }

  // ── Repeating rows: one <tr> per instance ────────────────────────────────
  _renderRepeatingRows(tbody, rc, instancePath) {
    const group = this._group;
    const min = (group._minOccurs != null && group._minOccurs > 0) ? group._minOccurs : 1;
    let count = rc.instanceCount(group.id, instancePath);
    while (count < min) { rc.addInstance(group.id, instancePath); count++; }

    // Save & restore rc state around instance rendering (same pattern as _renderInstances)
    const saved = { map: rc.resultMap, visible: rc.visible, path: rc.instancePath };

    for (let i = 0; i < count; i++) {
      const instPath   = [...instancePath, { id: group.id, idx: i }];
      rc.instancePath  = instPath;
      const instResults = rc.evalChildren(group.children, instPath);
      rc.resultMap = new Map(instResults.map(r => [r.node.id, r]));
      rc.visible   = instResults;

      const tr = tbody.insertRow();
      this._appendCells(tr, rc);

      // Remove button (only when we have more than the minimum)
      const actionTd = document.createElement('td');
      actionTd.className = 'gtable-td-action';
      if (count > min) {
        const rm = document.createElement('button');
        rm.type           = 'button';
        rm.className      = 'repeat-remove-btn gtable-rm-btn';
        rm.textContent    = '×';
        rm.dataset.testid = 'gtable-remove-btn';
        rm.dataset.tipTitle = 'Remove this row';
        const _i = i;
        rm.addEventListener('click', () => {
          rc.removeInstance(group.id, _i, instancePath);
          BaseNode.notifyChanged();
        });
        actionTd.appendChild(rm);
      }
      tr.appendChild(actionTd);

      // Restore
      rc.resultMap    = saved.map;
      rc.visible      = saved.visible;
      rc.instancePath = saved.path;
    }
  }

  // ── Cell rendering: one <td> per child ───────────────────────────────────
  _appendCells(tr, rc) {
    const prevCellMode = rc.cellMode;

    for (const ch of this._group.children) {
      const td        = document.createElement('td');
      td.className    = 'gtable-td';
      const childRes  = rc.resultMap.get(ch.id);

      if (childRes) {
        // Items → cell mode (control only, no label/badges)
        // Groups → normal mode (they decide their own layout recursively)
        rc.cellMode = ch.type === 'item';
        BaseNode.dispatch(childRes, td, rc);
      }
      tr.appendChild(td);
    }

    rc.cellMode = prevCellMode;
  }

  // ── Column header indicators: per-column static metadata ─────────────────
  // Shows small icon badges in the column <th> for properties that are the same
  // for every row: enableWhen condition, readOnly, calculatedExpression,
  // constraint, support links.
  _buildColIndicators(th, ch, _rc) {
    // enableWhen / enableWhenExpression → 👁️
    if (ch.enableWhen?.length || ch.enableWhenExpression) {
      const ind = document.createElement('span');
      ind.className    = 'gtable-col-ind';
      ind.textContent  = '👁';
      ind.dataset.tipTitle = 'Conditional column';
      ind.dataset.tipBody  = ch._enableWhenText
        || ch.enableWhenExpression
        || 'This column has a Show When (enableWhen) condition.';
      ind.dataset.tipFhir  = 'Questionnaire.item.enableWhen[]';
      ind.dataset.tipSpec  = 'R4';
      th.appendChild(ind);
    }

    // readOnly → 🔒
    if (ch._readOnly && !ch._calculatedExpr) {
      const ind = document.createElement('span');
      ind.className    = 'gtable-col-ind';
      ind.textContent  = '🔒';
      ind.dataset.tipTitle = 'Read-only column';
      ind.dataset.tipBody  = 'Values in this column are read-only (item.readOnly).';
      ind.dataset.tipFhir  = 'Questionnaire.item.readOnly';
      ind.dataset.tipSpec  = 'R4';
      th.appendChild(ind);
    }

    // calculatedExpression → ⚡
    if (ch._calculatedExpr) {
      const ind = document.createElement('span');
      ind.className    = 'gtable-col-ind';
      ind.textContent  = '⚡';
      ind.dataset.tipTitle = 'Calculated column';
      ind.dataset.tipBody  = 'Values in this column are computed by: ' + ch._calculatedExpr;
      ind.dataset.tipFhir  = 'sdc-questionnaire-calculatedExpression';
      ind.dataset.tipSpec  = 'SDC';
      th.appendChild(ind);
    }

    // constraint → ⚠️
    if (ch.constraint?.length) {
      const msgs = ch.constraint.map(c => c.human || c.expression || c.key).filter(Boolean);
      const ind = document.createElement('span');
      ind.className    = 'gtable-col-ind';
      ind.textContent  = '⚠️';
      ind.dataset.tipTitle = 'Has constraint';
      ind.dataset.tipBody  = msgs.join('\n') || 'questionnaire-constraint on this column';
      ind.dataset.tipFhir  = 'Questionnaire.item.extension[questionnaire-constraint]';
      ind.dataset.tipSpec  = 'R4';
      th.appendChild(ind);
    }

    // support links → 🔗
    if (ch._supportLinks?.length) {
      const validLinks = ch._supportLinks.filter(u => u && /^https?:/i.test(u));
      for (const url of validLinks) {
        const a = document.createElement('a');
        a.className = 'gtable-col-ind support-link-icon';
        a.textContent = '🔗';
        a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer';
        a.dataset.tipTitle = 'Support link';
        a.dataset.tipBody  = url;
        a.dataset.tipFhir  = 'Questionnaire.item.extension[questionnaire-supportLink]';
        a.dataset.tipSpec  = 'R4';
        a.addEventListener('click', e => e.stopPropagation());
        th.appendChild(a);
      }
    }

    // optional badge — show when mandatory is explicitly false
    if (ch.mandatory === false && ch.type === 'item') {
      const ind = document.createElement('span');
      ind.className    = 'gtable-col-ind gtable-col-ind--optional';
      ind.textContent  = 'optional';
      ind.dataset.tipTitle = 'Optional column';
      ind.dataset.tipBody  = 'This field is not required (item.required: false).';
      ind.dataset.tipFhir  = 'Questionnaire.item.required';
      ind.dataset.tipSpec  = 'R4';
      th.appendChild(ind);
    }
  }
}
