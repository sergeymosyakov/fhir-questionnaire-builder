// ── DisplayNode ───────────────────────────────────────────────────────────────
// Represents a FHIR display item (type: 'item', itemType: 'display').
// Displays informational text — no interactive control.
// Optional FHIR-imported properties: _displayCategory ('help' | 'instructions' | 'security')
import { ItemNode } from './item-node.js';
import { NODE_REGISTRY } from './registry.js';
import { applyRenderStyle } from './base-node.js';
import { createWrap } from './base-node.js';

export class DisplayNode extends ItemNode {
  constructor(data = {}) {
    super(data);
    this.itemType = 'display';
  }

  /** Display items have no interactive control. */
  buildControl(_ctx) {
    return createWrap();
  }

  // ── Add displayCategory CSS class to the row ──────────────────────────────
  _initRowClass(row) {
    if (this._displayCategory) row.classList.add('lform-item--' + this._displayCategory);
  }

  // ── Label: help toggle or plain label with category icon ──────────────────
  _buildLabel() {
    const cat = this._displayCategory;
    if (cat === 'help') {
      // Help items: collapsible toggle button
      const wrap = document.createElement('span');
      wrap.className = 'display-help-wrap';
      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'display-help-toggle';
      toggle.dataset.testid = 'display-help-toggle';
      toggle.textContent = '? Help';
      const content = document.createElement('span');
      content.className = 'display-help-content';
      content.dataset.testid = 'display-help-content';
      content.textContent = this.title;
      toggle.addEventListener('click', () => {
        const open = content.classList.toggle('display-help-content--open');
        toggle.classList.toggle('display-help-toggle--open', open);
      });
      wrap.append(toggle, content);
      return wrap;
    }
    const el = document.createElement('span');
    this._applyLabelContent(el);
    return el;
  }

  // ── Row content: category icon + label (no control section) ──────────────
  _buildRowContent(row, res, rc) {
    // Category icon appears BEFORE the label (non-help categories)
    const cat = this._displayCategory;
    if (cat && cat !== 'help') {
      const catIcon = document.createElement('span');
      catIcon.className = 'display-cat-icon display-cat-icon--' + cat;
      catIcon.dataset.testid = 'display-category-icon';
      catIcon.textContent = cat === 'instructions' ? '\u2139' : '\u26A0';
      catIcon.dataset.tipTitle = cat === 'instructions' ? 'Instructions' : 'Security notice';
      catIcon.dataset.tipBody  = 'questionnaire-displayCategory: ' + cat;
      catIcon.dataset.tipFhir  = 'item.extension[questionnaire-displayCategory].valueCodeableConcept.coding[0].code';
      catIcon.dataset.tipSpec  = 'R4';
      row.appendChild(catIcon);
    }

    const label = this._buildLabel(res, rc);
    if (this._renderStyle) applyRenderStyle(label, this._renderStyle);
    row.appendChild(label);
    this._buildSupportLinks(row, rc);
    this._buildVisHint(row, rc);
    // display items have no badges or controls
  }
}

NODE_REGISTRY.set('display',     DisplayNode);
