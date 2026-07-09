// ── DisplayNode ───────────────────────────────────────────────────────────────
// Represents a FHIR display item (type: 'item', itemType: 'display').
// Displays informational text — no interactive control.
// Optional FHIR-imported properties: _displayCategory ('help' | 'instructions' | 'security')
import { ItemNode } from './item-node.js';
import { NODE_REGISTRY } from './registry.js';
import { applyRenderStyle } from './base-node.js';
import { createWrap } from './base-node.js';

// Crisp info-circle glyph for flyover display items (text revealed on hover).
const FLYOVER_SVG = '<svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true" focusable="false"><circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" stroke-width="1.4"/><circle cx="8" cy="4.7" r="1" fill="currentColor"/><rect x="7.15" y="6.9" width="1.7" height="5" rx="0.85" fill="currentColor"/></svg>';

export class DisplayNode extends ItemNode {
  constructor(data = {}) {
    super(data);
    this.itemType = 'display';
  }

  /** Display items have no interactive control. */
  buildControl(_ctx) {
    return createWrap();
  }

  supportsRepeat() { return false; }

  // ── Add displayCategory CSS class to the row ──────────────────────────────
  _initRowClass(row) {
    if (this._displayCategory) row.classList.add('lform-item--' + this._displayCategory);
  }

  // ── Label: help toggle or plain label with category icon ──────────────────
  _buildLabel() {
    const cat = this._displayCategory;
    if (cat === 'help') {
      // Help items: collapsible toggle button
      // Store toggle state on the instance so it survives full re-renders
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
      if (this._helpOpen) {
        content.classList.add('display-help-content--open');
        toggle.classList.add('display-help-toggle--open');
      }
      toggle.addEventListener('click', () => {
        this._helpOpen = !this._helpOpen;
        content.classList.toggle('display-help-content--open', this._helpOpen);
        toggle.classList.toggle('display-help-toggle--open', this._helpOpen);
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
    this._initRowClass(row);

    // Flyover itemControl: text is hidden inline and revealed on hover.
    if (this._itemControl === 'flyover') {
      const fly = document.createElement('span');
      fly.className        = 'display-flyover';
      fly.dataset.testid   = 'display-flyover';
      fly.innerHTML        = FLYOVER_SVG;
      fly.dataset.tipTitle = 'Flyover';
      fly.dataset.tipBody  = this.title;
      row.appendChild(fly);
      this._buildSupportLinks(row, rc);
      this._buildVisHint(row, rc);
      return;
    }

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
      catIcon.dataset.tipSpec  = 'R5';
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
