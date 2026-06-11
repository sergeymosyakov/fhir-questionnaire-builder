// ── QR Export modal ───────────────────────────────────────────────────────────
// Shown before downloading a QuestionnaireResponse.
import { Modal } from './modal-base.js';
import { exportQR } from '../../fhir/qr-export.js';
import { createCustomSelect } from '../custom-select.js';
import { AppEvents } from '../../events.js';

const QR_STATUSES = ['in-progress', 'completed', 'amended', 'entered-in-error', 'stopped'];

// QR pre-fill state — owned here, not in state.js.
const _qrMeta = {
  status: 'in-progress', subject: '', author: '',
  id: '', language: '',
  metaVersionId: '', metaSource: '',
  metaProfile: [], metaTag: [], metaSecurity: [],
};

function _resetQrMeta() {
  _qrMeta.status        = 'in-progress';
  _qrMeta.subject       = '';
  _qrMeta.author        = '';
  _qrMeta.id            = '';
  _qrMeta.language      = '';
  _qrMeta.metaVersionId = '';
  _qrMeta.metaSource    = '';
  _qrMeta.metaProfile   = [];
  _qrMeta.metaTag       = [];
  _qrMeta.metaSecurity  = [];
}

document.addEventListener(AppEvents.QUESTIONNAIRE_LOADED, _resetQrMeta);
document.addEventListener(AppEvents.QR_LOADED, e => {
  _qrMeta.status        = e.detail.status        || 'in-progress';
  _qrMeta.subject       = e.detail.subject       || '';
  _qrMeta.author        = e.detail.author        || '';
  _qrMeta.id            = e.detail.id            || '';
  _qrMeta.language      = e.detail.language      || '';
  _qrMeta.metaVersionId = e.detail.metaVersionId || '';
  _qrMeta.metaSource    = e.detail.metaSource    || '';
  _qrMeta.metaProfile   = (e.detail.metaProfile  || []).slice();
  _qrMeta.metaTag       = (e.detail.metaTag       || []).map(c => ({ ...c }));
  _qrMeta.metaSecurity  = (e.detail.metaSecurity  || []).map(c => ({ ...c }));
});

class QrExportModal extends Modal {
  getName() { return 'qrExportModal'; }
  constructor() {
    super();
    this._state = null;
  }

  open(suggestedName) {
    this._state = {
      fileName:     suggestedName || 'questionnaire-response.json',
      status:       _qrMeta.status,
      subject:      _qrMeta.subject,
      author:       _qrMeta.author,
      id:           _qrMeta.id,
      language:     _qrMeta.language,
      metaVersionId: _qrMeta.metaVersionId,
      metaSource:   _qrMeta.metaSource,
      metaProfile:  _qrMeta.metaProfile.slice(),
      metaTag:      _qrMeta.metaTag.map(c => ({ ...c })),
      metaSecurity: _qrMeta.metaSecurity.map(c => ({ ...c })),
    };
    this._renderBody();
    super.open();
  }

  _apply() {
    const s = this._state;
    const base = (s.fileName || 'questionnaire-response').replace(/\.json$/i, '');
    exportQR(base + '.json', {
      status:        s.status || 'in-progress',
      subject:       s.subject,
      author:        s.author,
      id:            s.id,
      language:      s.language,
      metaVersionId: s.metaVersionId,
      metaSource:    s.metaSource,
      metaProfile:   s.metaProfile,
      metaTag:       s.metaTag,
      metaSecurity:  s.metaSecurity,
    });
    this.close();
  }

  _cancel() {
    this.close();
  }

