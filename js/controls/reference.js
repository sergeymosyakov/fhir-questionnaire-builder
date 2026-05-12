import { createWrap } from './_base.js';

// FHIR R4 reference answer — stores a { reference, display } object in values[node.id].
// The input accepts either "ResourceType/id" or a free-text display string.
// A small hint shows the expected format and the allowed resource type if set.
export function build(node, ctx) {
  const { values, onChange } = ctx;
  const wrap = createWrap();
  wrap.style.flexDirection = 'column';
  wrap.style.alignItems    = 'flex-start';

  const row = document.createElement('span');
  row.style.cssText = 'display:inline-flex;align-items:center;gap:4px;';

  const el = document.createElement('input');
  el.type        = 'text';
  el.style.width = '200px';
  const current  = values[node.id];
  el.value       = current ? (current.reference || current.display || '') : '';
  el.placeholder = node.referenceResource
    ? node.referenceResource + '/id'
    : 'ResourceType/id';

  const errMsg = document.createElement('span');
  errMsg.style.cssText = 'font-size:10px;color:var(--c-err);margin-left:4px;display:none;';
  errMsg.textContent = 'Expected format: ResourceType/id';

  el.oninput = () => {
    const raw = el.value.trim();
    const isRef = /^[A-Za-z][A-Za-z0-9]*\/[^\s]+$/.test(raw);
    errMsg.style.display = (raw && !isRef) ? 'inline' : 'none';
    values[node.id] = raw ? { reference: raw } : undefined;
    onChange();
  };

  row.appendChild(el);
  row.appendChild(errMsg);
  wrap.appendChild(row);

  if (node.referenceResource) {
    const hint = document.createElement('span');
    hint.style.cssText = 'font-size:10px;color:#888;margin-top:2px;';
    hint.textContent = 'Allowed type: ' + node.referenceResource;
    wrap.appendChild(hint);
  }

  return wrap;
}
