import { ItemSection } from './base-section.js';
import { ITEM_SECTIONS } from './registry.js';

class DefinitionSection extends ItemSection {
  initPending(node) {
    return { definition: node._definition || '' };
  }

  build(pending) {
    const row = document.createElement('div');
    row.className = 'meta-modal-row';

    const lbl = document.createElement('label');
    lbl.className        = 'meta-modal-lbl';
    lbl.htmlFor          = 'itemPropsDefInput';
    lbl.textContent      = 'Definition';
    lbl.dataset.tipTitle = 'Item definition';
    lbl.dataset.tipBody  = 'URL that identifies a specific element of a FHIR StructureDefinition this item maps to. Used for structured data capture profiling.';
    lbl.dataset.tipFhir  = 'Questionnaire.item.definition';
    lbl.dataset.tipSpec  = 'R4';

    const inp = document.createElement('input');
    inp.type           = 'url';
    inp.id             = 'itemPropsDefInput';
    inp.className      = 'meta-modal-inp';
    inp.placeholder    = 'https://...StructureDefinition#element';
    inp.dataset.testid = 'item-props-definition';
    inp.value          = pending.definition;
    inp.oninput = () => { pending.definition = inp.value; };

    row.append(lbl, inp);
    return row;
  }

  commit(pending, node) {
    if (pending.definition.trim()) node._definition = pending.definition.trim();
    else delete node._definition;
  }
}

ITEM_SECTIONS.push(new DefinitionSection());