  _renderBody() {
    this.body.innerHTML = '';
    const s = this._state;

    // ── File name ─────────────────────────────────────────────────────────────
    const nameInp = document.createElement('input');
    nameInp.type  = 'text';
    nameInp.id    = 'qrExportFileName';
    nameInp.className      = 'meta-modal-inp';
    nameInp.value          = s.fileName;
    nameInp.dataset.testid = 'qr-export-filename';
    nameInp.oninput = () => { s.fileName = nameInp.value; };
    this.body.appendChild(_fieldRow('File name:', nameInp));

    // ── Status ────────────────────────────────────────────────────────────────
    const statusSel = createCustomSelect({
      items:    QR_STATUSES.map(v => ({ value: v, label: v })),
      value:    s.status,
      testid:   'qr-export-status',
      className: 'sc-trigger--sm',
      onChange: v => { s.status = v; },
    });
    this.body.appendChild(_fieldRow('Status:', statusSel.el));

    // ── Subject ───────────────────────────────────────────────────────────────
    const subjectInp = _textInp('qrExportSubject', 'qr-export-subject', 'Patient/123', s.subject,
      v => { s.subject = v; }, 'QuestionnaireResponse.subject', 'Reference to the person the answers are about. e.g. Patient/123');
    this.body.appendChild(_fieldRow('Subject:', subjectInp));

    // ── Author ────────────────────────────────────────────────────────────────
    const authorInp = _textInp('qrExportAuthor', 'qr-export-author', 'Practitioner/456', s.author,
      v => { s.author = v; }, 'QuestionnaireResponse.author', 'Who or what recorded the answers. e.g. Practitioner/456');
    this.body.appendChild(_fieldRow('Author:', authorInp));

    // ── Resource ID ───────────────────────────────────────────────────────────
    const idInp = _textInp('qrExportId', 'qr-export-id', 'e.g. my-response-001', s.id,
      v => { s.id = v; }, 'QuestionnaireResponse.id', 'Logical id of this resource. Left blank means the server assigns one on creation.');
    this.body.appendChild(_fieldRow('Resource ID:', idInp));

    // ── Language ──────────────────────────────────────────────────────────────
    const langInp = _textInp('qrExportLanguage', 'qr-export-language', 'e.g. en, nl, de', s.language,
      v => { s.language = v; }, 'QuestionnaireResponse.language', 'BCP-47 language code for the language of the resource (e.g. en, nl-NL).');
    this.body.appendChild(_fieldRow('Language:', langInp));

    // ── meta.versionId ────────────────────────────────────────────────────────
    const vidWrap = document.createElement('div');
    vidWrap.className = 'meta-modal-inp-group';
    const vidInp = _textInp('qrExportVersionId', 'qr-export-version-id', 'e.g. 1', s.metaVersionId,
      v => { s.metaVersionId = v; }, 'meta.versionId', 'Server-assigned version counter. Use Generate to create a local UUID.');
    const vidGenBtn = document.createElement('button');
    vidGenBtn.type           = 'button';
    vidGenBtn.className      = 'meta-modal-gen-btn';
    vidGenBtn.textContent    = 'Generate';
    vidGenBtn.dataset.testid = 'qr-export-version-id-generate';
    vidGenBtn.onclick = () => { const u = crypto.randomUUID(); vidInp.value = u; s.metaVersionId = u; };
    vidWrap.append(vidInp, vidGenBtn);
    this.body.appendChild(_fieldRow('Version ID:', vidWrap));

    // ── meta.source ───────────────────────────────────────────────────────────
    const srcInp = _textInp('qrExportMetaSource', 'qr-export-meta-source', 'https://example.org/...', s.metaSource,
      v => { s.metaSource = v; }, 'meta.source', 'URI identifying the system that created or last updated this resource.');
    this.body.appendChild(_fieldRow('Meta source:', srcInp));

    // ── meta.profile[] ────────────────────────────────────────────────────────
    this.body.appendChild(_profileSection(s));
  }
}

/** Generic text input helper */
function _textInp(id, testid, placeholder, value, oninput, tipFhir, tipBody) {
  const inp = document.createElement('input');
  inp.type           = 'text';
  inp.id             = id;
  inp.className      = 'meta-modal-inp';
  inp.placeholder    = placeholder;
  inp.value          = value;
  inp.dataset.testid = testid;
  if (tipFhir) {
    inp.dataset.tipTitle = tipFhir;
    inp.dataset.tipBody  = tipBody || '';
    inp.dataset.tipFhir  = tipFhir;
    inp.dataset.tipSpec  = 'R4';
  }
  inp.oninput = () => oninput(inp.value);
  return inp;
}

/** Profile URLs section (repeating list) */
function _profileSection(s) {
  const wrap = document.createElement('div');
  wrap.className = 'meta-modal-row meta-modal-row--col';

  const lbl = document.createElement('div');
  lbl.className        = 'meta-modal-lbl';
  lbl.textContent      = 'Meta profiles:';
  lbl.dataset.tipTitle = 'meta.profile[]';
  lbl.dataset.tipBody  = 'Canonical URLs of profiles this QR claims conformance to.';
  lbl.dataset.tipFhir  = 'QuestionnaireResponse.meta.profile';
  lbl.dataset.tipSpec  = 'R4';
  wrap.appendChild(lbl);

  const listWrap = document.createElement('div');

  const render = () => {
    listWrap.innerHTML = '';
    s.metaProfile.forEach((url, idx) => {
      const row = document.createElement('div');
      row.className = 'codes-row';
      const inp = document.createElement('input');
      inp.type           = 'url';
      inp.className      = 'codes-inp';
      inp.value          = url;
      inp.placeholder    = 'http://hl7.org/fhir/...';
      inp.dataset.testid = `qr-export-profile-url-${idx}`;
      inp.oninput = () => { s.metaProfile[idx] = inp.value; };
      const rm = document.createElement('button');
      rm.type           = 'button';
      rm.className      = 'codes-remove-btn';
      rm.textContent    = '\u00D7';
      rm.dataset.testid = `qr-export-profile-remove-${idx}`;
      rm.onclick = () => { s.metaProfile.splice(idx, 1); render(); };
      row.append(inp, rm);
      listWrap.appendChild(row);
    });
    const addBtn = document.createElement('button');
    addBtn.type           = 'button';
    addBtn.className      = 'codes-add-btn';
    addBtn.textContent    = '+ Add profile URL';
    addBtn.dataset.testid = 'qr-export-profile-add';
    addBtn.onclick = () => { s.metaProfile.push(''); render(); };
    listWrap.appendChild(addBtn);
  };
  render();
  wrap.appendChild(listWrap);
  return wrap;
}

function _fieldRow(labelText, inputEl) {
  const row = document.createElement('div');
  row.className = 'meta-modal-row';
  const lbl = document.createElement('label');
  lbl.className   = 'meta-modal-lbl';
  lbl.textContent = labelText;
  lbl.htmlFor     = inputEl.id || '';
  row.append(lbl, inputEl);
  return row;
}

const _modal = new QrExportModal();
export const open = (suggestedName) => _modal.open(suggestedName);
