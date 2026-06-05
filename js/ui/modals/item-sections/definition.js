import { ItemSection } from './base-section.js';
import { ITEM_SECTIONS } from './registry.js';

class DefinitionSection extends ItemSection {
  initPending(node) {
    return {
      definition: node._definition || '',
      baseType:   node._baseType   || '',
      fhirType:   node._fhirType   || '',
    };
  }

  build(pending) {
    const wrap = document.createDocumentFragment();

    // ── item.definition ───────────────────────────────────────────────────────
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
    wrap.append(row);

    // ── questionnaire-baseType ─────────────────────────────────────────────────
    const rowBT = document.createElement('div');
    rowBT.className = 'meta-modal-row';

    const lblBT = document.createElement('label');
    lblBT.className        = 'meta-modal-lbl';
    lblBT.htmlFor          = 'itemPropsBaseTypeInput';
    lblBT.textContent      = 'Base Type';
    lblBT.dataset.tipTitle = 'Base FHIR type';
    lblBT.dataset.tipBody  = 'The base FHIR type for items derived from an ElementDefinition (e.g. "string", "dateTime", "Identifier"). Used together with item.definition.';
    lblBT.dataset.tipFhir  = 'item.extension[questionnaire-baseType].valueCode';
    lblBT.dataset.tipSpec  = 'SDC';

    const inpBT = document.createElement('input');
    inpBT.type           = 'text';
    inpBT.id             = 'itemPropsBaseTypeInput';
    inpBT.className      = 'meta-modal-inp';
    inpBT.placeholder    = 'e.g. string, dateTime, Identifier';
    inpBT.dataset.testid = 'item-props-base-type';
    inpBT.value          = pending.baseType;
    inpBT.oninput = () => { pending.baseType = inpBT.value; };

    rowBT.append(lblBT, inpBT);
    wrap.append(rowBT);

    // ── questionnaire-fhirType ─────────────────────────────────────────────────
    const rowFT = document.createElement('div');
    rowFT.className = 'meta-modal-row';

    const lblFT = document.createElement('label');
    lblFT.className        = 'meta-modal-lbl';
    lblFT.htmlFor          = 'itemPropsFhirTypeInput';
    lblFT.textContent      = 'FHIR Type';
    lblFT.dataset.tipTitle = 'FHIR element type';
    lblFT.dataset.tipBody  = 'The specific FHIR type for complex elements derived from an ElementDefinition (e.g. "HumanName", "ContactPoint", "Address"). Refines Base Type for complex structures.';
    lblFT.dataset.tipFhir  = 'item.extension[questionnaire-fhirType].valueCode';
    lblFT.dataset.tipSpec  = 'SDC';

    const inpFT = document.createElement('input');
    inpFT.type           = 'text';
    inpFT.id             = 'itemPropsFhirTypeInput';
    inpFT.className      = 'meta-modal-inp';
    inpFT.placeholder    = 'e.g. HumanName, ContactPoint, Address';
    inpFT.dataset.testid = 'item-props-fhir-type';
    inpFT.value          = pending.fhirType;
    inpFT.oninput = () => { pending.fhirType = inpFT.value; };

    rowFT.append(lblFT, inpFT);
    wrap.append(rowFT);

    return wrap;
  }

  commit(pending, node) {
    if (pending.definition.trim()) node._definition = pending.definition.trim();
    else delete node._definition;

    if (pending.baseType.trim()) node._baseType = pending.baseType.trim();
    else delete node._baseType;

    if (pending.fhirType.trim()) node._fhirType = pending.fhirType.trim();
    else delete node._fhirType;
  }

  buildPatch(pending, _node) {
    return {
      _definition: pending.definition.trim() || null,
      _baseType:   pending.baseType.trim()   || null,
      _fhirType:   pending.fhirType.trim()   || null,
    };
  }
}

ITEM_SECTIONS.push(new DefinitionSection());
