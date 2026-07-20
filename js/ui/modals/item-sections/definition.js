import { ItemSection } from './base-section.js';
import { ITEM_SECTIONS } from './registry.js';
import { resolveDefinition } from '../../../fhir/definition-resolver.js';
import { changeNodeType } from '../../../nodes/change-type.js';
import { AppEvents, EventState } from '../../../events.js';
import { showError, showInfo } from '../../toast.js';

const CHOICE_TYPES = new Set(['select', 'radio', 'checklist', 'open-choice']);

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

    // ── Resolve from profile ────────────────────────────────────────────────────
    // Loads a StructureDefinition (uploaded file) and auto-fills text, type, and
    // value constraints for the element referenced by the definition URL.
    const resolveRow = document.createElement('div');
    resolveRow.className = 'meta-modal-row';

    const resolveLbl = document.createElement('label');
    resolveLbl.className        = 'meta-modal-lbl';
    resolveLbl.textContent      = 'Resolve';
    resolveLbl.dataset.tipTitle = 'Resolve from profile';
    resolveLbl.dataset.tipBody  = 'Load a StructureDefinition (JSON) and auto-fill the item text, type, and value constraints from the element referenced by the Definition URL. Runs entirely in the browser \u2014 no server required.';
    resolveLbl.dataset.tipFhir  = 'StructureDefinition.snapshot.element';
    resolveLbl.dataset.tipSpec  = 'SDC';

    const resolveWrap = document.createElement('div');
    resolveWrap.className = 'meta-modal-resolve';

    const fileInp = document.createElement('input');
    fileInp.type = 'file';
    fileInp.accept = '.json,application/json';
    fileInp.hidden = true;
    fileInp.dataset.testid = 'item-props-profile-file';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'meta-modal-btn';
    btn.textContent = 'Resolve from profile\u2026';
    btn.dataset.testid = 'item-props-resolve-btn';
    btn.addEventListener('click', () => fileInp.click());

    const status = document.createElement('span');
    status.className = 'meta-modal-resolve-status';
    status.dataset.testid = 'item-props-resolve-status';

    fileInp.addEventListener('change', async () => {
      const file = fileInp.files?.[0];
      fileInp.value = '';
      if (!file) return;
      await this._resolveFromFile(file, pending, { inp, inpBT, inpFT, status });
    });

    resolveWrap.append(btn, fileInp, status);
    resolveRow.append(resolveLbl, resolveWrap);
    wrap.append(resolveRow);

    return wrap;
  }

  /**
   * Read a StructureDefinition file, resolve the current definition URL against
   * it, and apply the resolved fields to the node and the section inputs.
   */
  async _resolveFromFile(file, pending, refs) {
    const definition = (pending.definition || '').trim();
    if (!definition.includes('#')) {
      showError('Enter a Definition URL with a #element fragment first (e.g. .../StructureDefinition/Patient#Patient.name.family).');
      return;
    }

    let sd;
    try {
      sd = JSON.parse(await file.text());
    } catch {
      showError('Could not parse the selected file as JSON.');
      return;
    }
    if (sd?.resourceType !== 'StructureDefinition') {
      showError('The selected file is not a FHIR StructureDefinition.');
      return;
    }

    const resolved = resolveDefinition(sd, definition);
    if (!resolved) {
      showError(`Element "${definition.split('#')[1] || ''}" was not found in the profile.`);
      return;
    }

    this._applyResolved(resolved, pending, refs);
  }

  /** Apply resolved element fields to the node and to the section inputs. */
  _applyResolved(resolved, pending, refs) {
    const { inpBT, inpFT, status } = refs;
    let node = pending.node;

    // Base / FHIR type extension fields (owned by this section).
    if (resolved.fhirType) {
      pending.baseType = resolved.fhirType;
      inpBT.value = resolved.fhirType;
      if (/^[A-Z]/.test(resolved.fhirType)) {
        pending.fhirType = resolved.fhirType;
        inpFT.value = resolved.fhirType;
      }
    }

    // Item text.
    if (resolved.text) node.title = resolved.text;

    // Item type - swap the node class in-place when it differs. Not applicable
    // to group/display nodes.
    const canRetype = resolved.itemType
      && node.itemType
      && node.itemType !== resolved.itemType
      && node.type !== 'group'
      && node.itemType !== 'display';
    if (canRetype) {
      const ctx = EventState.get(AppEvents.APP_CONTEXT_READY);
      const tree = ctx?.questDoc?.tree ?? [];
      node = changeNodeType(node, resolved.itemType, tree, ctx?.answerStore);
      pending.node = node;
    }

    // Constraints.
    if (resolved.mandatory !== undefined) node.mandatory = resolved.mandatory;
    if (resolved.repeats && typeof node.supportsRepeat === 'function' && node.supportsRepeat()) {
      node.repeats = true;
    }
    if (resolved.maxLength !== undefined) node._maxLength = resolved.maxLength;
    if (resolved.answerValueSet && CHOICE_TYPES.has(node.itemType)) {
      node._answerValueSet = resolved.answerValueSet;
    }

    // Reference targets — allowed profiles + expected resource type.
    if (node.itemType === 'reference') {
      if (resolved.referenceProfiles) node._referenceProfiles = resolved.referenceProfiles;
      if (resolved.referenceType)     node.referenceResource  = resolved.referenceType;
    }

    // Status summary.
    const parts = [resolved.itemType || resolved.fhirType || 'element'];
    if (resolved.mandatory) parts.push('required');
    if (resolved.repeats)   parts.push('repeats');
    if (resolved.answerValueSet) parts.push('bound');
    if (node.itemType === 'reference' && resolved.referenceType) parts.push('\u2192 ' + resolved.referenceType);
    status.textContent = `\u2713 ${resolved.elementId} \u2192 ${parts.join(' \u00B7 ')}`;

    document.dispatchEvent(new CustomEvent(AppEvents.CALC_RECALC_REQUESTED));
    document.dispatchEvent(new CustomEvent(AppEvents.BUILDER_RERENDER));
    showInfo(`Resolved ${resolved.elementId} from profile.`);
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
