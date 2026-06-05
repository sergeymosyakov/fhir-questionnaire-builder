import { AppearanceSection } from './base-section.js';
import { APPEARANCE_SECTIONS } from './registry.js';
import { makeSectionHdr } from './helpers.js';

class MarkdownSection extends AppearanceSection {
  initPending(node) {
    return { draftMarkdown: node._renderMarkdown || '' };
  }

  build(pending) {
    const frag = document.createDocumentFragment();

    frag.appendChild(makeSectionHdr(
      'Markdown',
      'rendering-markdown',
      'Markdown-formatted alternative to item.text. Rendered in preview when no rendering-xhtml is present. rendering-xhtml takes priority if both are set.',
      '_text.extension[rendering-markdown].valueMarkdown',
      'R4'
    ));

    const ta = document.createElement('textarea');
    ta.className      = 'style-modal-raw-ta';
    ta.rows           = 3;
    ta.placeholder    = 'e.g. **Bold question** or _italic_';
    ta.value          = pending.draftMarkdown;
    ta.dataset.testid = 'appearance-markdown-input';
    ta.oninput = () => { pending.draftMarkdown = ta.value; };

    frag.appendChild(ta);
    return frag;
  }

  commit(pending, node) {
    const v = pending.draftMarkdown.trim();
    if (v) node._renderMarkdown = v; else delete node._renderMarkdown;
  }

  buildPatch(pending, _node) {
    return { _renderMarkdown: pending.draftMarkdown.trim() || null };
  }
}

APPEARANCE_SECTIONS.push(new MarkdownSection());
