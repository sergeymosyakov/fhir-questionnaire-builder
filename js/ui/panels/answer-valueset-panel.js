// ── Answer ValueSet panel ─────────────────────────────────────────────────────
// Collapsible read-only card showing all answerValueSet URLs referenced by items.
// Each chip fires 'show-json' event → handled by JsonViewerModal.
import { Panel } from './panel-base.js';

class AnswerValueSetPanel extends Panel {
  constructor() {
    super('answerValueSetCard', 'answerValueSetCardToggle', 'answerValueSetCardChips', 'answerValueSetCardCount');
    this._tree = null;
  }

  configure({ tree }) {
    this._tree = tree;
    this.refresh();
  }

  refresh() {
    if (!this._tree) return;
    const urlMap = this._collectUrls(this._tree);
    this._showCount(urlMap.size);
    this._renderChips(urlMap);
  }

  _collectUrls(nodes, map = new Map()) {
    for (const node of nodes) {
      if (node._answerValueSet) {
        if (!map.has(node._answerValueSet)) map.set(node._answerValueSet, []);
        map.get(node._answerValueSet).push(node.id);
      }
      if (node.children) this._collectUrls(node.children, map);
    }
    return map;
  }

  _renderChips(urlMap) {
    this._el.chipList.innerHTML = '';
    for (const [url, items] of urlMap) {
      const label = url.split('/').filter(Boolean).pop() || url;

      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'fhir-res-chip fhir-res-chip--avs';
      chip.textContent = label;
      chip.dataset.tipTitle = url;
      chip.addEventListener('click', () =>
        document.dispatchEvent(new CustomEvent('show-json', { detail: { title: label, data: { answerValueSet: url, usedByItems: items } } }))
      );
      this._el.chipList.appendChild(chip);
    }
  }
}

export default new AnswerValueSetPanel();
