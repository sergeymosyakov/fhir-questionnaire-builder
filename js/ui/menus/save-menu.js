import { DropdownMenu } from '../dropdown-menu.js';
import { AppEvents, EventState } from '../../events.js';
import * as qrExportModal from '../modals/qr-export-modal.js';
import * as obsExportModal from '../modals/obs-export-modal.js';
import { saveFormatModal } from '../modals/save-format-modal.js';
import { generateQuestionnaireDoc } from '../../fhir/doc-generator.js';

const DOCS_STORAGE_KEY = 'fhirqb.generatedDocs';

export class SaveMenu extends DropdownMenu {
  constructor() {
    super({
      btnId:    'exportBtn',
      menuId:   'exportMenu',
      wrapId:   'exportWrap',
      label:    '&#x2B07; Save &#x25BE;',
      menuTitle: 'Save',
      btnClass: 'btn-fhir btn-fhir-export',
      testid:   'export-btn',
      tipTitle: 'Save / Export',
      tipBody:  'Save to cloud or export the questionnaire as FHIR R4 JSON, or download current answers as a QuestionnaireResponse.',
    });

    this._menu.classList.add('load-menu--right');

    this._questDoc    = EventState.get(AppEvents.APP_CONTEXT_READY)?.questDoc    ?? null;
    this._answerStore = EventState.get(AppEvents.APP_CONTEXT_READY)?.answerStore ?? null;
    const _update = e => {
      if (e.detail?.questDoc)    this._questDoc    = e.detail.questDoc;
      if (e.detail?.answerStore) this._answerStore = e.detail.answerStore;
    };
    document.addEventListener(AppEvents.APP_CONTEXT_READY,    _update);
    document.addEventListener(AppEvents.QUESTIONNAIRE_LOADED, _update);

    this._fileName = '';
    document.addEventListener(AppEvents.FILE_NAME_CHANGED, e => { this._fileName = e.detail?.name; });
    // EXPORT_PROMPT_REQUESTED: open export dialog, resolve when done
    document.addEventListener(AppEvents.EXPORT_PROMPT_REQUESTED, e => {
      this.promptExport(() => e.detail?.resolve());
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
      tree:   this._questDoc?.tree,
      values: this._answerStore?.data,
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
    this._exportDefItem   = this._item(null, '&#x1F9E9; Definition Extract &middot; FHIR JSON Bundle', 'export-def-extract-item');
    this._exportSmItem    = this._item(null, '&#x1F5FA;&#xFE0F; StructureMap Extract &middot; FHIR JSON Bundle', 'export-structuremap-extract-item');
    this._generateDocsItem = this._item(null, '&#x1F4D6; Generate Docs&hellip;', 'generate-docs-item');

    this._menu.append(
      this._cloudSaveBtn,
      this._cloudSaveSep,
      this._exportQuestItem,
      this._exportQrItem,
      this._exportObsItem,
      this._exportDefItem,
      this._exportSmItem,
      this._generateDocsItem,
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
        fhirTarget: EventState.get(AppEvents.APP_CONTEXT_READY)?.questDoc?.fhirTarget ?? 'R4',
        fileName: this._fileName,
        tree:   this._questDoc?.tree,
        values: this._answerStore?.data,
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

    this._exportDefItem.addEventListener('click', () => {
      document.dispatchEvent(new CustomEvent(AppEvents.CLOSE_DROPDOWNS));
      document.dispatchEvent(new CustomEvent(AppEvents.DEF_EXTRACT_REQUESTED));
    });

    this._exportSmItem.addEventListener('click', () => {
      document.dispatchEvent(new CustomEvent(AppEvents.CLOSE_DROPDOWNS));
      document.dispatchEvent(new CustomEvent(AppEvents.STRUCTUREMAP_EXTRACT_REQUESTED));
    });

    this._generateDocsItem.addEventListener('click', () => {
      document.dispatchEvent(new CustomEvent(AppEvents.CLOSE_DROPDOWNS));
      this._openGeneratedDocs();
    });
  }

  /** Build the doc model for the current questionnaire and open it in a new tab. */
  _openGeneratedDocs() {
    if (!this._questDoc) return;
    const doc = generateQuestionnaireDoc({
      tree:         this._questDoc.tree,
      questMeta:    this._questDoc.meta,
      values:       this._answerStore?.toValueMap() ?? {},
      variables:    this._questDoc.variables,
      contained:    this._questDoc.contained,
      translations: this._questDoc.translations,
      fp:           window.fhirpath,
    });
    try {
      sessionStorage.setItem(DOCS_STORAGE_KEY, JSON.stringify(doc));
    } catch { /* storage unavailable — page will show its empty state */ }
    window.open('questionnaire-docs.html', '_blank');
  }
}
