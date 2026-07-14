// ── Shared builder-panel helpers ──────────────────────────────────────────────
// Extracted from base-node.js to keep it under the 500-line threshold.
// Each function takes the node instance as its first argument.
// Called via thin delegators on BaseNode: node._buildInlineTitleEditor(), etc.
import * as dnd from '../builder/dnd.js';
import { AppEvents, EventState } from '../events.js';
import { NODE_REGISTRY } from './registry.js';

const _notify = () => document.dispatchEvent(new CustomEvent(AppEvents.RESPONSE_CHANGED));

/**
 * Populate a NodeGearMenu with Copy / Paste before / Paste after items.
 * Paste items are shown disabled (greyed) when the clipboard is empty and
 * toggled live via CLIPBOARD_CHANGED. Caller adds its own separator + Delete.
 * @param {import('../ui/node-gear-menu.js').NodeGearMenu} gear
 * @param {object} node          node instance (needs .id and ._ac.signal)
 * @param {boolean} hasClip      initial clipboard state (BaseNode._hasClipboard)
 */
export function addCopyPasteGearItems(gear, node, hasClip) {
  gear.addItem('Copy', 'node-copy-btn', () =>
    document.dispatchEvent(new CustomEvent(AppEvents.NODE_COPY_REQUESTED, { detail: { id: node.id } })));
  const pb = gear.addItem('Paste before', 'node-paste-before-btn', () =>
    document.dispatchEvent(new CustomEvent(AppEvents.NODE_PASTE_BEFORE_REQUESTED, { detail: { id: node.id } })),
    { disabled: !hasClip });
  const pa = gear.addItem('Paste after', 'node-paste-after-btn', () =>
    document.dispatchEvent(new CustomEvent(AppEvents.NODE_PASTE_AFTER_REQUESTED, { detail: { id: node.id } })),
    { disabled: !hasClip });
  document.addEventListener(AppEvents.CLIPBOARD_CHANGED, e => {
    const dis = !e.detail.hasClip;
    pb.classList.toggle('node-gear-menu-item--disabled', dis);
    pa.classList.toggle('node-gear-menu-item--disabled', dis);
  }, { signal: node._ac.signal });
}

/** Returns a <div class="node-title-row"> with a click-to-edit title field. */
export function buildInlineTitleEditor(node) {
  const titleRow = document.createElement('div');
  titleRow.className = 'node-title-row';
  const titleDisplay = document.createElement('span');
  titleDisplay.className = 'node-title-display';
  titleDisplay.dataset.testid = 'node-title-display';
  titleDisplay.tabIndex = 0;
  titleDisplay.textContent = node.title || '(no title)';
  const titleTextarea = document.createElement('textarea');
  titleTextarea.className = 'node-title-textarea';
  titleTextarea.dataset.testid = 'node-title-input';
  titleTextarea.value = node.title;
  titleTextarea.style.display = 'none';
  titleTextarea.oninput = () => { node.title = titleTextarea.value; titleDisplay.textContent = titleTextarea.value || '(no title)'; _notify(); };
  titleTextarea.onblur  = () => { titleTextarea.style.display = 'none'; titleDisplay.style.display = ''; };
  titleDisplay.addEventListener('click', e => {
    e.stopPropagation();
    const h = titleDisplay.offsetHeight;
    titleDisplay.style.display = 'none';
    titleTextarea.style.display = '';
    titleTextarea.style.height = Math.max(h, 48) + 'px';
    titleTextarea.focus();
    titleTextarea.setSelectionRange(titleTextarea.value.length, titleTextarea.value.length);
  });
  titleRow.append(titleDisplay, titleTextarea);
  return { titleRow, titleDisplay, titleTextarea };
}

/** Returns a linkId <input> wired to node.id. */
export function buildLinkIdInput(node) {
  const inp = document.createElement('input');
  inp.type = 'text';
  inp.value = node.id;
  inp.className = 'node-linkid-input';
  inp.oninput = () => { node.id = inp.value.trim() || node.id; _notify(); };
  return inp;
}

/** Returns a prefix <input> wired to node._prefix. */
export function buildPrefixInput(node, placeholder = '\u2014') {
  const inp = document.createElement('input');
  inp.type = 'text';
  inp.value = node._prefix || '';
  inp.className = 'node-prefix-input';
  inp.dataset.testid = 'node-prefix-input';
  inp.placeholder = placeholder;
  inp.oninput = () => { node._prefix = inp.value.trim() || undefined; _notify(); };
  return inp;
}

/** Attach FHIR tooltips to the `id:` and `prefix:` meta labels (shared by item + group). */
export function applyMetaLabelTips(idLbl, prefixLbl) {  idLbl.dataset.tipTitle = 'FHIR linkId';
  idLbl.dataset.tipBody  = 'Editable. Must be unique within the questionnaire.';
  idLbl.dataset.tipFhir  = 'Questionnaire.item.linkId';
  idLbl.dataset.tipSpec  = 'R4';
  prefixLbl.dataset.tipTitle = 'Display prefix';
  prefixLbl.dataset.tipBody  = 'Cosmetic only \u2014 e.g. "1.". Does not affect logic or linkId.';
  prefixLbl.dataset.tipFhir  = 'Questionnaire.item.prefix';
  prefixLbl.dataset.tipSpec  = 'R4';
}

