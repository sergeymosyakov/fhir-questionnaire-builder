import { StatesSection } from './base-section.js';
import { STATES_SECTIONS } from './registry.js';
import { createCustomSelect, COLL_OPTIONS } from './helpers.js';

class CollapsibleSection extends StatesSection {
  initPending(node) {
    return { draftCollapsible: node._collapsible || '' };
  }

  isVisible(node) { return node.type !== 'item'; }

  build(pending) {
    const row = document.createElement('div');
    row.className = 'states-modal-row';

    const lbl = document.createElement('label');
    lbl.className        = 'states-modal-label';
    lbl.textContent      = 'Collapsible:';
    lbl.dataset.tipTitle = 'Collapsible group';
    lbl.dataset.tipBody  = 'Controls whether this group renders as a collapsible section in the patient view. default-closed = starts collapsed; default-open = starts expanded but collapsible.';
    lbl.dataset.tipFhir  = 'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-collapsible';
    lbl.dataset.tipSpec  = 'SDC';

    const sel = createCustomSelect({
      items:     COLL_OPTIONS,
      value:     pending.draftCollapsible,
      onChange:  v => { pending.draftCollapsible = v; },
      className: 'states-modal-sel sc-trigger--full',
      testid:    'states-collapsible-sel',
    });

    row.appendChild(lbl);
    row.appendChild(sel.el);
    return row;
  }

  commit(pending, node) {
    if (node.type !== 'item') node._collapsible = pending.draftCollapsible || undefined;
  }
}

STATES_SECTIONS.push(new CollapsibleSection());
