import { ItemSection } from './base-section.js';
import { ITEM_SECTIONS } from './registry.js';
import { makeCollapsible } from './helpers.js';

class SupportLinksSection extends ItemSection {
  initPending(node) {
    return { supportLinks: (node._supportLinks || []).slice() };
  }

  build(pending) {
    return makeCollapsible({
      testid:      'item-props-sl-toggle',
      tip:         { title: 'Support links', body: 'URLs shown as \u201cMore info \u2197\u201d buttons in patient-facing view. Useful for linking to help pages or patient education material.', fhir: 'item.extension[questionnaire-supportLink].valueUri', spec: 'R4' },
      label:       'Support Links',
      countFn:     () => pending.supportLinks.filter(u => u.trim()).length,
      initialOpen: pending.supportLinks.length > 0,
      buildBody:   ({ el, setLabel }) => {
        const render = () => {
          el.innerHTML = '';
          pending.supportLinks.forEach((url, idx) => {
            const row = document.createElement('div');
            row.className = 'support-link-row';

            const inp = document.createElement('input');
            inp.type           = 'url';
            inp.className      = 'support-link-input';
            inp.placeholder    = 'https://example.com/help';
            inp.value          = url;
            inp.dataset.testid = 'support-link-input';
            inp.oninput = () => { pending.supportLinks[idx] = inp.value; setLabel(); };

            const rm = document.createElement('button');
            rm.type           = 'button';
            rm.className      = 'codes-remove-btn';
            rm.textContent    = '\u00D7';
            rm.dataset.testid = 'support-link-rm';
            rm.onclick = () => { pending.supportLinks.splice(idx, 1); render(); setLabel(); };

            row.append(inp, rm);
            el.appendChild(row);
          });

          const addBtn = document.createElement('button');
          addBtn.type           = 'button';
          addBtn.className      = 'codes-add-btn';
          addBtn.dataset.testid = 'support-link-add';
          addBtn.textContent    = '+ Add link';
          addBtn.onclick = () => {
            pending.supportLinks.push('');
            render();
            setLabel();
            el.querySelector('input:last-of-type')?.focus();
          };
          el.appendChild(addBtn);
        };
        render();
      },
    });
  }

  commit(pending, node) {
    const filtered = pending.supportLinks.filter(u => u.trim());
    if (filtered.length) node._supportLinks = filtered;
    else delete node._supportLinks;
  }

  buildPatch(pending, _node) {
    const filtered = pending.supportLinks.filter(u => u.trim());
    return { _supportLinks: filtered.length ? filtered : null };
  }
}

ITEM_SECTIONS.push(new SupportLinksSection());
