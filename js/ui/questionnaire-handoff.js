// Builder side of the hand-off: opens the Questionnaire another page left for this tab (?handoff=<id>) through the normal load request.
import { AppEvents } from '../events.js';
import { takeHandoff } from '../core/questionnaire-handoff.js';
import { notifyError } from '../core/ui-requests.js';

export class QuestionnaireHandoff {
  constructor() {
    const params = new URLSearchParams(location.search);
    const id = params.get('handoff');
    if (!id) return;
    params.delete('handoff');
    const rest = params.toString();
    history.replaceState(null, '', `${location.pathname}${rest ? `?${rest}` : ''}${location.hash}`); // a reload must not look for it again
    takeHandoff(id).then((data) => {
      if (!data) { notifyError('The questionnaire sent from the check page is no longer available. Open it from the check page again.'); return; }
      setTimeout(() => this._open(data), 0); // after the builder panels have subscribed
    }).catch(() => notifyError('The questionnaire sent from the check page could not be read.'));
  }

  // Asks before replacing a form that is already open; a fresh tab is empty, so nothing is asked.
  async _open(data) {
    const proceed = await new Promise((resolve) => document.dispatchEvent(new CustomEvent(AppEvents.QUESTIONNAIRE_LOAD_CONFIRM_REQUESTED, { detail: { resolve } })));
    if (proceed) document.dispatchEvent(new CustomEvent(AppEvents.QUESTIONNAIRE_LOAD_REQUESTED, { detail: { data, fileName: 'checked-questionnaire.json' } }));
  }
}
