import { DropdownMenu } from '../dropdown-menu.js';
import { AppEvents } from '../../events.js';
import * as qrExportModal from '../modals/qr-export-modal.js';
import * as obsExportModal from '../modals/obs-export-modal.js';
import { saveFormatModal } from '../modals/save-format-modal.js';

export class SaveMenu extends DropdownMenu {
  static _svc = { questDoc: null, answerStore: null };

  static {
    if (typeof document !== 'undefined') {
      const _update = e => {
        if (e.detail?.questDoc)   SaveMenu._svc.questDoc   = e.detail.questDoc;
        if (e.detail?.answerStore) SaveMenu._svc.answerStore = e.detail.answerStore;
      };
      document.addEventListener(AppEvents.APP_CONTEXT_READY,    _update);
      document.addEventListener(AppEvents.QUESTIONNAIRE_LOADED, _update);
    }
  }
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

    this._fileName = '';
    document.addEventListener(AppEvents.FILE_NAME_CHANGED, e => { this._fileName = e.detail.name; });
    // EXPORT_PROMPT_REQUESTED: open export dialog, resolve when done
    document.addEventListener(AppEvents.EXPORT_PROMPT_REQUESTED, e => {
      this.promptExport(() => e.detail.resolve());
    });

    this._bindTreeVisibility();
    this._buildMenu();
    this._bindHandlers();
  }

  get cloudSaveBtn() { return this._cloudSaveBtn; }
  get cloudSaveSep() { return this._cloudSaveSep; }

  /** Prompt for filename then export FHIR JSON via saveFormatModal. */
  promptExport() {
    saveFormatModal.open({
      fileName: this._fileName,
      tree:   SaveMenu._svc.questDoc?.tree,
      values: SaveMenu._svc.answerStore?.data,
    });
  }

  _buildMenu() {
    this._cloudSaveBtn = this._item(null, '&#x2601;&#xFE0F; Cloud', 'cloud-save-btn');
    this._cloudSaveBtn.dataset.mount = 'auth-cloud-save-btn';
    this._cloudSaveBtn.style.display = 'none';

    this._cloudSaveSep = this._sep();
    this._cloudSaveSep.dataset.mount = 'auth-cloud-save-sep';
    this._cloudSaveSep.style.display = 'none';

    this._exportQuestItem = this._item(null, '&#x1F4C4; Questionnaire &middot; FHIR JSON', 'export-quest-item');
    this._exportQrItem    = this._item(null, '&#x1F4CB; QuestionnaireResponse &middot; FHIR JSON', 'export-qr-item');
    this._exportObsItem   = this._item(null, '&#x1F9EA; Observations &middot; FHIR JSON Bundle', 'export-obs-item');

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
        fileName: this._fileName,
        tree:   SaveMenu._svc.questDoc?.tree,
        values: SaveMenu._svc.answerStore?.data,
      });
    });

    this._exportQrItem.addEventListener('click', () => {
      document.dispatchEvent(new CustomEvent(AppEvents.CLOSE_DROPDOWNS));
      const suggested = this._fileName.trim() || 'questionnaire';
      qrExportModal.open(suggested + '-response.json');
    });

    this._exportObsItem.addEventListener('click', () => {
      document.dispatchEvent(new CustomEvent(AppEvents.CLOSE_DROPDOWNS));
      const suggested = this._fileName.trim() || 'questionnaire';
      obsExportModal.open(suggested + '-observations.json');
    });
  }
}