/**
 * Add a "Show properties" checkable item to a NodeGearMenu that toggles the
 * id/prefix meta row for all builder nodes. Wires live state updates via
 * BUILDER_META_ROW_CHANGE so the checkmark stays in sync across all open
 * gear menus.
 * @param {import('../ui/node-gear-menu.js').NodeGearMenu} gear
 * @param {object} node   node instance (needs ._ac.signal for cleanup)
 */
export function addMetaRowGearItem(gear, node) {
  const isVisible = () => EventState.get(AppEvents.BUILDER_META_ROW_CHANGE)?.visible ?? true;
  const mi = gear.addCheckItem('Show properties', 'toggle-node-props', isVisible(), () => {
    document.dispatchEvent(new CustomEvent(AppEvents.BUILDER_META_ROW_CHANGE,
      { detail: { visible: !isVisible() } }));
  });
  document.addEventListener(AppEvents.BUILDER_META_ROW_CHANGE, e => {
    mi.classList.toggle('node-gear-menu-item--checked', e.detail?.visible ?? true);
  }, { signal: node._ac.signal });
}

/**
 * Creates an action <a> element, appends it to container, returns it.
 * @param {BaseNode} node
 * @param {string} label
 * @param {string} key        — used for data-testid="action-{key}"
 * @param {{ title?, body?, fhir?, spec? }} tip
 * @param {HTMLElement} container
 */
export function makeActionLink(_node, label, key, tip, container) {
  const a = document.createElement('a');
  a.textContent    = label;
  a.className      = 'action-edit';
  a.dataset.testid = 'action-' + key;
  a.dataset.role   = 'advanced-ctrl';
  if (tip?.title) a.dataset.tipTitle = tip.title;
  if (tip?.body)  a.dataset.tipBody  = tip.body;
  if (tip?.fhir)  a.dataset.tipFhir  = tip.fhir;
  if (tip?.spec)  a.dataset.tipSpec  = tip.spec;
  container.appendChild(a);
  return a;
}

/** Returns a draggable ⠿ handle element. Returns null when !node.isDraggable(). */
export function buildDragHandle(node) {
  if (!node.isDraggable()) return null;
  return dnd.makeDragHandle(node);
}

/** Returns a <div class="drop-zone drop-zone-above"> wired for drop-before. */
export function buildDropZoneAbove(node) {
  const div = document.createElement('div');
  div.className   = 'drop-zone drop-zone-above';
  div.textContent = 'Drop here';
  dnd.attachDropZone(div, node, 'before');
  return div;
}

/**
 * Add "Add Sub-group" and "Add Sub-item" entries to a NodeGearMenu.
 * Shared between GroupNode and ItemNode-with-children.
 */
export function addChildGearItems(gear, node) {
  gear.addItem('Add Group', 'add-menu-group', () => {
    const GroupCls = NODE_REGISTRY.get('group');
    if (!GroupCls) return;
    const n = new GroupCls({ title: 'New Group' });
    n.id = node.id + '.' + String(node.children.length + 1);
    node.children.push(n);
    // Ensure parent node is expanded in the builder so the new child is visible.
    node.constructor._collapseMap?.set(node.id, false);
    document.dispatchEvent(new CustomEvent(AppEvents.REINIT_FORM));
    document.dispatchEvent(new CustomEvent(AppEvents.RESPONSE_CHANGED));
    document.dispatchEvent(new CustomEvent(AppEvents.BUILDER_RERENDER));
    document.dispatchEvent(new CustomEvent(AppEvents.BUILDER_NAVIGATE_TO, { detail: { nodeId: n.id } }));
  });
  gear.addItem('Add Item', 'add-menu-item', () => {
    const siblings = node.children.filter(c => c.type === 'item');
    const template = siblings.length > 0 ? siblings[siblings.length - 1] : null;
    const Cls = (template && NODE_REGISTRY.get(template.itemType)) ?? NODE_REGISTRY.get('text');
    if (!Cls) return;
    const n = template
      ? new Cls({ title: 'New Item', itemType: template.itemType,
                  mandatory: template.mandatory, repeats: template.repeats || false,
                  options: template.options,
                  constraint: template.constraint ? template.constraint.map(c => ({ ...c })) : [] })
      : new Cls({ title: 'New Item', itemType: 'text' });
    n.id = node.id + '.' + String(node.children.length + 1);
    node.children.push(n);
    // Ensure parent node is expanded in the builder so the new child is visible.
    node.constructor._collapseMap?.set(node.id, false);
    document.dispatchEvent(new CustomEvent(AppEvents.REINIT_FORM));
    document.dispatchEvent(new CustomEvent(AppEvents.RESPONSE_CHANGED));
    document.dispatchEvent(new CustomEvent(AppEvents.BUILDER_RERENDER));
    document.dispatchEvent(new CustomEvent(AppEvents.BUILDER_NAVIGATE_TO, { detail: { nodeId: n.id } }));
  });

}

/** Returns a drop-zone-inside element wired for DnD into the last child position. */
export function buildInsideDropZone(node) {
  const div = document.createElement('div');
  div.className   = 'drop-zone drop-zone-inside';
  div.textContent = 'Drop here to add as last child';
  dnd.attachDropZone(div, node, 'inside-last');
  return div;
}
