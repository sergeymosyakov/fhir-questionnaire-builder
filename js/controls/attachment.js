import { createWrap } from './_base.js';
import { showError } from '../ui/toast.js';

export function build(node, ctx) {
  const { getValue, setValue, onChange, _reCalc, _formTick } = ctx;
  const wrap = createWrap();

  const el = document.createElement('input');
  el.type = 'file';
  el.className = 'file-input-hidden';
  if (node._mimeTypes && node._mimeTypes.length) el.accept = node._mimeTypes.join(',');

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn-file';
  btn.textContent = 'Choose file';
  btn.onclick = () => el.click();

  const nameTag = document.createElement('span');
  nameTag.className = 'file-name-tag';
  nameTag.textContent = getValue(node.id) ? getValue(node.id).name : 'No file chosen';

  // Max-size hint shown below the button row when _maxFileSizeMB is set
  const sizeHint = document.createElement('span');
  sizeHint.className = 'file-size-hint';
  if (node._maxFileSizeMB !== undefined) {
    sizeHint.textContent = `Max ${node._maxFileSizeMB} MB`;
  }
  // MIME-type hint shown when _mimeTypes is set
  const mimeHint = document.createElement('span');
  mimeHint.className = 'file-size-hint';
  mimeHint.dataset.testid = 'mime-hint';
  if (node._mimeTypes && node._mimeTypes.length) {
    mimeHint.textContent = node._mimeTypes.join(', ');
  }
  el.onchange = () => {
    const file = el.files[0] || null;
    if (file && node._maxFileSizeMB !== undefined && file.size > node._maxFileSizeMB * 1024 * 1024) {
      nameTag.textContent = `⚠ Too large (max ${node._maxFileSizeMB} MB)`;
      nameTag.classList.add('file-name-tag--error');
      showError(`File too large — max ${node._maxFileSizeMB} MB allowed`);
      setValue(node.id, null);
      _reCalc(); onChange(); _formTick.value++;
      return;
    }
    nameTag.classList.remove('file-name-tag--error');
    setValue(node.id, file ? { name: file.name, size: file.size, type: file.type } : null);
    nameTag.textContent = file ? file.name : 'No file chosen';
    _reCalc(); onChange(); _formTick.value++;
  };

  wrap.appendChild(el);
  wrap.appendChild(btn);
  wrap.appendChild(nameTag);
  if (node._maxFileSizeMB !== undefined) wrap.appendChild(sizeHint);
  if (node._mimeTypes && node._mimeTypes.length) wrap.appendChild(mimeHint);
  return wrap;
}
