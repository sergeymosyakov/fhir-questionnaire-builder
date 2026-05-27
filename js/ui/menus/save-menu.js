import { DropdownMenu } from '../dropdown-menu.js';

export class SaveMenu extends DropdownMenu {
  constructor() {
    super({
      btnId:    'exportBtn',
      menuId:   'exportMenu',
      wrapId:   'exportWrap',
      label:    '&#x2B07; Save &#x25BE;',
      btnClass: 'btn-fhir btn-fhir-export',
      testid:   'export-btn',
      tipTitle: 'Save / Export',
      tipBody:  'Save to cloud or export the questionnaire as FHIR R4 JSON, or download current answers as a QuestionnaireResponse.',
    });

    this._wrap.style.display = 'none';
    this._buildMenu();
  }

  _buildMenu() {
    const cloudItem = this._item('cloudSaveBtn', '&#x2601;&#xFE0F; Cloud', 'cloud-save-btn');
    cloudItem.style.display = 'none';

    const cloudSep = this._sep('cloudSaveSep');
    cloudSep.style.display = 'none';

    this._exportFhirItem = this._item('exportFhirItem', '&#x1F4C4; Questionnaire &middot; JSON file', 'export-fhir-item');
    this._exportQrItem = this._item('exportQrItem', '&#x1F4CB; QuestionnaireResponse &middot; JSON file', 'export-qr-item');

    this._menu.append(
      cloudItem,
      cloudSep,
      this._exportFhirItem,
      this._exportQrItem,
    );
  }

  setHandlers({ onExportFhir, onExportQr }) {
    this._exportFhirItem.addEventListener('click', () => {
      document.dispatchEvent(new CustomEvent('close-dropdowns'));
      onExportFhir();
    });

    this._exportQrItem.addEventListener('click', () => {
      document.dispatchEvent(new CustomEvent('close-dropdowns'));
      onExportQr();
    });
  }
}
