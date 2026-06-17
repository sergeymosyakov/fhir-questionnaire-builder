import { DropdownMenu } from '../dropdown-menu.js';
import * as autosave from '../autosave.js';
import * as libraryModal from '../modals/library-modal.js';
import * as progress from '../progress.js';
import { AppEvents } from '../../events.js';
import { showError } from '../toast.js';
import { loadFormatModal } from '../modals/load-format-modal.js';

export class QuestionnairesMenu extends DropdownMenu {
  constructor() {
    super({
      btnId:    'loadFhirBtn',
      menuId:   'loadMenu',
      label:    'Questionnaires &#x25BE;',
      testid:   'load-fhir-btn',
      tipTitle: 'Load questionnaire',
      tipBody:  'Open a FHIR R4 Questionnaire JSON from a file or pick one of the built-in samples. Replaces the current questionnaire (you will be asked to export first if unsaved changes exist).',
      tipFhir:  'Questionnaire (FHIR R4)',
      tipSpec:  'R4',
    });

    this._menu.classList.add('load-menu--right');

    this._buildMenu();
    this._bindHandlers();
    this._onOpen = () => this._syncRecentItem();
  }

  get cloudItem() { return this._cloudItem; }
  get cloudSep() { return this._cloudSep; }

  _buildMenu() {
    this._recentItem = this._item('loadRecentItem', '&#x1F552; Recent draft&hellip;', 'load-recent-item');
    this._recentItem.style.display = 'none';

    this._recentSep = this._sep();
    this._recentSep.style.display = 'none';

    this._cloudSep = this._sep();
    this._cloudSep.style.display = 'none';

    this._cloudItem = this._item(null, '&#x2601;&#xFE0F; From Cloud&hellip;', 'load-cloud-item');
    this._cloudItem.style.display = 'none';

    this._loadFromFileItem = this._item('loadFromFileItem', '&#x1F4C2; From file&hellip;', 'load-from-file-item');
    this._loadLibraryItem = this._item('loadLibraryItem', '&#x1F4DA; From Library&hellip;', 'load-library-item');

    this._menu.append(
      this._recentItem,
      this._recentSep,
      this._loadFromFileItem,
      this._sep(),
      this._loadLibraryItem,
      this._cloudSep,
      this._cloudItem,
    );

    this._cloudItem.addEventListener('click', () => {
      document.dispatchEvent(new CustomEvent(AppEvents.CLOSE_DROPDOWNS));
      document.dispatchEvent(new CustomEvent(AppEvents.CLOUD_LOAD_REQUESTED));
    });
  }

  _bindHandlers() {
    this._recentItem.addEventListener('click', async () => {
      document.dispatchEvent(new CustomEvent(AppEvents.CLOSE_DROPDOWNS));
      const key = this._recentItem.dataset.draftKey;
      if (!key) return;
      const data = await autosave.getDraftData(key);
      if (!data) return;
      progress.show('Loading recent draft\u2026');
      document.dispatchEvent(new CustomEvent(AppEvents.QUESTIONNAIRE_LOAD_REQUESTED, {
        detail: { data, fileName: data.title || 'autosave-draft' },
      }));
    });

    this._loadFromFileItem.addEventListener('click', () => {
      document.dispatchEvent(new CustomEvent(AppEvents.CLOSE_DROPDOWNS));
      loadFormatModal.open((data, fileName) => {
        progress.show('Loading ' + fileName + '\u2026');
        progress.update(0, 1);
        document.dispatchEvent(new CustomEvent(AppEvents.QUESTIONNAIRE_LOAD_REQUESTED, {
          detail: { data, fileName },
        }));
      });
    });

    this._loadLibraryItem.addEventListener('click', () => {
      document.dispatchEvent(new CustomEvent(AppEvents.CLOSE_DROPDOWNS));
      libraryModal.open('fhir-r4', item => {
        progress.show('Loading ' + item.label + '\u2026');
        fetch('sampledata/' + item.file)
          .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
          .then(data => {
            progress.update(0, 1);
            document.dispatchEvent(new CustomEvent(AppEvents.QUESTIONNAIRE_LOAD_REQUESTED, {
              detail: { data, fileName: item.label },
            }));
          })
          .catch(err => { progress.hide(); showError('Could not load sample: ' + err.message); });
      }, 'questionnaire');
    });
  }

  async _syncRecentItem() {
    const recent = await autosave.getMostRecentDraft();
    if (recent) {
      const d = new Date(recent.meta.savedAt);
      const ts = d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      this._recentItem.textContent = '\uD83D\uDD52 Recent: ' + (recent.meta.title || 'draft') + ' (' + ts + ')';
      this._recentItem.dataset.draftKey = recent.key;
      this._recentItem.style.display = '';
      this._recentSep.style.display  = '';
    } else {
      this._recentItem.style.display = 'none';
      this._recentSep.style.display  = 'none';
    }
  }
}
