import { StatesSection } from './base-section.js';
import { STATES_SECTIONS } from './registry.js';
import { createCustomSelect } from '../../custom-select.js';

// '' = inherit from parent (no extension written), 'true' = yes, 'false' = suppress
const OBS_ITEMS = [
  { value: '',      label: 'Inherit from parent' },
  { value: 'true',  label: 'Yes — extract as Observation' },
  { value: 'false', label: 'No — suppress extraction' },
];

function nodeToVal(node) {
  if (node._observationExtract === true)  return 'true';
  if (node._observationExtract === false) return 'false';
  return '';
}

class ObservationExtractSection extends StatesSection {
  initPending(node) {
    return { draftObsExtract: nodeToVal(node) };
  }

  isVisible(node) { return node.itemType !== 'display'; }

  build(pending) {
    const row = document.createElement('div');
    row.className = 'states-modal-field-row';

    const lbl = document.createElement('label');
    lbl.className        = 'states-modal-chk-label';
    lbl.textContent      = 'Extract as Observation:';
    lbl.dataset.tipTitle = 'sdc-questionnaire-observationExtract';
    lbl.dataset.tipBody  = 'Controls SDC Observation-based extraction for this item. "Inherit" writes no extension and defers to the nearest ancestor. "Yes" explicitly enables extraction (item.code required). "No" suppresses an inherited true.';
    lbl.dataset.tipFhir  = 'item.extension[sdc-questionnaire-observationExtract].valueBoolean';
    lbl.dataset.tipSpec  = 'SDC';

    const sel = createCustomSelect({
      items:     OBS_ITEMS,
      value:     pending.draftObsExtract,
      onChange:  v => { pending.draftObsExtract = v; },
      className: 'sc-trigger--sm',
      testid:    'states-obs-extract-sel',
    });

    row.appendChild(lbl);
    row.appendChild(sel.el);
    return row;
  }

  commit(pending, node) {
    if (pending.draftObsExtract === 'true')  node._observationExtract = true;
    else if (pending.draftObsExtract === 'false') node._observationExtract = false;
    else delete node._observationExtract;
  }

  buildPatch(pending, _node) {
    if (pending.draftObsExtract === 'true')  return { _observationExtract: true };
    if (pending.draftObsExtract === 'false') return { _observationExtract: false };
    return { _observationExtract: null };
  }
}

STATES_SECTIONS.push(new ObservationExtractSection());
