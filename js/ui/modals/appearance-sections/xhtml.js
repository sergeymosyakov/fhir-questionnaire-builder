import { AppearanceSection } from './base-section.js';
import { APPEARANCE_SECTIONS } from './registry.js';
import { makeSectionHdr } from './helpers.js';

class XhtmlSection extends AppearanceSection {
  initPending(node) {
    return { draftXhtml: node._renderXhtml || '' };
  }

  build(pending) {
    const frag = document.createDocumentFragment();

    frag.appendChild(makeSectionHdr(
      'XHTML',
      'rendering-xhtml',
      'Rich XHTML markup for the item text. Stored for round-trip only — not rendered in preview.',
      '_text.extension[rendering-xhtml]',
      'R4'
    ));

    const xhtmlTa = document.createElement('textarea');
    xhtmlTa.className      = 'style-modal-raw-ta';
    xhtmlTa.rows           = 3;
    xhtmlTa.placeholder    = 'e.g. <b>Question</b> <em>text</em>';
    xhtmlTa.value          = pending.draftXhtml;
    xhtmlTa.dataset.testid = 'appearance-xhtml-input';
    xhtmlTa.oninput = () => { pending.draftXhtml = xhtmlTa.value; };

    frag.appendChild(xhtmlTa);
    return frag;
  }

  commit(pending, node) {
    node._renderXhtml = pending.draftXhtml || undefined;
  }

  buildPatch(pending, _node) {
    return { _renderXhtml: pending.draftXhtml || null };
  }
}

APPEARANCE_SECTIONS.push(new XhtmlSection());
