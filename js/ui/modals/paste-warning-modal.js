// ── Paste Warning modal ───────────────────────────────────────────────────────
// Shown after a paste operation when:
//   (a) expressions in pasted items reference linkIds outside the copied subtree, or
//   (b) expressions elsewhere in the questionnaire query tree structure
//       (.descendants(), .count(), .item.where(type=…)) and may behave differently
//       now that new items have been added.
//
// Read-only — only a "Got it" dismiss button.
import { MODAL_REGISTRY } from './modal-registry.js';
import { Modal } from './modal-base.js';

class PasteWarningModal extends Modal {
  getName() { return 'pasteWarningModal'; }

  constructor() {
    super({ cancelLabel: 'Got it', applyLabel: null, maxWidth: '660px' });
    MODAL_REGISTRY.set('pasteWarning', this);
  }

  /**
   * @param {Array<{linkId,type,expr}>} externalRefs   — exprs in pasted items referencing external linkIds
   * @param {Array<{linkId,type,expr}>} structuralHits — exprs in whole tree using structural queries
   */
  open(externalRefs, structuralHits) {
    this.setTitle('Paste — Expression Review');
    this.body.innerHTML = '';
    this._renderBody(externalRefs, structuralHits);
    super.open();
  }

  _cancel() { this.close(); }

  _renderBody(externalRefs, structuralHits) {
    if (externalRefs.length) {
      this._renderSection(
        'Expressions in pasted items referencing external linkIds',
        'These expressions contain linkId references that point to items outside the pasted group. They still reference the original items — verify they are still correct.',
        externalRefs,
      );
    }
    if (structuralHits.length) {
      this._renderSection(
        'Expressions querying tree structure',
        'These expressions use .descendants(), .count(), or .item.where(type=…) and may behave differently now that new items have been added.',
        structuralHits,
      );
    }
  }

  _renderSection(heading, hint, rows) {
    const h = document.createElement('h4');
    h.className = 'paste-warn-heading';
    h.textContent = heading;
    this.body.appendChild(h);

    const p = document.createElement('p');
    p.className = 'paste-warn-hint';
    p.textContent = hint;
    this.body.appendChild(p);

    const table = document.createElement('table');
    table.className = 'paste-warn-table';

    const thead = document.createElement('thead');
    thead.innerHTML = '<tr><th>linkId</th><th>Type</th><th>Expression</th></tr>';
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    for (const { linkId, type, expr } of rows) {
      const tr = document.createElement('tr');
      const tdId   = document.createElement('td');
      const tdType = document.createElement('td');
      const tdExpr = document.createElement('td');
      tdId.className   = 'paste-warn-id';
      tdType.className = 'paste-warn-type';
      tdExpr.className = 'paste-warn-expr';
      tdId.textContent   = linkId;
      tdType.textContent = type;
      tdExpr.textContent = expr;
      tr.append(tdId, tdType, tdExpr);
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    this.body.appendChild(table);
  }
}
new PasteWarningModal();
