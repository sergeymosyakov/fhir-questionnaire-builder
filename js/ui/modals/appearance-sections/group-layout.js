import { AppearanceSection } from './base-section.js';
import { APPEARANCE_SECTIONS } from './registry.js';
import { makeSectionHdr } from './helpers.js';
import { createCustomSelect } from '../../custom-select.js';

// questionnaire-itemControl codes this section manages (group-level display bands).
const GROUP_CONTROLS = ['header', 'footer'];

class GroupLayoutSection extends AppearanceSection {
  initPending(node) {
    const cur = node.type === 'group' && GROUP_CONTROLS.includes(node._itemControl)
      ? node._itemControl
      : '';
    return { draftGroupControl: cur };
  }

  build(pending) {
    // Only meaningful for groups — render nothing for item nodes.
    if (pending.node?.type !== 'group') return document.createDocumentFragment();

    const frag = document.createDocumentFragment();
    frag.appendChild(makeSectionHdr(
      'Group display',
      'Group display control',
      'Renders the group as a header (prominent band, kept visible at the top of the questionnaire) or a footer (muted band at the bottom). Exported as the questionnaire-itemControl extension.',
      'item.extension[questionnaire-itemControl].valueCodeableConcept.coding.code',
      'R4',
    ));

    const sel = createCustomSelect({
      items: [
        { value: '',       label: '\u2014 default \u2014' },
        { value: 'header', label: 'Header (top band)' },
        { value: 'footer', label: 'Footer (bottom band)' },
      ],
      value:     pending.draftGroupControl,
      className: 'sc-trigger--full',
      testid:    'group-layout-select',
      onChange:  v => { pending.draftGroupControl = v; },
    });

    const wrap = document.createElement('div');
    wrap.className = 'appearance-modal-form';
    wrap.appendChild(sel.el);
    frag.appendChild(wrap);
    return frag;
  }

  buildPatch(pending, node) {
    // Never touch non-group nodes (they use _itemControl for other codes).
    if (node.type !== 'group') return {};
    const draft = pending.draftGroupControl;
    if (GROUP_CONTROLS.includes(draft)) return { _itemControl: draft };
    // Cleared: delete only if the current code is one we manage — preserve
    // unsupported round-tripped codes (e.g. gtable).
    if (GROUP_CONTROLS.includes(node._itemControl)) return { _itemControl: null };
    return {};
  }
}

APPEARANCE_SECTIONS.push(new GroupLayoutSection());
