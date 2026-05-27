import { DropdownMenu } from '../dropdown-menu.js';
import { _applyQRAnswers, _readFileAsJSON } from '../../app-load.js';
import * as libraryModal from '../modals/library-modal.js';
import { showError } from '../toast.js';

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

    // Hidden file input for QuestionnaireResponse files
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.id = 'qrFileInput';
    fileInput.accept = '.json,application/json';
    fileInput.style.display = 'none';
    document.body.appendChild(fileInput);

    this._wrap.style.display = 'none';
    this._buildMenu();
    this._bindHandlers();
  }

  _buildMenu() {
    this._loadAnswersItem = this._item('loadAnswersItem', '&#x1F4C2; From file&hellip;', 'load-answers-from-file');
    this._loadAnswersLibraryItem = this._item('loadAnswersLibraryItem', '&#x1F4DA; From Library&hellip;', 'load-answers-library-item');

    this._menu.append(
      this._loadAnswersItem,
      this._sep(),
      this._loadAnswersLibraryItem,
    );
  }

  _bindHandlers() {
    this._loadAnswersItem.addEventListener('click', () => {
      document.dispatchEvent(new CustomEvent('close-dropdowns'));
      document.getElementById('qrFileInput').click();
    });

    document.getElementById('qrFileInput').addEventListener('change', e => {
      _readFileAsJSON(e, data => _applyQRAnswers(data));
    });

    this._loadAnswersLibraryItem.addEventListener('click', () => {
      document.dispatchEvent(new CustomEvent('close-dropdowns'));
      libraryModal.open('qr-responses', item => {
        fetch('sampledata/' + item.file)
          .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
          .then(data => _applyQRAnswers(data))
          .catch(err => showError('Could not load sample response: ' + err.message));
      }, 'qr');
    });
  }
}
