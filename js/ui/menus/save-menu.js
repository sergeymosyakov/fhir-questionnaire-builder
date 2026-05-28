import { DropdownMenu } from '../dropdown-menu.js';
import { AppEvents } from '../../events.js';
import { exportFHIR } from '../../fhir/export.js';
import { validateTree } from '../../fhir/validate.js';
import * as validateModal from '../modals/validate-modal.js';
import * as qrExportModal from '../modals/qr-export-modal.js';
import { showPrompt } from '../toast.js';

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

  /** Prompt for filename then export. Calls afterExport on success. */
  promptExport(afterExport) {
    const suggested = this._fileNameDisplay.getName().trim() || 'questionnaire';
    showPrompt('Save as:', suggested + '.json', name => {
      if (name === null) return;
      const trimmed = name.replace(/\.json$/i, '');
      exportFHIR(trimmed + '.json');
      this._fileNameDisplay.setName(trimmed);
      if (afterExport) afterExport();
    });
  }

  _buildMenu() {
    this._cloudSaveBtn = this._item(null, '&#x2601;&#xFE0F; Cloud', 'cloud-save-btn');
    this._cloudSaveBtn.style.display = 'none';

    this._cloudSaveSep = this._sep();
    this._cloudSaveSep.style.display = 'none';

    this._exportFhirItem = this._item(null, '&#x1F4C4; Questionnaire &middot; JSON file', 'export-fhir-item');
    this._exportQrItem = this._item(null, '&#x1F4CB; QuestionnaireResponse &middot; JSON file', 'export-qr-item');

    this._menu.append(
      this._cloudSaveBtn,
      this._cloudSaveSep,
      this._exportFhirItem,
      this._exportQrItem,
    );

    this._cloudSaveBtn.addEventListener('click', () => {
      document.dispatchEvent(new CustomEvent(AppEvents.CLOSE_DROPDOWNS));
      document.dispatchEvent(new CustomEvent(AppEvents.CLOUD_SAVE_REQUESTED));
    });
  }

  _bindHandlers() {
    this._exportFhirItem.addEventListener('click', () => {
      document.dispatchEvent(new CustomEvent(AppEvents.CLOSE_DROPDOWNS));
      const issues = validateTree(this._tree, this._values);
      if (issues.length === 0) { this.promptExport(); return; }
      validateModal.show('Export \u2014 Validation Report', issues, 'export', {
        onExport: () => this.promptExport(),
      });
    });

    this._exportQrItem.addEventListener('click', () => {
      document.dispatchEvent(new CustomEvent(AppEvents.CLOSE_DROPDOWNS));
      const suggested = this._fileNameDisplay.getName().trim() || 'questionnaire';
      qrExportModal.open(suggested + '-response.json');
    });
  }
}
