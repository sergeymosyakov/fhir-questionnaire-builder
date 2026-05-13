import { createWrap } from './_base.js';

export function build(node, ctx) {
  const { values, onChange, _reCalc, _formTick } = ctx;
  const wrap = createWrap();

  const el = document.createElement('input');
  el.type = 'file';
  el.className = 'file-input-hidden';

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn-file';
  btn.textContent = 'Choose file';
  btn.onclick = () => el.click();

  const nameTag = document.createElement('span');
  nameTag.className = 'file-name-tag';
  nameTag.textContent = values[node.id] ? values[node.id].name : 'No file chosen';

  el.onchange = () => {
    const file = el.files[0] || null;
    values[node.id] = file ? { name: file.name, size: file.size, type: file.type } : null;
    nameTag.textContent = file ? file.name : 'No file chosen';
    _reCalc(); onChange(); _formTick.value++;
  };

  wrap.appendChild(el);
  wrap.appendChild(btn);
  wrap.appendChild(nameTag);
  return wrap;
}
