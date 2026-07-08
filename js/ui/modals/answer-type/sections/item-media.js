import { AnswerTypeSection } from '../base-section.js';
import { ANSWER_TYPE_SECTIONS } from '../registry.js';

/** Item-level media attachment (sdc-questionnaire-itemMedia).
 *  Displays a URL input for the media source. */
class ItemMediaSection extends AnswerTypeSection {
  isVisible(_type) { return true; }

  build(pending) {
    const section = document.createElement('div');
    section.className = 'at-modal-sub';

    const lbl = document.createElement('div');
    lbl.className        = 'at-modal-sub-lbl at-modal-sub-lbl--tip';
    lbl.textContent      = 'Item media URL:';
    lbl.dataset.tipTitle = 'sdc-questionnaire-itemMedia';
    lbl.dataset.tipBody  = 'URL of an image, audio, or video file to display alongside the question text. Exported as sdc-questionnaire-itemMedia valueAttachment.';
    lbl.dataset.tipFhir  = 'item.extension[sdc-questionnaire-itemMedia].valueAttachment.url';
    lbl.dataset.tipSpec  = 'SDC';

    const inp = document.createElement('input');
    inp.type           = 'text';
    inp.className      = 'at-modal-placeholder-inp';
    inp.dataset.testid = 'item-media-url-input';
    inp.value          = pending.draftItemMediaUrl;
    inp.placeholder    = 'https://example.com/image.png';
    inp.oninput = () => { pending.draftItemMediaUrl = inp.value; };

    const ctLbl = document.createElement('div');
    ctLbl.className        = 'at-modal-sub-lbl at-modal-sub-lbl--tip';
    ctLbl.textContent      = 'Content type:';
    ctLbl.dataset.tipTitle = 'Content type';
    ctLbl.dataset.tipBody  = 'MIME type of the media (e.g. image/png, audio/mpeg, video/mp4). Used to determine how to render the media in the preview.';
    ctLbl.dataset.tipFhir  = 'item.extension[sdc-questionnaire-itemMedia].valueAttachment.contentType';
    ctLbl.dataset.tipSpec  = 'SDC';

    const ctInp = document.createElement('input');
    ctInp.type           = 'text';
    ctInp.className      = 'at-modal-placeholder-inp';
    ctInp.dataset.testid = 'item-media-ct-input';
    ctInp.value          = pending.draftItemMediaCt;
    ctInp.placeholder    = 'image/png';
    ctInp.disabled       = !pending.draftItemMediaUrl.trim();
    ctInp.title          = '';
    ctInp.oninput = () => { pending.draftItemMediaCt = ctInp.value; };

    const updateCtState = () => {
      const hasUrl = inp.value.trim().length > 0;
      ctInp.disabled = !hasUrl;
      ctLbl.classList.toggle('at-modal-sub-lbl--muted', !hasUrl);
    };
    inp.addEventListener('input', updateCtState);
    updateCtState();

    section.append(lbl, inp, ctLbl, ctInp);
    return section;
  }

  commit(pending, node, _questDoc, _answerStore) {
    const url = pending.draftItemMediaUrl.trim();
    if (url) {
      node._itemMedia = { url };
      const ct = pending.draftItemMediaCt.trim();
      if (ct) node._itemMedia.contentType = ct;
    } else {
      delete node._itemMedia;
    }
  }

  initPending(node) {
    return {
      draftItemMediaUrl: node._itemMedia?.url || '',
      draftItemMediaCt:  node._itemMedia?.contentType || '',
    };
  }
}

ANSWER_TYPE_SECTIONS.push(new ItemMediaSection());
