import { DropdownMenu } from '../dropdown-menu.js';
import { readFileAsJSON } from '../../utils.js';
import * as libraryModal from '../modals/library-modal.js';
import { showError } from '../toast.js';
import { AppEvents } from '../../events.js';

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

    this._qrAnswers = null;

    // Hidden file input — closure keeps the reference, no instance property needed
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.json,application/json';
    fileInput.style.display = 'none';
    fileInput.dataset.testid = 'qr-file-input';
    fileInput.addEventListener('change', e => {
      readFileAsJSON(e)
        .then(({ data }) => this._qrAnswers.apply(data))
        .catch(err => err && showError('Parse error: ' + err.message));
    });
    document.body.appendChild(fileInput);
    this._pickFile = () => fileInput.click();

    this._bindTreeVisibility();
    this._buildMenu();
    this._bindHandlers();
  }

  configure({ qrAnswers }) { this._qrAnswers = qrAnswers; }

  _buildMenu() {
    this._loadAnswersItem = this._item(null, '&#x1F4C2; From file&hellip;', 'load-answers-from-file');
    this._loadAnswersLibraryItem = this._item(null, '&#x1F4DA; From Library&hellip;', 'load-answers-library-item');

    this._menu.append(
      this._loadAnswersItem,
      this._sep(),
      this._loadAnswersLibraryItem,
    );
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
          .then(data => this._qrAnswers.apply(data))
          .catch(err => showError('Could not load sample response: ' + err.message));
      }, 'qr');
    });
  }
}
