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
    for (const ch of group.children) {
      const th = document.createElement('th');
      th.className = 'gtable-th';
      th.textContent = ch.title || ch.id;
      if (ch.mandatory === true) {
        const star = document.createElement('span');
        star.className  = 'gtable-required-star';
        star.textContent = ' *';
        th.appendChild(star);
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
}
