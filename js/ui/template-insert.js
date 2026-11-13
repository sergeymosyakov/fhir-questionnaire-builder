// Inserts a library template (a wrapper group) at the end of a node's children, or at root; also applies the `?template=<id>` deep link.
import { AppEvents, EventState } from '../events.js';
import { MODAL_REGISTRY } from './modals/modal-registry.js';
import { findNode } from '../builder/dnd.js';
import { fhirItemToNode } from '../fhir/import-item.js';
import { loadTemplateGroup, loadTemplateLibrary } from '../fhir/templates.js';
import { parseTemplateLink, withoutTemplateParam } from '../fhir/template-link.js';
import { copyrightNoticeFor, withCopyrightNotice } from '../fhir/template-notice.js';
import { remapSubtree, collectNodeIds } from '../fhir/linkid-remap.js';
import { showError } from './toast.js';

export class TemplateInsert {
  constructor() {
    document.addEventListener(AppEvents.NODE_INSERT_TEMPLATE_REQUESTED,
      e => this.insert(e.detail?.id ?? null));
    this._applyDeepLink();
  }

  /** @param {string|null} parentId node to insert into; null = questionnaire root */
  insert(parentId) {
    MODAL_REGISTRY.get('templates')?.open(entry => this._insertEntry(entry, parentId));
  }

  async _applyDeepLink() {
    const link = parseTemplateLink(location.search);
    if (!link) return;
    // Drop the parameter right away so a reload does not insert the template again.
    history.replaceState(null, '', withoutTemplateParam(location.href));
    if (link.invalid) { showError('This is not a valid template link.'); return; }
    let entry;
    try { entry = (await loadTemplateLibrary()).find(e => e.id === link.id); }
    catch (err) { showError(`Could not load templates: ${err.message}`); return; }
    if (!entry) { showError(`Template "${link.id}" was not found.`); return; }
    if (!EventState.get(AppEvents.APP_CONTEXT_READY)) {
      await new Promise(resolve => document.addEventListener(AppEvents.APP_CONTEXT_READY, resolve, { once: true }));
    }
    await this._insertEntry(entry, null);
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
    questDoc.meta.copyright = withCopyrightNotice(questDoc.meta.copyright, copyrightNoticeFor(entry));

    document.dispatchEvent(new CustomEvent(AppEvents.REINIT_FORM));
    if (wasEmpty) document.dispatchEvent(new CustomEvent(AppEvents.QUESTIONNAIRE_NEW));
    document.dispatchEvent(new CustomEvent(AppEvents.RESPONSE_CHANGED));
    document.dispatchEvent(new CustomEvent(AppEvents.BUILDER_RERENDER));
    document.dispatchEvent(new CustomEvent(AppEvents.BUILDER_NAVIGATE_TO, { detail: { nodeId: node.id } }));
  }
}
