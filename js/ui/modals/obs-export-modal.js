// ── Observation Export modal ──────────────────────────────────────────────────
// Shown before downloading the extracted Observations transaction Bundle.
// Allows the user to supply QR metadata (subject, author, QR id) that flows
// into each generated Observation, and to opt into the SDC Observation profile.
import { Modal } from './modal-base.js';
import { exportObservations } from '../../fhir/obs-export.js';
import { AppEvents } from '../../events.js';
import { FHIR } from '../../fhir/urls/fhir.js';

const SDC_OBS_PROFILE = FHIR.sdcObservation;

class ObsExportModal extends Modal {
  getName() { return 'obsExportModal'; }
  constructor() {
    super({ maxWidth: '420px' });
    this.setTitle('Export Observations');
    this._state = null;
    // Sync subject/author from QR meta when a QR is loaded
    document.addEventListener(AppEvents.QR_LOADED, e => {
      this._saved = {
        subject: e.detail.subject || '',
        author:  e.detail.author  || '',
        qrId:    e.detail.id      || '',
      };
    });
    document.addEventListener(AppEvents.QUESTIONNAIRE_LOADED, () => { this._saved = null; });
    this._saved = null;
  }

  open(suggestedName) {
    const saved = this._saved || {};
    this._state = {
      fileName:   suggestedName || 'observations.json',
      subject:    saved.subject || '',
      author:     saved.author  || '',
      qrId:       saved.qrId   || '',
      addProfile: true,
    };
    this._renderBody();
    super.open();
  }

  _apply() {
    const s = this._state;
    const base = (s.fileName || 'observations').replace(/\.json$/i, '');
    exportObservations(base + '.json', {
      subject:    s.subject    || undefined,
      author:     s.author     || undefined,
      qrId:       s.qrId       || undefined,
      addProfile: s.addProfile,
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
    const nameInp = _inp('obsExportFileName', 'obs-export-filename', 'observations.json',
      s.fileName, v => { s.fileName = v; });
    this.body.appendChild(_row('File name:', nameInp));

    // ── Subject ───────────────────────────────────────────────────────────────
    const subjectInp = _tipInp('obsExportSubject', 'obs-export-subject', 'Patient/123',
      s.subject, v => { s.subject = v; },
      'Observation.subject',
      'Reference to the patient the Observations are about. Copied to every Observation in the Bundle. e.g. Patient/123',
      'R4');
    this.body.appendChild(_row('Subject:', subjectInp));

    // ── Author / Performer ───────────────────────────────────────────────────
    const authorInp = _tipInp('obsExportAuthor', 'obs-export-author', 'Practitioner/456',
      s.author, v => { s.author = v; },
      'Observation.performer',
      'Who performed the observation. Sourced from QR.author and copied to Observation.performer[]. e.g. Practitioner/456',
      'R4');
    this.body.appendChild(_row('Author:', authorInp));

    // ── QR resource ID ───────────────────────────────────────────────────────
    const qrIdInp = _tipInp('obsExportQrId', 'obs-export-qr-id', 'e.g. my-response-001',
      s.qrId, v => { s.qrId = v; },
      'Observation.derivedFrom',
      'Logical id for the QuestionnaireResponse. Used to build Observation.derivedFrom reference: "QuestionnaireResponse/<id>". Leave blank for a display-only reference.',
      'R4');
    this.body.appendChild(_row('QR resource ID:', qrIdInp));

    // ── SDC Observation profile ───────────────────────────────────────────────
    const profRow = document.createElement('div');
    profRow.className = 'meta-modal-row';

    // empty spacer to align with input column
    const profSpacer = document.createElement('span');
    profSpacer.className = 'meta-modal-lbl';
    profSpacer.setAttribute('aria-hidden', 'true');

    const profInner = document.createElement('div');
    profInner.className = 'obs-export-prof-row';

    const profChk = document.createElement('input');
    profChk.type           = 'checkbox';
    profChk.id             = 'obsExportProfile';
    profChk.dataset.testid = 'obs-export-profile-chk';
    profChk.checked        = s.addProfile;
    profChk.addEventListener('change', () => { s.addProfile = profChk.checked; });

    const profLbl = document.createElement('label');
    profLbl.htmlFor          = 'obsExportProfile';
    profLbl.className        = 'obs-export-prof-lbl';
    profLbl.textContent      = 'Add SDC profile';
    profLbl.dataset.tipTitle = 'meta.profile — sdc-observation';
    profLbl.dataset.tipBody  = `Adds meta.profile = ["${SDC_OBS_PROFILE}"] to each generated Observation. Recommended by the SDC IG to declare conformance.`;
    profLbl.dataset.tipFhir  = 'Observation.meta.profile';
    profLbl.dataset.tipSpec  = 'SDC';

    profInner.append(profChk, profLbl);
    profRow.append(profSpacer, profInner);
    this.body.appendChild(profRow);
  }
}

function _inp(id, testid, placeholder, value, oninput) {
  const inp = document.createElement('input');
  inp.type           = 'text';
  inp.id             = id;
  inp.className      = 'meta-modal-inp';
  inp.placeholder    = placeholder;
  inp.value          = value;
  inp.dataset.testid = testid;
  inp.oninput = () => oninput(inp.value);
  return inp;
}

function _tipInp(id, testid, placeholder, value, oninput, tipFhir, tipBody, tipSpec) {
  const inp = _inp(id, testid, placeholder, value, oninput);
  inp.dataset.tipTitle = tipFhir;
  inp.dataset.tipBody  = tipBody;
  inp.dataset.tipFhir  = tipFhir;
  inp.dataset.tipSpec  = tipSpec || 'R4';
  return inp;
}

function _row(labelText, inputEl) {
  const row = document.createElement('div');
  row.className = 'meta-modal-row';
  const lbl = document.createElement('label');
  lbl.className   = 'meta-modal-lbl';
  lbl.textContent = labelText;
  lbl.htmlFor     = inputEl.id || '';
  row.append(lbl, inputEl);
  return row;
}

const _modal = new ObsExportModal();
export const open = (suggestedName) => _modal.open(suggestedName);
