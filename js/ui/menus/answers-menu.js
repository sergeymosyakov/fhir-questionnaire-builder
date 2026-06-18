import { DropdownMenu } from '../dropdown-menu.js';
import { readFileAsJSON } from '../../utils.js';
import * as libraryModal from '../modals/library-modal.js';
import { showError } from '../toast.js';
import { AppEvents, EventState } from '../../events.js';
import { sdcPopulateModal } from '../modals/sdc-populate-modal.js';
import { serverConfig, CONFIG_KEYS } from '../../fhir/server-config.js';

export class AnswersMenu extends DropdownMenu {
  constructor() {
    super({
      btnId:    'answersBtn',
      menuId:   'answersMenu',
      wrapId:   'answersWrap',
      label:    '&#x1F4E5; Answers &#x25BE;',
      testid:   'answers-btn',
      tipTitle: 'Load Answers',
      tipBody:  'Load answers from a QuestionnaireResponse file, or pick a sample response for the current questionnaire.',
    });

    // Hidden file input for QR file picker
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.json,application/json';
    fileInput.style.display = 'none';
    fileInput.dataset.testid = 'qr-file-input';
    fileInput.addEventListener('change', e => {
      readFileAsJSON(e)
        .then(({ data }) => document.dispatchEvent(new CustomEvent(AppEvents.QR_ANSWERS_REQUESTED, { detail: { data } })))
        .catch(err => err && showError('Parse error: ' + err.message));
    });
    document.body.appendChild(fileInput);
    this._pickFile = () => fileInput.click();

    this._bindTreeVisibility();
    this._buildMenu();
    this._bindHandlers();
  }

  _buildMenu() {
    this._loadAnswersItem = this._item(null, '&#x1F4C2; From file&hellip;', 'load-answers-from-file');
    this._loadAnswersLibraryItem = this._item(null, '&#x1F4DA; From Library&hellip;', 'load-answers-library-item');
    this._populateItem = this._item(null, '&#x21A7; Fill from FHIR Server&hellip;', 'sdc-populate-btn');
    this._populateItem.style.display = 'none'; // hidden until fhirBaseUrl set

    this._menu.append(
      this._loadAnswersItem,
      this._sep(),
      this._loadAnswersLibraryItem,
      this._sep(),
      this._populateItem,
    );

    // Show/hide populate item based on fhirBaseUrl config
    const _syncPopulate = () => {
      const hasBase = !!serverConfig.get(CONFIG_KEYS.FHIR_BASE);
      const hasQ    = !!EventState.get(AppEvents.QUESTIONNAIRE_LOADED);
      this._populateItem.style.display = (hasBase && hasQ) ? '' : 'none';
    };
    document.addEventListener(AppEvents.QUESTIONNAIRE_LOADED,  _syncPopulate);
    document.addEventListener(AppEvents.QUESTIONNAIRE_CLEARED, _syncPopulate);
    document.addEventListener(AppEvents.APP_CONTEXT_READY,     _syncPopulate);
    _syncPopulate();
  }

  _bindHandlers() {
    this._loadAnswersItem.addEventListener('click', () => {
      document.dispatchEvent(new CustomEvent(AppEvents.CLOSE_DROPDOWNS));
      this._pickFile();
    });

    this._loadAnswersLibraryItem.addEventListener('click', () => {
      document.dispatchEvent(new CustomEvent(AppEvents.CLOSE_DROPDOWNS));
      libraryModal.open('qr-responses', item => {
        fetch('sampledata/' + item.file)
          .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
          .then(data => document.dispatchEvent(new CustomEvent(AppEvents.QR_ANSWERS_REQUESTED, { detail: { data } })))
          .catch(err => showError('Could not load sample response: ' + err.message));
      }, 'qr');
    });

    this._populateItem.addEventListener('click', () => {
      document.dispatchEvent(new CustomEvent(AppEvents.CLOSE_DROPDOWNS));
      sdcPopulateModal.open();
    });
  }
}
