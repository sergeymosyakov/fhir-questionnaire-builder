import { DropdownMenu } from '../dropdown-menu.js';
import { AppEvents } from '../../events.js';
import * as qrExportModal from '../modals/qr-export-modal.js';
import * as obsExportModal from '../modals/obs-export-modal.js';
import { saveFormatModal } from '../modals/save-format-modal.js';

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

    this._fileNameDisplay = null;
    this._tree   = null;
    this._values = null;

    this._bindTreeVisibility();
    this._buildMenu();
    this._bindHandlers();
  }

  /** @param {{ fileNameDisplay, tree, values }} deps */
  configure({ fileNameDisplay, tree, values }) {
    this._fileNameDisplay = fileNameDisplay;
    this._tree   = tree;
    this._values = values;
  }

  get cloudSaveBtn() { return this._cloudSaveBtn; }
  get cloudSaveSep() { return this._cloudSaveSep; }

  /** Prompt for filename then export FHIR JSON via saveFormatModal. */
  promptExport() {
    saveFormatModal.open({
      fileNameDisplay: this._fileNameDisplay,
      tree:   this._tree,
      values: this._values,
    });
  }

  _buildMenu() {
    this._cloudSaveBtn = this._item(null, '&#x2601;&#xFE0F; Cloud', 'cloud-save-btn');
    this._cloudSaveBtn.style.display = 'none';

    this._cloudSaveSep = this._sep();
    this._cloudSaveSep.style.display = 'none';

    this._exportQuestItem = this._item(null, '&#x1F4C4; Questionnaire&hellip;', 'export-quest-item');
    this._exportQrItem    = this._item(null, '&#x1F4CB; QuestionnaireResponse &middot; JSON file', 'export-qr-item');
    this._exportObsItem   = this._item(null, '&#x1F9EA; Observations &middot; transaction Bundle', 'export-obs-item');

    this._menu.append(
      this._cloudSaveBtn,
      this._cloudSaveSep,
      this._exportQuestItem,
      this._exportQrItem,
      this._exportObsItem,
    );

    this._cloudSaveBtn.addEventListener('click', () => {
      document.dispatchEvent(new CustomEvent(AppEvents.CLOSE_DROPDOWNS));
      document.dispatchEvent(new CustomEvent(AppEvents.CLOUD_SAVE_REQUESTED));
    });
  }

  _bindHandlers() {
    this._exportQuestItem.addEventListener('click', () => {
      document.dispatchEvent(new CustomEvent(AppEvents.CLOSE_DROPDOWNS));
      saveFormatModal.open({
        fileNameDisplay: this._fileNameDisplay,
        tree:   this._tree,
        values: this._values,
      });
    });

    this._exportQrItem.addEventListener('click', () => {
      document.dispatchEvent(new CustomEvent(AppEvents.CLOSE_DROPDOWNS));
      const suggested = this._fileNameDisplay.getName().trim() || 'questionnaire';
      qrExportModal.open(suggested + '-response.json');
    });

    this._exportObsItem.addEventListener('click', () => {
      document.dispatchEvent(new CustomEvent(AppEvents.CLOSE_DROPDOWNS));
      const suggested = this._fileNameDisplay.getName().trim() || 'questionnaire';
      obsExportModal.open(suggested + '-observations.json');
    });
  }
}
