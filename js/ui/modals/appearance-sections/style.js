import { AppearanceSection } from './base-section.js';
import { APPEARANCE_SECTIONS } from './registry.js';
import { parseStyle, buildStyle, makeSectionHdr } from './helpers.js';

class StyleSection extends AppearanceSection {
  initPending(node) {
    return { draftStyle: node._renderStyle || '' };
  }

  build(pending) {
    const frag = document.createDocumentFragment();

    frag.appendChild(makeSectionHdr(
      'Style',
      'rendering-style',
      'Inline CSS applied to the item title in the preview.',
      '_text.extension[rendering-style]',
      'R4'
    ));

    const form = document.createElement('div');
    form.className = 'appearance-modal-form';
    frag.appendChild(form);

    const cur = parseStyle(pending.draftStyle);

    const boldCb   = Object.assign(document.createElement('input'), { type: 'checkbox', checked: cur.bold,   id: '_am_bold'   });
    const italicCb = Object.assign(document.createElement('input'), { type: 'checkbox', checked: cur.italic, id: '_am_italic' });

    const colorInp = Object.assign(document.createElement('input'), {
      type: 'color',
      value: cur.color?.startsWith('#') ? cur.color : '#000000',
      className: 'panel-color-inp',
    });
    const colorClear = Object.assign(document.createElement('button'), {
      type: 'button', textContent: '\u2715',
      className: 'panel-color-clear',
    });
    colorClear.dataset.tipTitle = 'Remove color';
    let colorCleared = !cur.color;

    const rawTa = document.createElement('textarea');
    rawTa.className      = 'style-modal-raw-ta';
    rawTa.rows           = 1;
    rawTa.placeholder    = 'e.g. font-weight: bold; color: blue';
    rawTa.value          = pending.draftStyle;
    rawTa.dataset.testid = 'appearance-raw-input';

    const syncFromWidgets = () => {
      const color = colorCleared ? '' : colorInp.value;
      pending.draftStyle = buildStyle(boldCb.checked, italicCb.checked, color);
      rawTa.value = pending.draftStyle;
    };

    const syncFromRaw = () => {
      pending.draftStyle = rawTa.value;
      const p2 = parseStyle(rawTa.value);
      boldCb.checked   = p2.bold;
      italicCb.checked = p2.italic;
      if (p2.color?.startsWith('#')) { colorInp.value = p2.color; colorCleared = false; }
      else { colorInp.value = '#000000'; colorCleared = true; }
    };

    boldCb.onchange    = syncFromWidgets;
    italicCb.onchange  = syncFromWidgets;
    colorInp.oninput   = () => { colorCleared = false; syncFromWidgets(); };
    colorClear.onclick = () => { colorCleared = true; colorInp.value = '#000000'; syncFromWidgets(); };
    rawTa.oninput      = syncFromRaw;

    const styleRow = (labelText, ...controls) => {
      const row = document.createElement('div');
      row.className = 'panel-style-row';
      const lbl = document.createElement('label');
      lbl.className   = 'panel-style-lbl';
      lbl.textContent = labelText;
      row.appendChild(lbl);
      controls.forEach(c => row.appendChild(c));
      form.appendChild(row);
    };

    styleRow('Bold',   boldCb);
    styleRow('Italic', italicCb);

    const colorRow = document.createElement('div');
    colorRow.className = 'panel-style-row';
    const colorLbl = document.createElement('label');
    colorLbl.className   = 'panel-style-lbl';
    colorLbl.textContent = 'Color';
    colorRow.appendChild(colorLbl);
    colorRow.appendChild(colorInp);
    colorRow.appendChild(colorClear);
    form.appendChild(colorRow);

    const rawLbl = document.createElement('div');
    rawLbl.className   = 'panel-raw-lbl panel-raw-lbl--sm';
    rawLbl.textContent = 'raw CSS:';
    form.appendChild(rawLbl);
    form.appendChild(rawTa);

    return frag;
  }

  commit(pending, node) {
    node._renderStyle = pending.draftStyle || undefined;
  }
}

APPEARANCE_SECTIONS.push(new StyleSection());
