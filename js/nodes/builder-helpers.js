// ── Shared builder-panel helpers ──────────────────────────────────────────────
// Extracted from base-node.js to keep it under the 500-line threshold.
// Each function takes the node instance as its first argument.
// Called via thin delegators on BaseNode: node._buildInlineTitleEditor(), etc.
import * as dnd from '../builder/dnd.js';
import { AppEvents } from '../events.js';

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
  inp.dataset.tipTitle = 'FHIR linkId';
  inp.dataset.tipBody  = 'Editable. Must be unique within the questionnaire.';
  inp.dataset.tipFhir  = 'Questionnaire.item.linkId';
  inp.dataset.tipSpec  = 'R4';
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
  inp.dataset.tipTitle = 'Display prefix';
  inp.dataset.tipBody  = 'Cosmetic only \u2014 e.g. "1.". Does not affect logic or linkId.';
  inp.dataset.tipFhir  = 'Questionnaire.item.prefix';
  inp.dataset.tipSpec  = 'R4';
  inp.oninput = () => { node._prefix = inp.value.trim() || undefined; _notify(); };
  return inp;
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
