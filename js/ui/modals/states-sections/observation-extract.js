import { StatesSection } from './base-section.js';
import { STATES_SECTIONS } from './registry.js';

class ObservationExtractSection extends StatesSection {
  initPending(node) {
    return { draftObsExtract: !!node._observationExtract };
  }

  isVisible(node) { return node.itemType !== 'display'; }

  build(pending) {
    const row = document.createElement('div');
    row.className = 'states-modal-check-row';

    const chk = document.createElement('input');
    chk.type           = 'checkbox';
    chk.id             = 'statesObsExtract';
    chk.dataset.testid = 'states-obs-extract-chk';
    chk.checked        = pending.draftObsExtract;
    chk.addEventListener('change', () => { pending.draftObsExtract = chk.checked; });

    const lbl = document.createElement('label');
    lbl.htmlFor          = 'statesObsExtract';
    lbl.className        = 'states-modal-chk-label';
    lbl.textContent      = 'Extract as Observation';
    lbl.dataset.tipTitle = 'sdc-questionnaire-observationExtract';
    lbl.dataset.tipBody  = 'Marks this item (or group) for SDC Observation-based extraction. On extraction, each coded answer beneath an enabled item becomes an Observation. Requires item.code. The flag is inherited by descendants.';
    lbl.dataset.tipFhir  = 'item.extension[sdc-questionnaire-observationExtract].valueBoolean';
    lbl.dataset.tipSpec  = 'SDC';

    const hint = document.createElement('span');
    hint.className   = 'states-modal-chk-hint';
    hint.textContent = 'Coded answers below this item are extracted as Observation resources (sdc-questionnaire-observationExtract). Requires item.code.';

    row.appendChild(chk);
    row.appendChild(lbl);
    row.appendChild(hint);
    return row;
  }

  commit(pending, node) {
    node._observationExtract = pending.draftObsExtract || undefined;
  }

  buildPatch(pending, _node) {
    return { _observationExtract: pending.draftObsExtract || null };
  }
}

STATES_SECTIONS.push(new ObservationExtractSection());
