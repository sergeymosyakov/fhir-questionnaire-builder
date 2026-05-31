// ── Metadata Card ─────────────────────────────────────────────────────────────
// Summary card showing questionnaire status + experimental badge.
// Updated via AppEvents (no @vue/reactivity effect).
import { AppEvents } from '../events.js';

const _CARD_HTML = `
<span class="quest-meta-card-label">Questionnaire</span>
<span class="quest-meta-card-status" data-testid="quest-meta-status"
  data-tip-title="Publication status"
  data-tip-body="Lifecycle status of this questionnaire: draft (work in progress), active (published and in use), retired (no longer used), or unknown."
  data-tip-fhir="Questionnaire.status"
  data-tip-spec="R4 &middot; required"></span>
<span class="quest-meta-card-experimental" data-testid="quest-meta-experimental"
  data-tip-title="Experimental flag"
  data-tip-body="experimental=true means this questionnaire is for testing only and should not be used in production. experimental=false means it is production-ready."
  data-tip-fhir="Questionnaire.experimental"
  data-tip-spec="R4 &middot; optional"
  style="display:none"></span>
<button type="button" class="quest-meta-edit-btn" data-testid="properties-btn"
  data-tip-title="Questionnaire Properties"
  data-tip-body="Edit questionnaire-level metadata: id, url, version, title, status, publisher and description. These fields are preserved on import and written back on export.">Edit</button>`;

export class MetadataCard {
  /** @param {{ questMeta: object, mountEl: HTMLElement, onEdit: Function }} deps */
  constructor({ questMeta, mountEl, onEdit }) {
    const card = document.createElement('div');
    card.className = 'quest-meta-card';
    card.dataset.testid = 'quest-meta-card';
    card.style.display = 'none';
    card.innerHTML = _CARD_HTML;
    mountEl.replaceWith(card);

    this._card         = card;
    this._status       = card.querySelector('.quest-meta-card-status');
    this._experimental = card.querySelector('.quest-meta-card-experimental');
    this._questMeta    = questMeta;

    card.querySelector('.quest-meta-edit-btn').onclick = () => onEdit();

    document.addEventListener(AppEvents.QUESTIONNAIRE_META_CHANGED, () => this._update());
    document.addEventListener(AppEvents.QUESTIONNAIRE_LOADED,  () => { this._update(); this._card.style.display = ''; });
    document.addEventListener(AppEvents.QUESTIONNAIRE_NEW,     () => { this._update(); this._card.style.display = ''; });
    document.addEventListener(AppEvents.QUESTIONNAIRE_CLEARED, () => { this._card.style.display = 'none'; });
  }

  _update() {
    const questMeta = this._questMeta;
    this._status.textContent    = questMeta.status || 'draft';
    this._status.dataset.status = questMeta.status || 'draft';
    const exp = questMeta.experimental;
    if (exp === null || exp === undefined) {
      this._experimental.style.display = 'none';
    } else {
      this._experimental.style.display  = '';
      this._experimental.textContent    = exp ? '\u2697 experimental' : '\u2713 production';
      this._experimental.dataset.exp    = String(exp);
    }
  }
}
