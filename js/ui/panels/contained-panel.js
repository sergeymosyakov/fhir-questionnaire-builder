// ── Contained Resources panel ─────────────────────────────────────────────────
// Collapsible read-only card showing Questionnaire.contained[] items.
// Each chip fires 'show-json' event → handled by JsonViewerModal.
import { Panel } from './panel-base.js';

class ContainedPanel extends Panel {
  constructor() {
    super('containedCard', 'containedCardToggle', 'containedCardChips', 'containedCardCount');
    this._questContained = null;
  }

  configure({ questContained }) {
    this._questContained = questContained;
    this.refresh();
  }

  refresh() {
    if (!this._questContained) return;
    const count = this._questContained.length;
    this._showCount(count);
    this._renderChips();
  }

  _renderChips() {
    this._el.chipList.innerHTML = '';
    for (const resource of this._questContained) {
      const rType = resource.resourceType || 'Resource';
      const rId   = resource.id           || '';
      const label = rId ? `${rType}/${rId}` : rType;

      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'fhir-res-chip fhir-res-chip--contained';
      chip.textContent = label;
      chip.dataset.tipTitle = 'View JSON';
      chip.addEventListener('click', () => {
        document.dispatchEvent(new CustomEvent('show-json', { detail: { title: label, data: resource } }));
      });
      this._el.chipList.appendChild(chip);
    }
  }
}

export default new ContainedPanel();
