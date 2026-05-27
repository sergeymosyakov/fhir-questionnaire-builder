import { DropdownMenu } from '../dropdown-menu.js';

const _LABELS = {
  preview: '\uD83D\uDC41\uFE0F Preview \u25BE',
  patient: '\uD83D\uDC64 Patient \u25BE',
  json:    '{} FHIR JSON \u25BE',
};

export class PreviewModeMenu extends DropdownMenu {
  constructor() {
    super({
      btnId:    'previewModeBtn',
      menuId:   'previewModeMenu',
      wrapId:   'previewModeWrap',
      label:    _LABELS.preview,
      btnClass: 'btn-fhir preview-mode-btn',
      testid:   'preview-mode-btn',
    });

    this._wrap.style.display = 'none';
    this._buildMenu();
    this._applyMode('preview');
  }

  _buildMenu() {
    const items = [
      ['preview', '\uD83D\uDC41\uFE0F Preview',  'previewModeItemPreview', 'preview-mode-preview'],
      ['patient', '\uD83D\uDC64 Patient View',    'previewModeItemPatient', 'preview-mode-patient'],
      ['json',    '{} FHIR JSON',                 'previewModeItemJson',    'preview-mode-json'],
    ];
    items.forEach(([mode, label, id, testid]) => {
      const item = this._item(id, label, testid);
      item.dataset.mode = mode;
      item.addEventListener('click', () => {
        this.close();
        this._applyMode(mode);
      });
      this._menu.appendChild(item);
    });
  }

  _applyMode(mode) {
    document.dispatchEvent(new CustomEvent('preview-mode-change', { detail: { mode } }));
    this._btn.innerHTML = _LABELS[mode];
    this._menu.querySelectorAll('.load-menu-item').forEach(item => {
      item.classList.toggle('load-menu-item--checked', item.dataset.mode === mode);
    });
  }
}
