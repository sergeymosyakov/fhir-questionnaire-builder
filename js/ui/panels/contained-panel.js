// ── Contained Resources panel ─────────────────────────────────────────────────
// Collapsible read-only card showing Questionnaire.contained[] items.
// Each chip fires 'show-json' event → handled by JsonViewerModal.
import { Panel } from './panel-base.js';

class ContainedPanel extends Panel {
  constructor() {
    super({
      mod:      'contained',
      idPrefix: 'containedCard',
      label:    'Contained',
      tipTitle: 'Contained Resources',
      tipBody:  'Questionnaire.contained[] — inline FHIR resources bundled inside the questionnaire (e.g. ValueSet definitions). Imported and exported unchanged. Click a chip to view the raw JSON.',
      tipFhir:  'Questionnaire.contained[]',
      tipSpec:  'R4 · optional',
    });
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
    this._chipList.innerHTML = '';
    for (const resource of this._questContained) {
      const rType = resource.resourceType || 'Resource';
      const rId   = resource.id           || '';
      const label = rId ? `${rType}/${rId}` : rType;

      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'fhir-res-chip fhir-res-chip--contained';
      chip.textContent = label;
      chip.dataset.tipTitle = label;
      chip.dataset.tipBody  = `View the raw JSON of this contained ${rType}. Preserved verbatim on import and export — never modified by the builder.`;
      chip.dataset.tipFhir  = rId ? `Questionnaire.contained[id="${rId}"]` : 'Questionnaire.contained[]';
      chip.dataset.tipSpec  = 'R4 · optional';
      chip.addEventListener('click', () => {
        document.dispatchEvent(new CustomEvent('show-json', { detail: { title: label, data: resource } }));
      });
      this._chipList.appendChild(chip);
    }
  }
}

export default new ContainedPanel();
