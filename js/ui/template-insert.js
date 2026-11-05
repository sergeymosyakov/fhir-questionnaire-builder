// Inserts a library template (a wrapper group) at the end of a node's children, or at root.
import { AppEvents, EventState } from '../events.js';
import { MODAL_REGISTRY } from './modals/modal-registry.js';
import { findNode } from '../builder/dnd.js';
import { fhirItemToNode } from '../fhir/import-item.js';
import { loadTemplateGroup } from '../fhir/templates.js';
import { remapSubtree, collectNodeIds } from '../fhir/linkid-remap.js';
import { showError } from './toast.js';

export class TemplateInsert {
  constructor() {
    document.addEventListener(AppEvents.NODE_INSERT_TEMPLATE_REQUESTED,
      e => this.insert(e.detail?.id ?? null));
  }

  /** @param {string|null} parentId node to insert into; null = questionnaire root */
  insert(parentId) {
    MODAL_REGISTRY.get('templates')?.open(entry => this._insertEntry(entry, parentId));
  }

  async _insertEntry(entry, parentId) {
    const questDoc = EventState.get(AppEvents.APP_CONTEXT_READY)?.questDoc;
    if (!questDoc) return;
    const parent = parentId === null ? null : findNode(questDoc.tree, parentId)?.node;
    if (parentId !== null && !parent) return;

    let group;
    try { group = await loadTemplateGroup(entry); }
    catch (err) { showError(`Could not load template "${entry.name}": ${err.message}`); return; }

    const { remapped } = remapSubtree(group, collectNodeIds(questDoc.tree), 'suffix');
    const node = fhirItemToNode(remapped, new Map(), questDoc.contained || []);
    const wasEmpty = !parent && questDoc.tree.length === 0;
    (parent ? parent.children : questDoc.tree).push(node);
    if (parent) parent.constructor._collapseMap?.set(parent.id, false);

    document.dispatchEvent(new CustomEvent(AppEvents.REINIT_FORM));
    if (wasEmpty) document.dispatchEvent(new CustomEvent(AppEvents.QUESTIONNAIRE_NEW));
    document.dispatchEvent(new CustomEvent(AppEvents.RESPONSE_CHANGED));
    document.dispatchEvent(new CustomEvent(AppEvents.BUILDER_RERENDER));
    document.dispatchEvent(new CustomEvent(AppEvents.BUILDER_NAVIGATE_TO, { detail: { nodeId: node.id } }));
  }
}
